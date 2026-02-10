import { app } from 'electron';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { getStore } from '../../storage';
import { SQLiteManager } from '../../sqlite/manager';
import { collectTaxInvoices } from '../../hometax-automation';
import { parseHometaxExcel } from '../../hometax-excel-parser';
import { importTaxInvoices } from '../../sqlite/hometax';
import { getSchedulerRecoveryService } from '../../scheduler/recovery-service';
import * as fs from 'fs';
import * as path from 'path';

interface EntitySchedule {
  enabled: boolean;
  time: string; // HH:MM format (e.g., "04:00")
}

interface ScheduleSettings {
  enabled: boolean; // Global enable/disable
  retryCount: number;
  retryDelayMinutes: number;
  spreadsheetSyncEnabled?: boolean; // Enable auto-export to spreadsheet

  // Individual entity schedules
  cards: {
    bc?: EntitySchedule;
    hana?: EntitySchedule;
    hyundai?: EntitySchedule;
    kb?: EntitySchedule;
    lotte?: EntitySchedule;
    nh?: EntitySchedule;
    samsung?: EntitySchedule;
    shinhan?: EntitySchedule;
  };

  banks: {
    kookmin?: EntitySchedule;
    nh?: EntitySchedule;
    nhBusiness?: EntitySchedule;
    shinhan?: EntitySchedule;
  };

  tax: {
    [businessNumber: string]: EntitySchedule;
  };

  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'running';
}

interface SyncResult {
  bankId: string;
  accountNumber: string;
  success: boolean;
  error?: string;
  inserted?: number;
  skipped?: number;
}

interface TaxSyncResult {
  businessNumber: string;
  businessName: string;
  success: boolean;
  error?: string;
  salesInserted?: number;
  purchaseInserted?: number;
}

export class FinanceHubScheduler extends EventEmitter {
  private static instance: FinanceHubScheduler | null = null;
  private scheduleTimers: Map<string, NodeJS.Timeout> = new Map(); // entityKey -> timer
  private syncTimers: Map<string, NodeJS.Timeout> = new Map(); // entityKey -> retry timer
  private keepAwakeInterval: any = null;
  private syncingEntities: Set<string> = new Set(); // Track which entities are currently syncing
  private activeBrowsers: Map<string, any> = new Map(); // Track active browser instances by entityKey
  private settings: ScheduleSettings;
  private debugLogPath: string;
  private DEFAULT_SETTINGS: ScheduleSettings = {
    enabled: true,
    retryCount: process.env.NODE_ENV === 'production' ? 3 : 0, // No retries in dev
    retryDelayMinutes: 5,
    spreadsheetSyncEnabled: true,

    // Cards: 4:00 - 5:10 (10-minute intervals)
    cards: {
      bc: { enabled: true, time: '04:00' },
      hana: { enabled: true, time: '04:10' },
      hyundai: { enabled: true, time: '04:20' },
      kb: { enabled: true, time: '04:30' },
      lotte: { enabled: true, time: '04:40' },
      nh: { enabled: true, time: '04:50' },
      samsung: { enabled: true, time: '05:00' },
      shinhan: { enabled: true, time: '05:10' },
    },

    // Banks: 5:20 - 5:50 (10-minute intervals)
    banks: {
      kookmin: { enabled: true, time: '05:20' },
      nh: { enabled: true, time: '05:30' },
      nhBusiness: { enabled: true, time: '05:40' },
      shinhan: { enabled: true, time: '05:50' },
    },

    // Tax: Dynamic based on saved businesses (starting at 6:00)
    tax: {},
  };

  private constructor() {
    super();
    this.settings = this.loadSettings();

    // Create debug log file path
    const logDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'logs')
      : path.join(process.cwd(), 'logs');

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.debugLogPath = path.join(logDir, 'scheduler-debug.log');
    this.debugLog('='.repeat(80));
    this.debugLog(`Scheduler initialized at ${new Date().toISOString()}`);
    this.debugLog('='.repeat(80));
  }

  /**
   * Write debug log to file (visible in production)
   */
  private debugLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    try {
      fs.appendFileSync(this.debugLogPath, logMessage);
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
  }

  public static getInstance(): FinanceHubScheduler {
    if (!FinanceHubScheduler.instance) {
      FinanceHubScheduler.instance = new FinanceHubScheduler();
    }
    return FinanceHubScheduler.instance;
  }

  // ============================================
  // Settings Management
  // ============================================

  private loadSettings(): ScheduleSettings {
    const store = getStore();
    const saved = store.get('financeHubScheduler', {}) as Partial<ScheduleSettings>;

    // Deep merge for nested objects (cards, banks, tax)
    return {
      ...this.DEFAULT_SETTINGS,
      ...saved,
      cards: {
        ...this.DEFAULT_SETTINGS.cards,
        ...(saved.cards || {}),
      },
      banks: {
        ...this.DEFAULT_SETTINGS.banks,
        ...(saved.banks || {}),
      },
      tax: {
        ...this.DEFAULT_SETTINGS.tax,
        ...(saved.tax || {}),
      },
    };
  }

  private saveSettings(): void {
    const store = getStore();
    store.set('financeHubScheduler', this.settings);
  }

  public getSettings(): ScheduleSettings {
    return { ...this.settings };
  }

  public async updateSettings(newSettings: Partial<ScheduleSettings>): Promise<void> {
    // Deep merge for nested objects
    this.settings = {
      ...this.settings,
      ...newSettings,
      cards: {
        ...this.settings.cards,
        ...(newSettings.cards || {}),
      },
      banks: {
        ...this.settings.banks,
        ...(newSettings.banks || {}),
      },
      tax: {
        ...this.settings.tax,
        ...(newSettings.tax || {}),
      },
    };
    this.saveSettings();

    // Restart scheduler if enabled state or any entity schedules changed
    if ('enabled' in newSettings || 'cards' in newSettings || 'banks' in newSettings || 'tax' in newSettings) {
      await this.stop();
      if (this.settings.enabled) {
        await this.start();
      }
    }

    this.emit('settings-updated', this.settings);
  }

  // ============================================
  // Historical Intent Backfill
  // ============================================

  /**
   * Backfill missing execution intents for past days
   * This allows recovery to detect missed executions even if PC was completely off
   */
  private async backfillMissingIntents(lookbackDays: number): Promise<void> {
    console.log(`[FinanceHubScheduler] Backfilling missing intents for last ${lookbackDays} days...`);

    const recoveryService = getSchedulerRecoveryService();
    const intentsToCreate: Array<Omit<any, 'id' | 'createdAt' | 'updatedAt'>> = [];

    // Generate intents for each past day
    for (let daysAgo = 1; daysAgo <= lookbackDays; daysAgo++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - daysAgo);
      const dateStr = pastDate.toISOString().split('T')[0];

      // Cards
      for (const [cardKey, schedule] of Object.entries(this.settings.cards)) {
        if (schedule && schedule.enabled) {
          const entityKey = `card:${cardKey}`;

          // Check if intent already exists for this date
          const exists = await this.intentExistsForDate(entityKey, dateStr);
          if (!exists) {
            intentsToCreate.push(this.createHistoricalIntent('card', cardKey, schedule.time, dateStr));
          }
        }
      }

      // Banks
      for (const [bankKey, schedule] of Object.entries(this.settings.banks)) {
        if (schedule && schedule.enabled) {
          const entityKey = `bank:${bankKey}`;

          const exists = await this.intentExistsForDate(entityKey, dateStr);
          if (!exists) {
            intentsToCreate.push(this.createHistoricalIntent('bank', bankKey, schedule.time, dateStr));
          }
        }
      }

      // Tax
      for (const [businessNumber, schedule] of Object.entries(this.settings.tax)) {
        if (schedule && schedule.enabled) {
          const entityKey = `tax:${businessNumber}`;

          const exists = await this.intentExistsForDate(entityKey, dateStr);
          if (!exists) {
            intentsToCreate.push(this.createHistoricalIntent('tax', businessNumber, schedule.time, dateStr));
          }
        }
      }
    }

    // Bulk create all missing intents
    if (intentsToCreate.length > 0) {
      try {
        await recoveryService.bulkCreateIntents(intentsToCreate);
        console.log(`[FinanceHubScheduler] ✅ Backfilled ${intentsToCreate.length} missing intent(s)`);
      } catch (error) {
        console.error(`[FinanceHubScheduler] Failed to backfill intents:`, error);
      }
    } else {
      console.log(`[FinanceHubScheduler] No missing intents to backfill`);
    }
  }

  /**
   * Check if intent exists for a specific date
   */
  private async intentExistsForDate(entityKey: string, dateStr: string): Promise<boolean> {
    try {
      const recoveryService = getSchedulerRecoveryService();
      return await recoveryService.intentExistsForDate('financehub', entityKey, dateStr);
    } catch (error) {
      console.error(`[FinanceHubScheduler] Failed to check intent for ${entityKey} on ${dateStr}:`, error);
      return false; // Assume doesn't exist on error
    }
  }

  /**
   * Create a historical intent for a past date
   */
  private createHistoricalIntent(entityType: 'card' | 'bank' | 'tax', entityId: string, timeStr: string, dateStr: string): any {
    const [targetHour, targetMinute] = timeStr.split(':').map(Number);
    const entityKey = `${entityType}:${entityId}`;

    // Create date at the scheduled time
    const scheduledTime = new Date(dateStr);
    scheduledTime.setHours(targetHour, targetMinute, 0, 0);

    const windowEnd = new Date(scheduledTime.getTime() + 30 * 60 * 1000); // 30-minute window

    return {
      schedulerType: 'financehub',
      taskId: entityKey,
      taskName: `${entityType} sync: ${entityId}`,
      intendedDate: dateStr,
      intendedTime: timeStr,
      executionWindowStart: scheduledTime.toISOString(),
      executionWindowEnd: windowEnd.toISOString(),
      status: 'pending', // Mark as pending so recovery will find it
    };
  }

  // ============================================
  // Scheduler Control
  // ============================================

  public async start(): Promise<void> {
    if (!this.settings.enabled) {
      console.log('[FinanceHubScheduler] Scheduler is disabled');
      return;
    }

    await this.stop(); // Clear any existing timers and browsers

    // CRITICAL: Backfill missing intents for past 3 days
    // This ensures recovery can detect missed executions even if PC was off
    // ONLY in production - skip in dev for faster startup
    const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;
    if (isProduction) {
      await this.backfillMissingIntents(3);
    } else {
      console.log('[FinanceHubScheduler] Dev mode: Skipping backfill of historical intents');
    }

    this.scheduleNextSync();
    this.startKeepAwake();

    console.log(`[FinanceHubScheduler] Started - Next sync at ${this.settings.time}`);
    this.emit('scheduler-started');
  }

  public async stop(): Promise<void> {
    // Clear all schedule timers
    for (const [entityKey, timer] of this.scheduleTimers) {
      clearTimeout(timer);
    }
    this.scheduleTimers.clear();

    // Clear all retry timers
    for (const [entityKey, timer] of this.syncTimers) {
      clearTimeout(timer);
    }
    this.syncTimers.clear();

    this.stopKeepAwake();

    // Kill all active browsers
    await this.killAllBrowsers();

    console.log('[FinanceHubScheduler] Stopped');
    this.emit('scheduler-stopped');
  }

  private async scheduleNextSync(): Promise<void> {
    const now = new Date();

    // Schedule cards
    for (const [cardKey, schedule] of Object.entries(this.settings.cards)) {
      if (schedule && schedule.enabled) {
        this.scheduleEntity('card', cardKey, schedule.time, now);
      }
    }

    // Schedule banks
    for (const [bankKey, schedule] of Object.entries(this.settings.banks)) {
      if (schedule && schedule.enabled) {
        this.scheduleEntity('bank', bankKey, schedule.time, now);
      }
    }

    // Schedule tax businesses
    for (const [businessNumber, schedule] of Object.entries(this.settings.tax)) {
      if (schedule && schedule.enabled) {
        this.scheduleEntity('tax', businessNumber, schedule.time, now);
      }
    }

    console.log(`[FinanceHubScheduler] Scheduled ${this.scheduleTimers.size} entities`);
  }

  private async scheduleEntity(entityType: 'card' | 'bank' | 'tax', entityId: string, timeStr: string, now: Date): Promise<void> {
    const [targetHour, targetMinute] = timeStr.split(':').map(Number);

    // Calculate next sync time
    const nextSync = new Date();
    nextSync.setHours(targetHour, targetMinute, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextSync <= now) {
      nextSync.setDate(nextSync.getDate() + 1);
    }

    const msUntilSync = nextSync.getTime() - now.getTime();
    const entityKey = `${entityType}:${entityId}`;

    console.log(`[FinanceHubScheduler] ${entityKey} scheduled for ${nextSync.toLocaleString()}`);

    // Create execution intent for recovery tracking
    try {
      const recoveryService = getSchedulerRecoveryService();
      const windowEnd = new Date(nextSync.getTime() + 30 * 60 * 1000); // 30-minute execution window

      await recoveryService.createIntent({
        schedulerType: 'financehub',
        taskId: entityKey,
        taskName: `${entityType} sync: ${entityId}`,
        intendedDate: nextSync.toISOString().split('T')[0],
        intendedTime: timeStr,
        executionWindowStart: nextSync.toISOString(),
        executionWindowEnd: windowEnd.toISOString(),
        status: 'pending',
      });
    } catch (error) {
      console.error(`[FinanceHubScheduler] Failed to create execution intent for ${entityKey}:`, error);
    }

    // Schedule the entity sync
    const timer = setTimeout(() => {
      this.executeEntitySync(entityType, entityId, timeStr);
      // Reschedule for next day
      this.scheduleEntity(entityType, entityId, timeStr, new Date());
    }, msUntilSync);

    // Store the timer
    this.scheduleTimers.set(entityKey, timer);
  }

  // ============================================
  // Keep Awake Functionality
  // ============================================

  private startKeepAwake(): void {
    this.stopKeepAwake();
    
    try {
      // Use Electron's powerSaveBlocker
      const { powerSaveBlocker } = require('electron');
      const id = powerSaveBlocker.start('prevent-app-suspension');
      
      // Store the blocker ID for later cleanup
      this.keepAwakeInterval = id;
      
      console.log('[FinanceHubScheduler] Keep-awake enabled');
    } catch (error) {
      console.error('[FinanceHubScheduler] Failed to enable keep-awake:', error);
    }
  }

  private stopKeepAwake(): void {
    if (this.keepAwakeInterval !== null) {
      try {
        const { powerSaveBlocker } = require('electron');
        powerSaveBlocker.stop(this.keepAwakeInterval);
        this.keepAwakeInterval = null;
        console.log('[FinanceHubScheduler] Keep-awake disabled');
      } catch (error) {
        console.error('[FinanceHubScheduler] Failed to disable keep-awake:', error);
      }
    }
  }

  // ============================================
  // Sync Execution
  // ============================================

  private async executeEntitySync(entityType: 'card' | 'bank' | 'tax', entityId: string, timeStr: string, retryCount = 0): Promise<void> {
    const entityKey = `${entityType}:${entityId}`;

    this.debugLog(`═══ executeEntitySync() called: ${entityKey} (retry ${retryCount}) ═══`);
    console.log(`[FinanceHubScheduler] ═══ executeEntitySync() called: ${entityKey} (retry ${retryCount}) ═══`);

    if (this.syncingEntities.has(entityKey)) {
      this.debugLog(`❌ EXIT POINT 2: ${entityKey} sync already in progress (syncingEntities has it)`);
      this.debugLog(`Current syncingEntities: ${Array.from(this.syncingEntities).join(', ')}`);
      console.log(`[FinanceHubScheduler] ❌ EXIT POINT 2: ${entityKey} sync already in progress (syncingEntities has it)`);
      console.log(`[FinanceHubScheduler] Current syncingEntities:`, Array.from(this.syncingEntities));
      return;
    }

    this.debugLog(`✓ Not currently syncing, proceeding...`);
    console.log(`[FinanceHubScheduler] ✓ Not currently syncing, proceeding...`);

    const today = new Date().toISOString().split('T')[0];
    const executionId = randomUUID();
    const recoveryService = getSchedulerRecoveryService();

    // Deduplication: Check if already ran today (skip in dev mode for testing)
    const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

    if (isProduction) {
      try {
        const hasRun = await recoveryService.hasRunToday('financehub', entityKey);
        this.debugLog(`hasRunToday('${entityKey}') returned: ${hasRun}`);
        console.log(`[FinanceHubScheduler] hasRunToday('${entityKey}') returned:`, hasRun);
        if (hasRun) {
          this.debugLog(`❌ EXIT POINT 3: ${entityKey} already synced today - skipping duplicate execution`);
          console.log(`[FinanceHubScheduler] ❌ EXIT POINT 3: ${entityKey} already synced today - skipping duplicate execution`);
          return;
        }
      } catch (error) {
        this.debugLog(`Failed to check hasRunToday: ${error}`);
        console.error(`[FinanceHubScheduler] Failed to check hasRunToday for ${entityKey}:`, error);
      }
    } else {
      this.debugLog(`ℹ️ Dev mode: Skipping hasRunToday check - allowing multiple runs per day`);
      console.log(`[FinanceHubScheduler] ℹ️ Dev mode: Skipping hasRunToday check - allowing multiple runs per day`);
    }

    this.debugLog(`✓ Passed all checks, starting sync for ${entityKey}...`);
    console.log(`[FinanceHubScheduler] ✓ Passed all checks, starting sync for ${entityKey}...`);

    this.syncingEntities.add(entityKey);
    this.updateSyncStatus('running');
    this.emit('sync-started', { entityType, entityId });

    // Mark intent as running
    try {
      await recoveryService.markIntentRunning('financehub', entityKey, today, executionId);
    } catch (error) {
      console.error(`[FinanceHubScheduler] Failed to mark intent as running for ${entityKey}:`, error);
    }

    try {
      let success = false;
      let error: string | undefined;
      let result: any = {};

      // Execute the appropriate sync based on entity type
      if (entityType === 'card') {
        const cardResult = await this.syncCard(entityId);
        success = cardResult.success;
        error = cardResult.error;
        result = cardResult;
      } else if (entityType === 'bank') {
        const bankResult = await this.syncBank(entityId);
        success = bankResult.success;
        error = bankResult.error;
        result = bankResult;
      } else if (entityType === 'tax') {
        const taxResult = await this.syncTax(entityId);
        success = taxResult.success;
        error = taxResult.error;
        result = taxResult;
      }

      // Check if retries are enabled and if we're in production
      const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

      // Check if error is permanent (no point retrying)
      const isPermanentError = error && (
        error.includes('No saved credentials') ||
        error.includes('Certificate not found') ||
        error.includes('Certificate password not saved') ||
        error.includes('No accounts found')
      );

      const shouldRetry = !success && retryCount < this.settings.retryCount && isProduction && !isPermanentError;

      if (isPermanentError) {
        console.log(`[FinanceHubScheduler] ${entityKey} has permanent error - skipping retries: ${error}`);
        // Mark as skipped instead of failed to prevent recovery retries
        try {
          await recoveryService.markIntentSkipped('financehub', entityKey, today, `permanent_error: ${error}`);
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent as skipped:`, err);
        }
      } else if (shouldRetry) {
        console.log(`[FinanceHubScheduler] ${entityKey} failed (attempt ${retryCount + 1}/${this.settings.retryCount}), retrying in ${this.settings.retryDelayMinutes} minutes...`);

        // CRITICAL FIX: Mark as failed so status is accurate while waiting for retry
        // This prevents the task from getting stuck in 'running' state if app shuts down before retry
        try {
          await recoveryService.markIntentFailed('financehub', entityKey, today, new Error(error || 'Unknown error'));
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent as failed during retry:`, err);
        }

        // CRITICAL FIX: Kill any hung browser from previous attempt
        if (this.activeBrowsers.has(entityKey)) {
          console.log(`[FinanceHubScheduler] Killing hung browser from previous attempt: ${entityKey}`);
          const oldAutomator = this.activeBrowsers.get(entityKey);
          await this.safeCleanupBrowser(oldAutomator, entityKey);
        }

        // CRITICAL FIX: Remove from syncingEntities so retry can proceed
        // Without this, retry will see "already in progress" and exit early
        this.syncingEntities.delete(entityKey);

        // Schedule retry
        const retryTimer = setTimeout(() => {
          this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);

        this.syncTimers.set(entityKey, retryTimer);
      } else {
        // Log reason for not retrying
        if (!success && !isProduction) {
          console.log(`[FinanceHubScheduler] ${entityKey} failed in dev mode - skipping retry`);
        } else if (!success && retryCount >= this.settings.retryCount) {
          console.log(`[FinanceHubScheduler] ${entityKey} failed after ${retryCount} retries - giving up`);
        }
        // Sync completed (with or without success)
        const status = success ? 'success' : 'failed';
        this.updateSyncStatus(status);

        this.emit('entity-sync-completed', {
          entityType,
          entityId,
          success,
          error,
          result,
        });

        console.log(`[FinanceHubScheduler] ${entityKey} sync ${success ? 'completed' : 'failed'}: ${error || 'OK'}`);

        // After successful sync: export to spreadsheet and cleanup files
        if (success && this.settings.spreadsheetSyncEnabled) {
          try {
            console.log(`[FinanceHubScheduler] 📊 Exporting ${entityKey} to spreadsheet...`);
            const exportResult = await this.exportToSpreadsheet();

            if (exportResult.success) {
              console.log(`[FinanceHubScheduler] ✅ Spreadsheet updated: ${exportResult.spreadsheetUrl}`);

              // Cleanup downloaded files only after successful spreadsheet export
              await this.cleanupDownloadedFiles(entityType, entityId);
            } else {
              console.warn(`[FinanceHubScheduler] ⚠️  Spreadsheet export failed: ${exportResult.error}`);
            }
          } catch (exportError) {
            console.error(`[FinanceHubScheduler] Error during post-sync export/cleanup:`, exportError);
          }
        }

        // Mark intent as completed or failed
        try {
          if (success) {
            await recoveryService.markIntentCompleted('financehub', entityKey, today, executionId);
          } else {
            await recoveryService.markIntentFailed('financehub', entityKey, today, new Error(error || 'Unknown error'));
          }
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent status for ${entityKey}:`, err);
        }
      }
    } catch (error) {
      console.error(`[FinanceHubScheduler] ${entityKey} sync error:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if retries are enabled and if we're in production
      const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

      // Check if error is permanent (no point retrying)
      const isPermanentError = errorMessage && (
        errorMessage.includes('No saved credentials') ||
        errorMessage.includes('Certificate not found') ||
        errorMessage.includes('Certificate password not saved') ||
        errorMessage.includes('No accounts found')
      );

      const shouldRetry = retryCount < this.settings.retryCount && isProduction && !isPermanentError;

      if (isPermanentError) {
        console.log(`[FinanceHubScheduler] ${entityKey} has permanent error - skipping retries: ${errorMessage}`);
        // Mark as skipped instead of failed to prevent recovery retries
        try {
          await recoveryService.markIntentSkipped('financehub', entityKey, today, `permanent_error: ${errorMessage}`);
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent as skipped:`, err);
        }
        this.updateSyncStatus('failed');
        this.emit('entity-sync-failed', { entityType, entityId, error });
      } else if (shouldRetry) {
        console.log(`[FinanceHubScheduler] Retrying ${entityKey} (attempt ${retryCount + 1}/${this.settings.retryCount}) in ${this.settings.retryDelayMinutes} minutes...`);

        // CRITICAL FIX: Mark as failed so status is accurate while waiting for retry
        // This prevents the task from getting stuck in 'running' state if app shuts down before retry
        try {
          await recoveryService.markIntentFailed('financehub', entityKey, today, error as Error);
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent as failed during retry:`, err);
        }

        // CRITICAL FIX: Kill any hung browser from previous attempt
        if (this.activeBrowsers.has(entityKey)) {
          console.log(`[FinanceHubScheduler] Killing hung browser from previous attempt: ${entityKey}`);
          const oldAutomator = this.activeBrowsers.get(entityKey);
          await this.safeCleanupBrowser(oldAutomator, entityKey);
        }

        // CRITICAL FIX: Remove from syncingEntities so retry can proceed
        // Without this, retry will see "already in progress" and exit early
        this.syncingEntities.delete(entityKey);

        const retryTimer = setTimeout(() => {
          this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);

        this.syncTimers.set(entityKey, retryTimer);
      } else {
        // Log reason for not retrying
        if (!isProduction) {
          console.log(`[FinanceHubScheduler] ${entityKey} failed in dev mode - skipping retry`);
        } else if (retryCount >= this.settings.retryCount) {
          console.log(`[FinanceHubScheduler] ${entityKey} failed after ${retryCount} retries - giving up`);
        }
        this.updateSyncStatus('failed');
        this.emit('entity-sync-failed', { entityType, entityId, error });

        // Mark intent as failed
        try {
          await recoveryService.markIntentFailed('financehub', entityKey, today, error as Error);
        } catch (err) {
          console.error(`[FinanceHubScheduler] Failed to mark intent as failed for ${entityKey}:`, err);
        }
      }
    } finally {
      this.syncingEntities.delete(entityKey);
    }
  }

  // ============================================
  // Browser Management & Timeout Protection
  // ============================================

  /**
   * Safely cleanup browser with timeout protection
   * Prevents hung cleanup operations from blocking the scheduler
   */
  private async safeCleanupBrowser(automator: any, entityKey: string, timeoutMs = 30000): Promise<void> {
    if (!automator) return;

    try {
      console.log(`[FinanceHubScheduler] Starting safe cleanup for ${entityKey}...`);

      // Create a timeout promise
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Cleanup timeout')), timeoutMs);
      });

      // Race between cleanup and timeout
      await Promise.race([
        automator.cleanup(false), // Force close
        timeoutPromise
      ]);

      console.log(`[FinanceHubScheduler] ✓ Browser cleaned up successfully for ${entityKey}`);
    } catch (cleanupError: any) {
      console.error(`[FinanceHubScheduler] Cleanup failed for ${entityKey}:`, cleanupError.message);

      // Fallback: Try to force kill browser process
      try {
        console.log(`[FinanceHubScheduler] Attempting force kill for ${entityKey}...`);
        if (automator.browser) {
          await automator.browser.close();
        }
      } catch (forceError) {
        console.error(`[FinanceHubScheduler] Force kill failed for ${entityKey}:`, forceError);
      }
    } finally {
      // Remove from active browsers tracking
      this.activeBrowsers.delete(entityKey);
    }
  }

  /**
   * Kill all hung browsers on scheduler stop
   * Prevents zombie browser processes
   */
  private async killAllBrowsers(): Promise<void> {
    console.log(`[FinanceHubScheduler] Killing ${this.activeBrowsers.size} active browser(s)...`);

    const killPromises = Array.from(this.activeBrowsers.entries()).map(async ([entityKey, automator]) => {
      try {
        await this.safeCleanupBrowser(automator, entityKey, 10000); // 10s timeout for shutdown
      } catch (error) {
        console.error(`[FinanceHubScheduler] Failed to kill browser for ${entityKey}:`, error);
      }
    });

    await Promise.all(killPromises);
    this.activeBrowsers.clear();
  }

  // ============================================
  // Individual Entity Sync Methods
  // ============================================

  private async syncCard(cardId: string): Promise<{ success: boolean; error?: string; inserted?: number; skipped?: number }> {
    this.debugLog(`→→→ syncCard() called for: ${cardId}`);
    console.log(`[FinanceHubScheduler] Syncing card: ${cardId}`);

    let automator: any = null;

    // CRITICAL: Add timeout to entire sync operation (10 minutes max)
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Card sync timeout - operation took longer than 10 minutes')), 10 * 60 * 1000);
    });

    const syncPromise = (async () => {
      try {
      const store = getStore();
      const financeHub = store.get('financeHub') as any || { savedCredentials: {} };
      const savedCredentials = financeHub.savedCredentials?.[cardId];

      if (!savedCredentials) {
        this.debugLog(`❌ No saved credentials for card:${cardId}`);
        return {
          success: false,
          error: 'No saved credentials found for this card'
        };
      }

      this.debugLog(`✓ Credentials found, creating automator...`);

      // Get Arduino port
      const arduinoPort = store.get('financeHub.arduinoPort', 'COM3');

      // Create card automator
      const { cards } = require('../index');
      const cardCompanyId = `${cardId}-card`; // Convert "nh" to "nh-card", etc.

      this.debugLog(`Creating automator for ${cardCompanyId} (headless: false - visible browser)...`);

      automator = cards.createCardAutomator(cardCompanyId, {
        headless: false, // CRITICAL FIX: Use visible browser like manual UI (headless causes hangs/failures)
        arduinoPort,
        manualPassword: false
      });

      this.debugLog(`✓ Automator created! Browser should be launching...`);

      // Track active browser
      const entityKey = `card:${cardId}`;
      this.activeBrowsers.set(entityKey, automator);

      // Login
      console.log(`[FinanceHubScheduler] Logging in to ${cardCompanyId}...`);
      const loginResult = await automator.login(savedCredentials);

      if (!loginResult.success) {
        return {
          success: false,
          error: `Login failed: ${loginResult.error || 'Unknown error'}`
        };
      }

      // Get date range for yesterday (1 day)
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const startDate = formatDate(yesterday);
      const endDate = formatDate(today);

      console.log(`[FinanceHubScheduler] Fetching ${cardCompanyId} transactions from ${startDate} to ${endDate}...`);

      // Get all cards for this card company
      let cardList = [];
      if (typeof automator.getCards === 'function') {
        cardList = await automator.getCards();
      }

      let totalInserted = 0;
      let totalSkipped = 0;

      // Fetch transactions for each card
      for (const card of cardList) {
        const cardNumber = card.cardNumber;
        console.log(`[FinanceHubScheduler] Fetching transactions for card ${cardNumber}...`);

        const result = await automator.getTransactions(cardNumber, startDate, endDate);

        if (!result.success || !result.transactions) {
          console.warn(`[FinanceHubScheduler] Failed to get transactions for card ${cardNumber}`);
          continue;
        }

        // Import to database
        const { getSQLiteManager } = await import('../../sqlite/manager');
        const sqliteManager = getSQLiteManager();
        const financeHubDb = sqliteManager.getFinanceHubDatabase();

        const transactionsData = result.transactions[0]?.extractedData?.transactions || [];

        if (transactionsData.length > 0) {
          const cardData = {
            accountNumber: cardNumber,
            accountName: card.cardName || '카드',
            customerName: card.cardholderName || '',
            balance: 0,
            availableBalance: 0,
            openDate: card.issueDate || '',
          };

          const syncMetadata = {
            queryPeriodStart: startDate,
            queryPeriodEnd: endDate,
            excelFilePath: result.transactions[0]?.path || ''
          };

          const importResult = financeHubDb.importTransactions(
            cardCompanyId,
            cardData,
            transactionsData,
            syncMetadata
          );

          if (importResult.success) {
            totalInserted += importResult.inserted;
            totalSkipped += importResult.skipped;
            console.log(`[FinanceHubScheduler] Imported ${importResult.inserted} transactions for card ${cardNumber}`);
          }
        }
      }

      console.log(`[FinanceHubScheduler] Card sync complete for ${cardCompanyId}: ${totalInserted} inserted, ${totalSkipped} skipped`);
      return {
        success: true,
        inserted: totalInserted,
        skipped: totalSkipped
      };

      } catch (error) {
        console.error(`[FinanceHubScheduler] Card sync error for ${cardId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      } finally {
        // CRITICAL: Always cleanup browser, even on errors
        if (automator) {
          const entityKey = `card:${cardId}`;
          await this.safeCleanupBrowser(automator, entityKey);
        }
      }
    })();

    // Race between sync operation and timeout
    try {
      return await Promise.race([syncPromise, timeoutPromise]);
    } catch (timeoutError: any) {
      console.error(`[FinanceHubScheduler] Card sync timeout for ${cardId}:`, timeoutError);

      // Cleanup browser on timeout
      if (automator) {
        const entityKey = `card:${cardId}`;
        await this.safeCleanupBrowser(automator, entityKey);
      }

      return {
        success: false,
        error: timeoutError.message || 'Card sync timeout'
      };
    }
  }

  private async syncBank(bankId: string): Promise<{ success: boolean; error?: string; inserted?: number; skipped?: number }> {
    console.log(`[FinanceHubScheduler] Syncing bank: ${bankId}`);

    let automator: any = null;

    // CRITICAL: Add timeout to entire sync operation (10 minutes max)
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Bank sync timeout - operation took longer than 10 minutes')), 10 * 60 * 1000);
    });

    const syncPromise = (async () => {
      try {
      const store = getStore();
      const financeHub = store.get('financeHub') as any || { savedCredentials: {} };
      const savedCredentials = financeHub.savedCredentials?.[bankId];

      if (!savedCredentials) {
        return {
          success: false,
          error: 'No saved credentials found for this bank'
        };
      }

      // Create bank automator
      const { createAutomator } = require('../index');
      automator = createAutomator(bankId, {
        headless: false // CRITICAL FIX: Use visible browser like manual UI (headless causes hangs/failures)
      });

      // Track active browser
      const entityKey = `bank:${bankId}`;
      this.activeBrowsers.set(entityKey, automator);

      // Login
      console.log(`[FinanceHubScheduler] Logging in to ${bankId}...`);
      const loginResult = await automator.login(savedCredentials);

      if (!loginResult.success) {
        return {
          success: false,
          error: `Login failed: ${loginResult.error || 'Unknown error'}`
        };
      }

      // Get accounts
      let accounts = [];
      if (typeof automator.getAccounts === 'function') {
        accounts = await automator.getAccounts();
      }

      if (accounts.length === 0) {
        return {
          success: false,
          error: 'No accounts found'
        };
      }

      // Get date range for yesterday (1 day)
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const startDate = formatDate(yesterday);
      const endDate = formatDate(today);

      console.log(`[FinanceHubScheduler] Fetching ${bankId} transactions from ${startDate} to ${endDate}...`);

      let totalInserted = 0;
      let totalSkipped = 0;

      // Get database
      const { getSQLiteManager } = await import('../../sqlite/manager');
      const sqliteManager = getSQLiteManager();
      const financeHubDb = sqliteManager.getFinanceHubDatabase();

      // Fetch transactions for each account
      for (const account of accounts) {
        const accountNumber = account.accountNumber;
        console.log(`[FinanceHubScheduler] Fetching transactions for account ${accountNumber}...`);

        try {
          const result = await automator.getTransactions(accountNumber, startDate, endDate);

          if (!result.success) {
            console.warn(`[FinanceHubScheduler] Failed to get transactions for account ${accountNumber}`);
            continue;
          }

          // Parse transactions
          const transactionsData = (result.transactions || []).map((tx: any) => ({
            date: tx.date ? tx.date.replace(/[-.]/g, '') : '',
            time: tx.time || '',
            datetime: tx.datetime || (tx.date && tx.time ? tx.date.replace(/[-.]/g, '/') + ' ' + tx.time : ''),
            type: tx.type || '',
            withdrawal: tx.withdrawal || 0,
            deposit: tx.deposit || 0,
            description: tx.description || '',
            balance: tx.balance || 0,
            branch: tx.branch || '',
          }));

          if (transactionsData.length > 0) {
            const accountData = {
              accountNumber,
              accountName: account.accountName || '계좌',
              customerName: loginResult.userName || '',
              balance: result.metadata?.balance || account.balance || 0,
              availableBalance: result.metadata?.availableBalance || 0,
              openDate: result.metadata?.openDate || '',
            };

            const syncMetadata = {
              queryPeriodStart: startDate,
              queryPeriodEnd: endDate,
              excelFilePath: result.file || result.filename || ''
            };

            const importResult = financeHubDb.importTransactions(
              bankId,
              accountData,
              transactionsData,
              syncMetadata
            );

            if (importResult.success) {
              totalInserted += importResult.inserted;
              totalSkipped += importResult.skipped;
              console.log(`[FinanceHubScheduler] Imported ${importResult.inserted} transactions for account ${accountNumber}`);
            }
          }
        } catch (accountError) {
          console.error(`[FinanceHubScheduler] Error syncing account ${accountNumber}:`, accountError);
          continue;
        }
      }

      console.log(`[FinanceHubScheduler] Bank sync complete for ${bankId}: ${totalInserted} inserted, ${totalSkipped} skipped`);
      return {
        success: true,
        inserted: totalInserted,
        skipped: totalSkipped
      };

      } catch (error) {
        console.error(`[FinanceHubScheduler] Bank sync error for ${bankId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      } finally {
        // CRITICAL: Always cleanup browser, even on errors
        if (automator) {
          const entityKey = `bank:${bankId}`;
          await this.safeCleanupBrowser(automator, entityKey);
        }
      }
    })();

    // Race between sync operation and timeout
    try {
      return await Promise.race([syncPromise, timeoutPromise]);
    } catch (timeoutError: any) {
      console.error(`[FinanceHubScheduler] Bank sync timeout for ${bankId}:`, timeoutError);

      // Cleanup browser on timeout
      if (automator) {
        const entityKey = `bank:${bankId}`;
        await this.safeCleanupBrowser(automator, entityKey);
      }

      return {
        success: false,
        error: timeoutError.message || 'Bank sync timeout'
      };
    }
  }

  private async syncTax(businessNumber: string): Promise<{ success: boolean; error?: string; salesInserted?: number; purchaseInserted?: number }> {
    console.log(`[FinanceHubScheduler] Syncing tax invoices for business: ${businessNumber}`);

    // CRITICAL: Add timeout to entire sync operation (15 minutes max for tax - it's slower)
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Tax sync timeout - operation took longer than 15 minutes')), 15 * 60 * 1000);
    });

    const syncPromise = (async () => {
      try {
      const store = getStore();
      const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
      const savedCertificates = hometaxConfig.selectedCertificates || {};

      const certData = savedCertificates[businessNumber];

      if (!certData) {
        return {
          success: false,
          error: 'Certificate not found in saved data'
        };
      }

      if (!certData.certificatePassword) {
        return {
          success: false,
          error: 'Certificate password not saved'
        };
      }

      // Collect invoices (download Excel files)
      const result = await collectTaxInvoices(certData, certData.certificatePassword);

      if (!result.success) {
        throw new Error(result.error || 'Failed to collect tax invoices');
      }

      // Get database
      const { getFinanceHubDatabase } = require('../../sqlite/init');
      const db = getFinanceHubDatabase();

      let salesInserted = 0;
      let purchaseInserted = 0;

      // Parse and import sales invoices
      if (result.salesFile) {
        console.log(`[FinanceHubScheduler] Parsing sales invoices from ${result.salesFile}`);
        const salesParsed = parseHometaxExcel(result.salesFile);

        if (salesParsed.success && salesParsed.invoices && salesParsed.businessNumber) {
          const importResult = importTaxInvoices(
            db,
            salesParsed.businessNumber,
            'sales',
            salesParsed.invoices,
            result.salesFile
          );

          if (importResult.success) {
            salesInserted = importResult.inserted;
            console.log(`[FinanceHubScheduler] Imported ${salesInserted} sales invoices`);
          }
        }
      }

      // Parse and import purchase invoices
      if (result.purchaseFile) {
        console.log(`[FinanceHubScheduler] Parsing purchase invoices from ${result.purchaseFile}`);
        const purchaseParsed = parseHometaxExcel(result.purchaseFile);

        if (purchaseParsed.success && purchaseParsed.invoices && purchaseParsed.businessNumber) {
          const importResult = importTaxInvoices(
            db,
            purchaseParsed.businessNumber,
            'purchase',
            purchaseParsed.invoices,
            result.purchaseFile
          );

          if (importResult.success) {
            purchaseInserted = importResult.inserted;
            console.log(`[FinanceHubScheduler] Imported ${purchaseInserted} purchase invoices`);
          }
        }
      }

      return {
        success: true,
        salesInserted,
        purchaseInserted
      };

      } catch (error) {
        console.error(`[FinanceHubScheduler] Failed to sync tax for ${businessNumber}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })();

    // Race between sync operation and timeout
    try {
      return await Promise.race([syncPromise, timeoutPromise]);
    } catch (timeoutError: any) {
      console.error(`[FinanceHubScheduler] Tax sync timeout for ${businessNumber}:`, timeoutError);

      return {
        success: false,
        error: timeoutError.message || 'Tax sync timeout'
      };
    }
  }

  /**
   * Cleanup downloaded files after successful sync
   */
  private async cleanupDownloadedFiles(entityType: 'card' | 'bank' | 'tax', entityId: string): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');

      let downloadDir: string;

      if (entityType === 'card') {
        downloadDir = path.join(process.cwd(), 'output', entityId, 'downloads');
      } else if (entityType === 'bank') {
        downloadDir = path.join(process.cwd(), 'output', entityId, 'downloads');
      } else {
        // Tax files cleanup handled separately
        return;
      }

      if (!fs.existsSync(downloadDir)) {
        console.log(`[FinanceHubScheduler] Download directory not found: ${downloadDir}`);
        return;
      }

      const files = fs.readdirSync(downloadDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(downloadDir, file);
        try {
          const stats = fs.statSync(filePath);

          // Delete files (skip directories)
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[FinanceHubScheduler] 🗑️  Deleted: ${file}`);
          }
        } catch (error) {
          console.error(`[FinanceHubScheduler] Failed to delete ${filePath}:`, error);
        }
      }

      // Special handling for BC Card - cleanup extracted temp folders
      if (entityId === 'bc-card') {
        const tmpDir = require('os').tmpdir();
        const tmpFiles = fs.readdirSync(tmpDir);

        for (const tmpFile of tmpFiles) {
          if (tmpFile.startsWith('bc-card-extract-')) {
            const tmpPath = path.join(tmpDir, tmpFile);
            try {
              // Delete directory recursively
              fs.rmSync(tmpPath, { recursive: true, force: true });
              deletedCount++;
              console.log(`[FinanceHubScheduler] 🗑️  Deleted temp folder: ${tmpFile}`);
            } catch (error) {
              console.error(`[FinanceHubScheduler] Failed to delete temp folder ${tmpPath}:`, error);
            }
          }
        }
      }

      console.log(`[FinanceHubScheduler] ✅ Cleaned up ${deletedCount} file(s) from ${entityType}:${entityId}`);
    } catch (error) {
      console.error(`[FinanceHubScheduler] File cleanup error for ${entityType}:${entityId}:`, error);
    }
  }

  /**
   * Export collected data to Google Spreadsheet
   * This can be called periodically or after syncs complete
   */
  private async exportToSpreadsheet(): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
    try {
      console.log('[FinanceHubScheduler] 📊 Exporting to Google Spreadsheet...');

      const { getSheetsService } = await import('../../mcp/sheets/sheets-service');
      const { getSQLiteManager } = await import('../../sqlite/manager');

      const sheetsService = getSheetsService();
      const sqliteManager = getSQLiteManager();
      const financeHubDb = sqliteManager.getFinanceHubDatabase();

      // Export all recent data to spreadsheet
      const transactions = financeHubDb.prepare(`
        SELECT * FROM transactions
        ORDER BY date DESC, time DESC
        LIMIT 1000
      `).all();

      const banks = financeHubDb.prepare('SELECT * FROM banks').all();
      const accounts = financeHubDb.prepare('SELECT * FROM accounts').all();

      const banksMap: any = {};
      for (const bank of banks as any[]) {
        banksMap[bank.id] = bank;
      }

      const store = getStore();
      const financeHub = store.get('financeHub') as any || {};
      if (!financeHub.persistentSpreadsheets) {
        financeHub.persistentSpreadsheets = {};
      }
      const persistentSpreadsheetId = financeHub.persistentSpreadsheets['scheduler-sync']?.spreadsheetId;

      const transactionsResult = await sheetsService.getOrCreateTransactionsSpreadsheet(
        transactions,
        banksMap,
        accounts,
        persistentSpreadsheetId,
        'EGDesk 거래내역' // Custom title without date timestamp
      );

      financeHub.persistentSpreadsheets['scheduler-sync'] = {
        spreadsheetId: transactionsResult.spreadsheetId,
        spreadsheetUrl: transactionsResult.spreadsheetUrl,
        title: 'EGDesk 거래내역',
        lastUpdated: new Date().toISOString(),
      };
      store.set('financeHub', financeHub);

      console.log('[FinanceHubScheduler] ✅ Spreadsheet export complete:', transactionsResult.spreadsheetUrl);

      return {
        success: true,
        spreadsheetUrl: transactionsResult.spreadsheetUrl
      };

    } catch (error) {
      console.error('[FinanceHubScheduler] ❌ Spreadsheet export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================
  // Manual Sync
  // ============================================

  public async syncNow(): Promise<void> {
    console.log('[FinanceHubScheduler] Manual sync triggered - syncing all enabled entities');

    const syncPromises: Promise<void>[] = [];

    // Sync all enabled cards
    for (const [cardId, schedule] of Object.entries(this.settings.cards)) {
      if (schedule && schedule.enabled) {
        syncPromises.push(this.executeEntitySync('card', cardId, schedule.time));
      }
    }

    // Sync all enabled banks
    for (const [bankId, schedule] of Object.entries(this.settings.banks)) {
      if (schedule && schedule.enabled) {
        syncPromises.push(this.executeEntitySync('bank', bankId, schedule.time));
      }
    }

    // Sync all enabled tax businesses
    for (const [businessNumber, schedule] of Object.entries(this.settings.tax)) {
      if (schedule && schedule.enabled) {
        syncPromises.push(this.executeEntitySync('tax', businessNumber, schedule.time));
      }
    }

    await Promise.all(syncPromises);
  }

  public async syncEntity(entityType: 'card' | 'bank' | 'tax', entityId: string): Promise<void> {
    this.debugLog(`═══ syncEntity() called: ${entityType}:${entityId} ═══`);
    console.log(`[FinanceHubScheduler] ═══ syncEntity() called: ${entityType}:${entityId} ═══`);

    const schedule =
      entityType === 'card'
        ? this.settings.cards[entityId as keyof typeof this.settings.cards]
        : entityType === 'bank'
        ? this.settings.banks[entityId as keyof typeof this.settings.banks]
        : this.settings.tax[entityId];

    this.debugLog(`Schedule found: ${schedule ? `Yes (time: ${schedule.time}, enabled: ${schedule.enabled})` : 'NO - WILL THROW ERROR'}`);
    console.log(`[FinanceHubScheduler] Schedule found:`, schedule ? `Yes (time: ${schedule.time}, enabled: ${schedule.enabled})` : 'NO - WILL THROW ERROR');

    if (!schedule) {
      this.debugLog(`❌ EXIT POINT 1: No schedule found for ${entityType}:${entityId}`);
      console.error(`[FinanceHubScheduler] ❌ EXIT POINT 1: No schedule found for ${entityType}:${entityId}`);
      throw new Error(`No schedule found for ${entityType}:${entityId}`);
    }

    this.debugLog(`✓ Calling executeEntitySync for ${entityType}:${entityId}...`);
    console.log(`[FinanceHubScheduler] ✓ Calling executeEntitySync for ${entityType}:${entityId}...`);
    return this.executeEntitySync(entityType, entityId, schedule.time);
  }

  // ============================================
  // Status Management
  // ============================================

  private updateSyncStatus(status: 'success' | 'failed' | 'running'): void {
    this.settings.lastSyncTime = new Date().toISOString();
    this.settings.lastSyncStatus = status;
    this.saveSettings();
  }

  public getLastSyncInfo(): { time?: string; status?: string } {
    return {
      time: this.settings.lastSyncTime,
      status: this.settings.lastSyncStatus,
    };
  }

  public isSyncInProgress(): boolean {
    return this.syncingEntities.size > 0;
  }

  public getSyncingEntities(): string[] {
    return Array.from(this.syncingEntities);
  }

  // ============================================
  // Cleanup
  // ============================================

  public async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
    FinanceHubScheduler.instance = null;
  }
}

// Export singleton getter for convenience
export function getFinanceHubScheduler(): FinanceHubScheduler {
  return FinanceHubScheduler.getInstance();
}
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
    [businessName: string]: EntitySchedule;  // Key is business name, not number
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
    retryCount: 3, // Enable retries in all environments
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

    // CRITICAL: Clean up invalid tax entries (empty or undefined business names)
    const cleanedTax: { [businessName: string]: EntitySchedule } = {};
    if (saved.tax) {
      for (const [businessName, schedule] of Object.entries(saved.tax)) {
        if (businessName && businessName.trim() !== '') {
          cleanedTax[businessName] = schedule as EntitySchedule;
        } else {
          console.warn(`[FinanceHubScheduler] Removed invalid tax entry with empty business name from settings`);
        }
      }
    }

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
        ...cleanedTax,
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
      for (const [businessName, schedule] of Object.entries(this.settings.tax)) {
        // CRITICAL: Validate business name before processing
        if (!businessName || businessName.trim() === '') {
          console.warn(`[FinanceHubScheduler] Skipping invalid tax entry with empty business name`);
          continue;
        }
        
        if (schedule && schedule.enabled) {
          const entityKey = `tax:${businessName}`;

          const exists = await this.intentExistsForDate(entityKey, dateStr);
          if (!exists) {
            intentsToCreate.push(this.createHistoricalIntent('tax', businessName, schedule.time, dateStr));
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
    await this.backfillMissingIntents(3);

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
    const store = getStore();
    
    // NEW: Get credentials from DATABASE
    const { getSQLiteManager } = await import('../../sqlite/manager');
    const sqliteManager = getSQLiteManager();
    const financeHubDb = sqliteManager.getFinanceHubManager();
    const banksWithCredentials = financeHubDb.getBanksWithCredentials();

    console.log(`[FinanceHubScheduler] ═══ SCHEDULING DEBUG ═══`);
    console.log(`[FinanceHubScheduler] Found ${banksWithCredentials.length} banks with credentials (DATABASE):`, banksWithCredentials);
    console.log(`[FinanceHubScheduler] Card schedules:`, Object.keys(this.settings.cards).length, 'cards');
    console.log(`[FinanceHubScheduler] Bank schedules:`, Object.keys(this.settings.banks).length, 'banks');
    console.log(`[FinanceHubScheduler] Tax schedules:`, Object.keys(this.settings.tax).length, 'businesses');

    // Schedule cards
    for (const [cardKey, schedule] of Object.entries(this.settings.cards)) {
      if (schedule && schedule.enabled) {
        // CRITICAL: Card credentials are saved with "-card" suffix (e.g., "bc-card")
        // but scheduler settings use short keys (e.g., "bc")
        const credentialKey = `${cardKey}-card`;
        
        // NEW: Check database instead of store
        if (banksWithCredentials.includes(credentialKey)) {
          this.scheduleEntity('card', cardKey, schedule.time, now);
        } else {
          console.log(`[FinanceHubScheduler] ⚠️  Skipping ${cardKey} card - no credentials in DATABASE`);
        }
      }
    }

    // Schedule banks
    for (const [bankKey, schedule] of Object.entries(this.settings.banks)) {
      if (schedule && schedule.enabled) {
        // NEW: Check database instead of store
        if (banksWithCredentials.includes(bankKey)) {
          this.scheduleEntity('bank', bankKey, schedule.time, now);
        } else {
          console.log(`[FinanceHubScheduler] ⚠️  Skipping ${bankKey} bank - no credentials in DATABASE`);
        }
      }
    }

    // Schedule tax businesses
    const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
    const taxCertKeys = Object.keys(hometaxConfig.selectedCertificates || {});
    console.log(`[FinanceHubScheduler] Found ${taxCertKeys.length} tax certificates:`, taxCertKeys);
    
    // DEBUG: Show certificate details to understand why business name is empty
    for (const certKey of taxCertKeys) {
      const cert = hometaxConfig.selectedCertificates[certKey];
      console.log(`[FinanceHubScheduler]   - Certificate key: "${certKey}"`);
      console.log(`[FinanceHubScheduler]     businessName: "${cert?.businessName}"`);
      console.log(`[FinanceHubScheduler]     소유자명: "${cert?.소유자명}"`);
      console.log(`[FinanceHubScheduler]     has password: ${!!cert?.certificatePassword}`);
    }
    
    for (const [businessName, schedule] of Object.entries(this.settings.tax)) {
      // CRITICAL: Validate business name before processing
      if (!businessName || businessName.trim() === '') {
        console.warn(`[FinanceHubScheduler] Skipping invalid tax entry with empty business name`);
        continue;
      }
      
      if (schedule && schedule.enabled) {
        // Tax credentials check (certificate-based) - use businessName as key
        const certData = hometaxConfig.selectedCertificates?.[businessName];
        
        if (certData && certData.certificatePassword) {
          this.scheduleEntity('tax', businessName, schedule.time, now);
        } else {
          console.log(`[FinanceHubScheduler] ⚠️  Skipping tax ${businessName} - no certificate configured (checked key: "${businessName}")`);
        }
      }
    }

    console.log(`[FinanceHubScheduler] Scheduled ${this.scheduleTimers.size} entities (skipped entities without credentials)`);
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

    // CRITICAL: Clear retry timer if this is a retry execution
    // The timer already fired, so remove it from tracking
    if (retryCount > 0 && this.syncTimers.has(entityKey)) {
      this.debugLog(`Clearing fired retry timer for ${entityKey}`);
      this.syncTimers.delete(entityKey);
    }

    // CRITICAL: Check if already syncing
    if (this.syncingEntities.has(entityKey)) {
      this.debugLog(`❌ EXIT POINT 2: ${entityKey} sync already in progress (syncingEntities has it)`);
      this.debugLog(`Current syncingEntities: ${Array.from(this.syncingEntities).join(', ')}`);
      console.log(`[FinanceHubScheduler] ❌ EXIT POINT 2: ${entityKey} sync already in progress (syncingEntities has it)`);
      console.log(`[FinanceHubScheduler] Current syncingEntities:`, Array.from(this.syncingEntities));
      return;
    }

    // CRITICAL: Check if retry timer already scheduled (prevents duplicate retries)
    if (this.syncTimers.has(entityKey)) {
      this.debugLog(`❌ EXIT POINT 1.5: ${entityKey} already has a retry timer scheduled`);
      console.log(`[FinanceHubScheduler] ❌ EXIT POINT 1.5: ${entityKey} already has a retry timer scheduled - skipping to prevent duplicate`);
      return;
    }

    this.debugLog(`✓ Not currently syncing, proceeding...`);
    console.log(`[FinanceHubScheduler] ✓ Not currently syncing, proceeding...`);

    const today = new Date().toISOString().split('T')[0];
    const executionId = randomUUID();
    const recoveryService = getSchedulerRecoveryService();

    // Deduplication: Check if already ran today (enabled in all environments)
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

      // Check if error is permanent (no point retrying)
      const isPermanentError = error && (
        error.includes('No saved credentials') ||
        error.includes('Certificate not found') ||
        error.includes('Certificate password not saved') ||
        error.includes('No accounts found')
      );

      const shouldRetry = !success && retryCount < this.settings.retryCount && !isPermanentError;

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
        const retryTimer = setTimeout(async () => {
          // CRITICAL: Add small delay before retry to ensure Arduino port is fully released
          // Serial ports sometimes need a moment to fully disconnect at OS level
          if (entityType === 'card') {
            console.log(`[FinanceHubScheduler] Waiting 2s before retry to ensure Arduino port is released...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);

        this.syncTimers.set(entityKey, retryTimer);
      } else {
        // Log reason for not retrying
        if (!success && retryCount >= this.settings.retryCount) {
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

      // Check if error is permanent (no point retrying)
      const isPermanentError = errorMessage && (
        errorMessage.includes('No saved credentials') ||
        errorMessage.includes('Certificate not found') ||
        errorMessage.includes('Certificate password not saved') ||
        errorMessage.includes('No accounts found')
      );

      const shouldRetry = retryCount < this.settings.retryCount && !isPermanentError;

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
        if (retryCount >= this.settings.retryCount) {
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
      // CRITICAL: Always cleanup browser and remove from tracking, even on errors
      this.syncingEntities.delete(entityKey);
      
      // Clean up any browser that might be left in activeBrowsers
      if (this.activeBrowsers.has(entityKey)) {
        console.log(`[FinanceHubScheduler] Cleaning up browser in finally block for: ${entityKey}`);
        const automator = this.activeBrowsers.get(entityKey);
        try {
          await this.safeCleanupBrowser(automator, entityKey);
        } catch (cleanupError) {
          console.error(`[FinanceHubScheduler] Error during finally cleanup for ${entityKey}:`, cleanupError);
        }
      }
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
      
      // NEW: Get credentials from DATABASE
      const { getSQLiteManager } = await import('../../sqlite/manager');
      const sqliteManager = getSQLiteManager();
      const financeHubDb = sqliteManager.getFinanceHubManager();
      
      // CRITICAL: Card credentials are saved with "-card" suffix (e.g., "bc-card")
      const credentialKey = `${cardId}-card`;
      const dbCredentials = financeHubDb.getCredentials(credentialKey);

      if (!dbCredentials) {
        this.debugLog(`❌ No saved credentials for card:${cardId} (checked DATABASE key: ${credentialKey})`);
        console.log(`[FinanceHubScheduler] ❌ No credentials in DATABASE for ${credentialKey}`);
        return {
          success: false,
          error: 'No saved credentials found in database for this card'
        };
      }

      // Reconstruct credentials object from database
      const savedCredentials = {
        userId: dbCredentials.userId,
        password: dbCredentials.password,
        ...dbCredentials.metadata
      };

      this.debugLog(`✓ Credentials found in DATABASE, creating automator...`);
      console.log(`[FinanceHubScheduler] ✅ Retrieved credentials from DATABASE for ${credentialKey}`);

      // CRITICAL: Auto-detect Arduino port (like manual UI does)
      let arduinoPort = store.get('financeHub.arduinoPort', 'COM3');
      
      // Try to auto-detect Arduino if not already set or if it's the default Windows port on Mac
      const isMac = process.platform === 'darwin';
      const isDefaultWindowsPort = arduinoPort === 'COM3' || arduinoPort?.startsWith('COM');
      
      if (isMac && isDefaultWindowsPort) {
        this.debugLog(`⚠️  Detected macOS with Windows port (${arduinoPort}), attempting auto-detection...`);
        console.log(`[FinanceHubScheduler] ⚠️  Detected macOS with Windows port (${arduinoPort}), attempting auto-detection...`);
        
        try {
          const { SerialPort } = require('serialport');
          const ports = await SerialPort.list();
          
          // Look for Arduino by checking vendor IDs and path patterns
          const arduinoPortFound = ports.find((port: any) => {
            return (
              port.vendorId === '2341' || // Arduino official
              port.vendorId === '0403' || // FTDI
              port.vendorId === '1a86' || // CH340
              port.vendorId === '10c4' || // CP210x
              port.path?.includes('usbserial') ||
              port.path?.includes('usbmodem') ||
              port.manufacturer?.toLowerCase().includes('arduino')
            );
          });
          
          if (arduinoPortFound) {
            arduinoPort = arduinoPortFound.path;
            store.set('financeHub.arduinoPort', arduinoPort);
            this.debugLog(`✅ Auto-detected Arduino on port: ${arduinoPort}`);
            console.log(`[FinanceHubScheduler] ✅ Auto-detected Arduino on port: ${arduinoPort}`);
          } else {
            const warningMsg = `⚠️  No Arduino detected. Available ports: ${ports.map((p: any) => p.path).join(', ')}`;
            this.debugLog(warningMsg);
            console.warn(`[FinanceHubScheduler] ${warningMsg}`);
            
            // Card automation will likely fail without Arduino, but continue anyway
          }
        } catch (error) {
          this.debugLog(`⚠️  Failed to auto-detect Arduino: ${error}`);
          console.error(`[FinanceHubScheduler] Failed to auto-detect Arduino:`, error);
        }
      } else {
        this.debugLog(`Using configured Arduino port: ${arduinoPort}`);
        console.log(`[FinanceHubScheduler] Using configured Arduino port: ${arduinoPort}`);
      }

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

      // Get date range for last 7 days
      const today = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const startDate = formatDate(oneWeekAgo);
      const endDate = formatDate(today);

      console.log(`[FinanceHubScheduler] Fetching ${cardCompanyId} transactions from ${startDate} to ${endDate} (7 days)...`);

      // CRITICAL: BC Card and similar sites return ALL transactions for ALL cards at once
      // Card numbers are masked in the download, so just import everything under one account
      const result = await automator.getTransactions(null, startDate, endDate, { parse: true });

      console.log(`[FinanceHubScheduler] 🔍 RAW getTransactions result:`, result);
      console.log(`[FinanceHubScheduler] 🔍 Result type:`, typeof result);
      console.log(`[FinanceHubScheduler] 🔍 Is array:`, Array.isArray(result));
      
      if (Array.isArray(result)) {
        console.log(`[FinanceHubScheduler] 🔍 Array length:`, result.length);
        console.log(`[FinanceHubScheduler] 🔍 First element:`, result[0]);
      } else if (typeof result === 'object') {
        console.log(`[FinanceHubScheduler] 🔍 Object keys:`, Object.keys(result));
      }

      // BC Card returns an ARRAY, not an object with .success
      // Handle both formats for compatibility
      let actualResult;
      if (Array.isArray(result)) {
        console.log(`[FinanceHubScheduler] ✅ Detected array result (BC Card format)`);
        // Wrap array in expected format
        actualResult = {
          success: result.length > 0,
          accounts: result,
          error: result.length === 0 ? 'No data returned' : undefined
        };
      } else {
        console.log(`[FinanceHubScheduler] ✅ Detected object result (standard format)`);
        actualResult = result;
      }

      if (!actualResult.success) {
        return {
          success: false,
          error: `Failed to get transactions: ${actualResult.error || 'Unknown error'}`
        };
      }

      // Import to database (reuse sqliteManager from above)

      let totalInserted = 0;
      let totalSkipped = 0;

      // Collect all transactions from all accounts (card numbers are masked, so combine them)
      const allTransactions: any[] = [];
      let excelFilePath = '';

      // CRITICAL: Check both possible result structures
      if (actualResult.accounts && Array.isArray(actualResult.accounts)) {
        console.log(`[FinanceHubScheduler] 📋 Processing ${actualResult.accounts.length} accounts from actualResult.accounts`);
        for (const account of actualResult.accounts) {
          const transactions = account.extractedData?.transactions || [];
          console.log(`[FinanceHubScheduler]    Account has ${transactions.length} transactions`);
          allTransactions.push(...transactions);
          
          // Use the first Excel file path we find
          if (!excelFilePath && account.path) {
            excelFilePath = account.path;
          }
        }
      } else if (actualResult.transactions && Array.isArray(actualResult.transactions)) {
        // Alternative structure: transactions directly in actualResult
        console.log(`[FinanceHubScheduler] 📋 Processing ${actualResult.transactions.length} transactions from actualResult.transactions`);
        allTransactions.push(...actualResult.transactions);
        excelFilePath = actualResult.filePath || actualResult.file || '';
      } else {
        console.warn(`[FinanceHubScheduler] ⚠️  Unknown result structure - no transactions found`);
        console.warn(`[FinanceHubScheduler] actualResult:`, actualResult);
      }
      
      console.log(`[FinanceHubScheduler] 📊 Total collected transactions: ${allTransactions.length}`);

      // Check if we successfully downloaded and processed files, even if no transactions found
      const hasValidDownloads = actualResult.accounts && actualResult.accounts.some(account => 
        (account.status === 'downloaded' || account.status === 'parsing_error') && 
        account.path && account.extractedData
      );

      // Check for parsing errors
      const hasParsingErrors = actualResult.accounts && actualResult.accounts.some(account =>
        account.status === 'parsing_error' || 
        account.parsingError ||
        account.extractedData?.metadata?.error
      );

      console.log(`[FinanceHubScheduler] 📊 Has valid downloads: ${hasValidDownloads}`);
      console.log(`[FinanceHubScheduler] 📊 Has parsing errors: ${hasParsingErrors}`);
      
      // Debug: Log account details
      if (actualResult.accounts) {
        actualResult.accounts.forEach((account, index) => {
          console.log(`[FinanceHubScheduler] 🔍 Account ${index}: status=${account.status}, transactionCount=${account.transactionCount || 'unknown'}, parsingError=${account.parsingError || 'none'}`);
        });
      }

      // Import all transactions under a single account (since card numbers are masked)
      if (allTransactions.length > 0) {
        const cardData = {
          accountNumber: cardCompanyId, // Use company ID as account number
          accountName: cardCompanyId === 'bc-card' ? 'BC카드 (전체)' : 
                       cardCompanyId === 'shinhan-card' ? '신한카드 (전체)' :
                       `${cardCompanyId} (전체)`,
          customerName: '',
          balance: 0,
          availableBalance: 0,
          openDate: '',
        };

        const syncMetadata = {
          queryPeriodStart: startDate,
          queryPeriodEnd: endDate,
          excelFilePath
        };

        const importResult = financeHubDb.importTransactions(
          cardCompanyId,
          cardData,
          allTransactions,
          syncMetadata,
          true // isCard = true for proper card transaction transformation
        );

        // importTransactions always succeeds or throws, no .success field
        totalInserted = importResult.inserted;
        totalSkipped = importResult.skipped;
        console.log(`[FinanceHubScheduler] Imported ${importResult.inserted} transactions (all cards combined)`);
      }

      // Determine final success status
      let finalSuccess = true;
      let finalMessage = `${totalInserted} inserted, ${totalSkipped} skipped`;

      if (hasParsingErrors) {
        finalSuccess = false;
        finalMessage = 'Excel parsing failed - file may be corrupted or format changed';
      } else if (allTransactions.length === 0 && !hasValidDownloads) {
        finalSuccess = false;
        finalMessage = 'No data returned - download may have failed';
      } else if (allTransactions.length === 0 && hasValidDownloads) {
        finalSuccess = true;
        finalMessage = 'No transactions found in date range (download successful)';
      }

      console.log(`[FinanceHubScheduler] Card sync complete for ${cardCompanyId}: ${finalMessage}`);
      return {
        success: finalSuccess,
        inserted: totalInserted,
        skipped: totalSkipped,
        message: finalMessage
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
      
      // NEW: Get credentials from DATABASE
      const { getSQLiteManager } = await import('../../sqlite/manager');
      const sqliteManager = getSQLiteManager();
      const financeHubDb = sqliteManager.getFinanceHubManager();
      const dbCredentials = financeHubDb.getCredentials(bankId);

      if (!dbCredentials) {
        console.log(`[FinanceHubScheduler] ❌ No credentials in DATABASE for ${bankId}`);
        return {
          success: false,
          error: 'No saved credentials found in database for this bank'
        };
      }

      // Reconstruct credentials object from database
      const savedCredentials = {
        userId: dbCredentials.userId,
        password: dbCredentials.password,
        ...dbCredentials.metadata
      };

      console.log(`[FinanceHubScheduler] ✅ Retrieved credentials from DATABASE for ${bankId}`);

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

      // Get date range for last 7 days
      const today = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(today.getDate() - 7);

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const startDate = formatDate(oneWeekAgo);
      const endDate = formatDate(today);

      console.log(`[FinanceHubScheduler] Fetching ${bankId} transactions from ${startDate} to ${endDate} (7 days)...`);

      let totalInserted = 0;
      let totalSkipped = 0;

      // Get database reference (reuse sqliteManager from above)
      const financeHubDbTransactions = sqliteManager.getFinanceHubDatabase();

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
            transaction_datetime: tx.transaction_datetime || (tx.date && tx.time ? tx.date.replace(/[-.]/g, '/') + ' ' + tx.time : ''),
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

            const importResult = financeHubDbTransactions.importTransactions(
              bankId,
              accountData,
              transactionsData,
              syncMetadata,
              false // isCard = false for bank transactions
            );

            // importTransactions always succeeds or throws, no .success field
            totalInserted += importResult.inserted;
            totalSkipped += importResult.skipped;
            console.log(`[FinanceHubScheduler] Imported ${importResult.inserted} transactions for account ${accountNumber}`);
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

  private async syncTax(businessName: string): Promise<{ success: boolean; error?: string; salesInserted?: number; purchaseInserted?: number }> {
    console.log(`[FinanceHubScheduler] Syncing tax invoices for business: ${businessName}`);

    // CRITICAL: Add timeout to entire sync operation (15 minutes max for tax - it's slower)
    const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) => {
      setTimeout(() => reject(new Error('Tax sync timeout - operation took longer than 15 minutes')), 15 * 60 * 1000);
    });

    const syncPromise = (async () => {
      try {
      const store = getStore();
      const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
      const savedCertificates = hometaxConfig.selectedCertificates || {};

      const certData = savedCertificates[businessName];  // Use businessName as key

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
        console.error(`[FinanceHubScheduler] Failed to sync tax for ${businessName}:`, error);
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
      console.error(`[FinanceHubScheduler] Tax sync timeout for ${businessName}:`, timeoutError);

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
      console.log('[FinanceHubScheduler] 📊 Exporting to Google Spreadsheet via Service Account...');

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

      // Build banks map for lookups
      const banksMap: any = {};
      for (const bank of banks as any[]) {
        banksMap[bank.id] = bank;
      }

      const store = getStore();
      const financeHub = store.get('financeHub') as any || {};
      if (!financeHub.syncSpreadsheets) {
        financeHub.syncSpreadsheets = {};
      }

      // Use unified spreadsheet service with automatic service account setup
      const transactionsResult = await sheetsService.getOrCreateTransactionsSpreadsheet(
        transactions,
        banksMap,
        accounts,
        financeHub.syncSpreadsheets?.['scheduler-sync']?.spreadsheetId,
        'EGDesk FinanceHub Sync' // Custom title for scheduler
      );

      // Update stored metadata
      if (!financeHub.syncSpreadsheets) {
        financeHub.syncSpreadsheets = {};
      }
      
      financeHub.syncSpreadsheets['scheduler-sync'] = {
        spreadsheetId: transactionsResult.spreadsheetId,
        spreadsheetUrl: transactionsResult.spreadsheetUrl,
        title: 'EGDesk FinanceHub Sync',
        lastUpdated: new Date().toISOString(),
        recordCount: transactions.length,
        wasCreated: transactionsResult.wasCreated,
      };
      store.set('financeHub', financeHub);

      const spreadsheetUrl = transactionsResult.spreadsheetUrl;
      console.log('[FinanceHubScheduler] ✅ Service account spreadsheet export complete:', spreadsheetUrl);

      return {
        success: true,
        spreadsheetUrl
      };

    } catch (error) {
      console.error('[FinanceHubScheduler] ❌ Service account spreadsheet export failed:', error);
      
      // Fallback to OAuth if service account fails
      console.log('[FinanceHubScheduler] Attempting OAuth fallback for spreadsheet export...');
      try {
        return await this.exportToSpreadsheetOAuth();
      } catch (fallbackError) {
        console.error('[FinanceHubScheduler] ❌ OAuth fallback also failed:', fallbackError);
        return {
          success: false,
          error: `Service account failed: ${error instanceof Error ? error.message : 'Unknown error'}. OAuth fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        };
      }
    }
  }

  /**
   * OAuth-based spreadsheet export (fallback method)
   */
  private async exportToSpreadsheetOAuth(): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
    try {
      console.log('[FinanceHubScheduler] 📊 Exporting to Google Spreadsheet via OAuth (fallback)...');

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
        'EGDesk 거래내역 (OAuth)' // Mark as OAuth version
      );

      financeHub.persistentSpreadsheets['scheduler-sync'] = {
        spreadsheetId: transactionsResult.spreadsheetId,
        spreadsheetUrl: transactionsResult.spreadsheetUrl,
        title: 'EGDesk 거래내역 (OAuth)',
        lastUpdated: new Date().toISOString(),
      };
      store.set('financeHub', financeHub);

      console.log('[FinanceHubScheduler] ✅ OAuth fallback spreadsheet export complete:', transactionsResult.spreadsheetUrl);

      return {
        success: true,
        spreadsheetUrl: transactionsResult.spreadsheetUrl
      };

    } catch (error) {
      console.error('[FinanceHubScheduler] ❌ OAuth fallback spreadsheet export failed:', error);
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
    console.log('[FinanceHubScheduler] Manual sync triggered - syncing all enabled entities SEQUENTIALLY');

    // CRITICAL FIX: Clear all retry timers before manual sync to prevent duplicate execution
    // This ensures that manual sync doesn't compete with scheduled retries
    const clearedRetries: string[] = [];
    for (const [entityKey, timer] of this.syncTimers.entries()) {
      clearTimeout(timer);
      this.syncTimers.delete(entityKey);
      clearedRetries.push(entityKey);
    }
    
    if (clearedRetries.length > 0) {
      console.log(`[FinanceHubScheduler] Cleared ${clearedRetries.length} pending retry timer(s) before manual sync:`, clearedRetries);
    }

    // Build list of entities to sync
    const entitiesToSync: Array<{type: 'card' | 'bank' | 'tax', id: string, time: string}> = [];

    // Add enabled cards
    for (const [cardId, schedule] of Object.entries(this.settings.cards)) {
      if (schedule && schedule.enabled) {
        entitiesToSync.push({ type: 'card', id: cardId, time: schedule.time });
      }
    }

    // Add enabled banks
    for (const [bankId, schedule] of Object.entries(this.settings.banks)) {
      if (schedule && schedule.enabled) {
        entitiesToSync.push({ type: 'bank', id: bankId, time: schedule.time });
      }
    }

    // Add enabled tax businesses
    for (const [businessName, schedule] of Object.entries(this.settings.tax)) {
      // CRITICAL: Validate business name before processing
      if (!businessName || businessName.trim() === '') {
        console.warn(`[FinanceHubScheduler] Skipping invalid tax entry with empty business name in syncNow`);
        continue;
      }
      
      if (schedule && schedule.enabled) {
        entitiesToSync.push({ type: 'tax', id: businessName, time: schedule.time });
      }
    }

    console.log(`[FinanceHubScheduler] Found ${entitiesToSync.length} entities to sync sequentially`);

    // Sync entities ONE BY ONE (sequentially)
    for (let i = 0; i < entitiesToSync.length; i++) {
      const entity = entitiesToSync[i];
      console.log(`[FinanceHubScheduler] 🔄 Syncing entity ${i + 1}/${entitiesToSync.length}: ${entity.type}:${entity.id}`);
      
      try {
        await this.executeEntitySync(entity.type, entity.id, entity.time);
        console.log(`[FinanceHubScheduler] ✅ Completed entity ${i + 1}/${entitiesToSync.length}: ${entity.type}:${entity.id}`);
      } catch (error) {
        console.error(`[FinanceHubScheduler] ❌ Failed entity ${i + 1}/${entitiesToSync.length}: ${entity.type}:${entity.id}`, error);
        // Continue with next entity even if this one fails
      }
      
      // Brief pause between entities to prevent overwhelming the system
      if (i < entitiesToSync.length - 1) {
        console.log(`[FinanceHubScheduler] Waiting 2 seconds before next entity...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[FinanceHubScheduler] ✅ Manual sync completed - processed ${entitiesToSync.length} entities`);
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

  public hasRetryScheduled(entityKey: string): boolean {
    return this.syncTimers.has(entityKey);
  }

  public getScheduledRetries(): string[] {
    return Array.from(this.syncTimers.keys());
  }

  /**
   * Clear all retry timers and reset sync state
   * Useful for cleaning up stuck retries or resetting after errors
   */
  public async clearRetries(): Promise<{ cleared: number; entities: string[] }> {
    console.log('[FinanceHubScheduler] 🧹 Clearing all retry timers and sync state...');
    
    const clearedEntities: string[] = [];
    
    // 1. Clear all retry timers
    for (const [entityKey, timer] of this.syncTimers) {
      clearTimeout(timer);
      clearedEntities.push(entityKey);
      console.log(`[FinanceHubScheduler] Cleared retry timer for: ${entityKey}`);
    }
    this.syncTimers.clear();
    
    // 2. Clear syncingEntities set (things marked as in-progress)
    const syncingList = Array.from(this.syncingEntities);
    if (syncingList.length > 0) {
      console.log(`[FinanceHubScheduler] Clearing ${syncingList.length} entities marked as in-progress:`, syncingList);
      this.syncingEntities.clear();
    }
    
    // 3. Kill all active browsers (if any)
    if (this.activeBrowsers.size > 0) {
      console.log(`[FinanceHubScheduler] Killing ${this.activeBrowsers.size} active browsers...`);
      await this.killAllBrowsers();
    }
    
    console.log(`[FinanceHubScheduler] ✅ Cleanup complete: Cleared ${clearedEntities.length} retry timer(s)`);
    
    return {
      cleared: clearedEntities.length,
      entities: clearedEntities,
    };
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
import { app } from 'electron';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { getStore } from '../../storage';
import { SQLiteManager } from '../../sqlite/manager';
import { collectTaxInvoices } from '../../hometax-automation';
import { parseHometaxExcel } from '../../hometax-excel-parser';
import { importTaxInvoices } from '../../sqlite/hometax';
import { getSchedulerRecoveryService } from '../../scheduler/recovery-service';

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
  private settings: ScheduleSettings;
  private DEFAULT_SETTINGS: ScheduleSettings = {
    enabled: true,
    retryCount: 3,
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

  public updateSettings(newSettings: Partial<ScheduleSettings>): void {
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
      this.stop();
      if (this.settings.enabled) {
        this.start();
      }
    }

    this.emit('settings-updated', this.settings);
  }

  // ============================================
  // Scheduler Control
  // ============================================

  public start(): void {
    if (!this.settings.enabled) {
      console.log('[FinanceHubScheduler] Scheduler is disabled');
      return;
    }

    this.stop(); // Clear any existing timers
    this.scheduleNextSync();
    this.startKeepAwake();
    
    console.log(`[FinanceHubScheduler] Started - Next sync at ${this.settings.time}`);
    this.emit('scheduler-started');
  }

  public stop(): void {
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

    if (this.syncingEntities.has(entityKey)) {
      console.log(`[FinanceHubScheduler] ${entityKey} sync already in progress`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const executionId = randomUUID();
    const recoveryService = getSchedulerRecoveryService();

    // Deduplication: Check if already ran today
    try {
      const hasRun = await recoveryService.hasRunToday('financehub', entityKey);
      if (hasRun) {
        console.log(`[FinanceHubScheduler] ${entityKey} already synced today - skipping duplicate execution`);
        return;
      }
    } catch (error) {
      console.error(`[FinanceHubScheduler] Failed to check hasRunToday for ${entityKey}:`, error);
    }

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

      if (!success && retryCount < this.settings.retryCount) {
        console.log(`[FinanceHubScheduler] ${entityKey} failed, retrying in ${this.settings.retryDelayMinutes} minutes...`);

        // Schedule retry
        const retryTimer = setTimeout(() => {
          this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);

        this.syncTimers.set(entityKey, retryTimer);
      } else {
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

      if (retryCount < this.settings.retryCount) {
        console.log(`[FinanceHubScheduler] Retrying ${entityKey} in ${this.settings.retryDelayMinutes} minutes...`);
        const retryTimer = setTimeout(() => {
          this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);

        this.syncTimers.set(entityKey, retryTimer);
      } else {
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
  // Individual Entity Sync Methods
  // ============================================

  private async syncCard(cardId: string): Promise<{ success: boolean; error?: string; inserted?: number; skipped?: number }> {
    console.log(`[FinanceHubScheduler] Syncing card: ${cardId}`);

    try {
      // TODO: Implement card sync using card automator
      // Map cardId to the appropriate automator (e.g., 'shinhan' -> ShinhanCardAutomator)

      // For now, return placeholder
      return {
        success: false,
        error: 'Card sync not yet implemented'
      };
    } catch (error) {
      console.error(`[FinanceHubScheduler] Card sync error for ${cardId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async syncBank(bankId: string): Promise<{ success: boolean; error?: string; inserted?: number; skipped?: number }> {
    console.log(`[FinanceHubScheduler] Syncing bank: ${bankId}`);

    try {
      // TODO: Implement bank sync using bank automator
      // Map bankId to the appropriate automator (e.g., 'shinhan' -> ShinhanBankAutomator)

      // For now, return placeholder
      return {
        success: false,
        error: 'Bank sync not yet implemented'
      };
    } catch (error) {
      console.error(`[FinanceHubScheduler] Bank sync error for ${bankId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async syncTax(businessNumber: string): Promise<{ success: boolean; error?: string; salesInserted?: number; purchaseInserted?: number }> {
    console.log(`[FinanceHubScheduler] Syncing tax invoices for business: ${businessNumber}`);

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
    console.log(`[FinanceHubScheduler] Manual sync triggered for ${entityType}:${entityId}`);

    const schedule =
      entityType === 'card'
        ? this.settings.cards[entityId as keyof typeof this.settings.cards]
        : entityType === 'bank'
        ? this.settings.banks[entityId as keyof typeof this.settings.banks]
        : this.settings.tax[entityId];

    if (!schedule) {
      throw new Error(`No schedule found for ${entityType}:${entityId}`);
    }

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

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    FinanceHubScheduler.instance = null;
  }
}

// Export singleton getter for convenience
export function getFinanceHubScheduler(): FinanceHubScheduler {
  return FinanceHubScheduler.getInstance();
}
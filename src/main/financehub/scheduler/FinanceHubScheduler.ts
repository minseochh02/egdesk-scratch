import { app } from 'electron';
import { EventEmitter } from 'events';
import { getStore } from '../../storage';
import { SQLiteManager } from '../../sqlite/manager';
import { collectTaxInvoices } from '../../hometax-automation';
import { parseHometaxExcel } from '../../hometax-excel-parser';
import { importTaxInvoices } from '../../sqlite/hometax';

interface ScheduleSettings {
  enabled: boolean;
  time: string; // HH:MM format (e.g., "06:00")
  retryCount: number;
  retryDelayMinutes: number;
  includeTaxSync: boolean; // Include Hometax tax invoice sync
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
  private scheduleTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private keepAwakeInterval: any = null;
  private isSyncing = false;
  private settings: ScheduleSettings;
  private DEFAULT_SETTINGS: ScheduleSettings = {
    enabled: true,
    time: '06:00',
    retryCount: 3,
    retryDelayMinutes: 5,
    includeTaxSync: true,
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
    return {
      ...this.DEFAULT_SETTINGS,
      ...store.get('financeHubScheduler', {}),
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
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Restart scheduler if enabled state or time changed
    if ('enabled' in newSettings || 'time' in newSettings) {
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
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.stopKeepAwake();
    
    console.log('[FinanceHubScheduler] Stopped');
    this.emit('scheduler-stopped');
  }

  private scheduleNextSync(): void {
    const now = new Date();
    const [targetHour, targetMinute] = this.settings.time.split(':').map(Number);
    
    // Calculate next sync time
    const nextSync = new Date();
    nextSync.setHours(targetHour, targetMinute, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (nextSync <= now) {
      nextSync.setDate(nextSync.getDate() + 1);
    }
    
    const msUntilSync = nextSync.getTime() - now.getTime();
    
    console.log(`[FinanceHubScheduler] Next sync scheduled for ${nextSync.toLocaleString()}`);
    
    this.scheduleTimer = setTimeout(() => {
      this.executeSyncWithRetry();
      // Schedule next day's sync
      this.scheduleNextSync();
    }, msUntilSync);
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

  private async executeSyncWithRetry(retryCount = 0): Promise<void> {
    if (this.isSyncing) {
      console.log('[FinanceHubScheduler] Sync already in progress');
      return;
    }

    this.isSyncing = true;
    this.updateSyncStatus('running');
    this.emit('sync-started');

    try {
      const { bankResults, taxResults } = await this.performSync();

      // Check if any syncs failed
      const failedBankSyncs = bankResults.filter(r => !r.success);
      const failedTaxSyncs = taxResults.filter(r => !r.success);
      const totalFailed = failedBankSyncs.length + failedTaxSyncs.length;

      if (totalFailed > 0 && retryCount < this.settings.retryCount) {
        console.log(`[FinanceHubScheduler] ${totalFailed} syncs failed (${failedBankSyncs.length} bank, ${failedTaxSyncs.length} tax), retrying in ${this.settings.retryDelayMinutes} minutes...`);

        // Schedule retry
        this.syncTimer = setTimeout(() => {
          this.executeSyncWithRetry(retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);
      } else {
        // Sync completed (with or without failures)
        const bankSuccessCount = bankResults.filter(r => r.success).length;
        const taxSuccessCount = taxResults.filter(r => r.success).length;
        const status = totalFailed === 0 ? 'success' : 'failed';

        this.updateSyncStatus(status);
        this.emit('sync-completed', {
          bankResults,
          taxResults,
          bankSuccessCount,
          taxSuccessCount,
          bankFailedCount: failedBankSyncs.length,
          taxFailedCount: failedTaxSyncs.length
        });

        console.log(`[FinanceHubScheduler] Sync completed: Banks (${bankSuccessCount}/${bankResults.length}), Tax (${taxSuccessCount}/${taxResults.length})`);
      }
    } catch (error) {
      console.error('[FinanceHubScheduler] Sync error:', error);

      if (retryCount < this.settings.retryCount) {
        console.log(`[FinanceHubScheduler] Retrying in ${this.settings.retryDelayMinutes} minutes...`);
        this.syncTimer = setTimeout(() => {
          this.executeSyncWithRetry(retryCount + 1);
        }, this.settings.retryDelayMinutes * 60 * 1000);
      } else {
        this.updateSyncStatus('failed');
        this.emit('sync-failed', error);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async performSync(): Promise<{ bankResults: SyncResult[]; taxResults: TaxSyncResult[] }> {
    const bankResults: SyncResult[] = [];
    const taxResults: TaxSyncResult[] = [];

    try {
      // Get finance hub manager
      const sqliteManager = SQLiteManager.getInstance();
      const financeHubManager = sqliteManager.getFinanceHubManager();

      // Get all active accounts
      const accounts = financeHubManager.getAllAccounts().filter(acc => acc.isActive);

      console.log(`[FinanceHubScheduler] Syncing ${accounts.length} active accounts`);

      // Import FinanceHubService
      const { FinanceHubService } = require('../FinanceHubService');
      const financeHubService = FinanceHubService.getInstance();

      // Sync each account
      for (const account of accounts) {
        try {
          console.log(`[FinanceHubScheduler] Syncing ${account.bankId} - ${account.accountNumber}`);

          // Get transactions for last 3 months by default
          const endDate = new Date();
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);

          const transactionResult = await financeHubService.getTransactions(
            account.bankId,
            account.accountNumber,
            startDate.toISOString().split('T')[0].replace(/-/g, ''),
            endDate.toISOString().split('T')[0].replace(/-/g, '')
          );

          if (transactionResult.success && transactionResult.data) {
            // Import transactions to database
            const accountData = {
              accountNumber: account.accountNumber,
              accountName: account.accountName,
              customerName: account.customerName,
              balance: transactionResult.data.metadata?.balance || account.balance,
              availableBalance: transactionResult.data.metadata?.availableBalance || account.availableBalance,
            };

            const transactionsData = (transactionResult.data.transactions || []).map((tx: any) => ({
              date: tx.date,
              time: tx.time,
              type: tx.type,
              withdrawal: tx.withdrawal || 0,
              deposit: tx.deposit || 0,
              description: tx.description,
              balance: tx.balance || 0,
              branch: tx.branch,
            }));

            const importResult = financeHubManager.importTransactions(
              account.bankId,
              accountData,
              transactionsData,
              {
                queryPeriodStart: startDate.toISOString().split('T')[0],
                queryPeriodEnd: endDate.toISOString().split('T')[0],
              }
            );

            bankResults.push({
              bankId: account.bankId,
              accountNumber: account.accountNumber,
              success: true,
              inserted: importResult.inserted,
              skipped: importResult.skipped,
            });
          } else {
            throw new Error(transactionResult.error || 'Failed to fetch transactions');
          }
        } catch (error) {
          console.error(`[FinanceHubScheduler] Failed to sync ${account.accountNumber}:`, error);
          bankResults.push({
            bankId: account.bankId,
            accountNumber: account.accountNumber,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync tax invoices if enabled
      if (this.settings.includeTaxSync) {
        console.log('[FinanceHubScheduler] Starting tax invoice sync...');
        await this.performTaxSync(taxResults);
      }
    } catch (error) {
      console.error('[FinanceHubScheduler] Sync error:', error);
      throw error;
    }

    return { bankResults, taxResults };
  }

  private async performTaxSync(taxResults: TaxSyncResult[]): Promise<void> {
    try {
      const store = getStore();
      const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
      const savedCertificates = hometaxConfig.selectedCertificates || {};

      const businessNumbers = Object.keys(savedCertificates);

      if (businessNumbers.length === 0) {
        console.log('[FinanceHubScheduler] No saved tax certificates found');
        return;
      }

      console.log(`[FinanceHubScheduler] Syncing tax invoices for ${businessNumbers.length} businesses`);

      // Get database
      const { getConversationsDatabase } = require('../../sqlite/init');
      const db = getConversationsDatabase();

      // Sync each business
      for (const businessNumber of businessNumbers) {
        try {
          const certData = savedCertificates[businessNumber];

          if (!certData.certificatePassword) {
            console.log(`[FinanceHubScheduler] Skipping ${businessNumber} - no password saved`);
            taxResults.push({
              businessNumber,
              businessName: certData.businessName || businessNumber,
              success: false,
              error: 'Certificate password not saved',
            });
            continue;
          }

          console.log(`[FinanceHubScheduler] Syncing tax invoices for ${certData.businessName || businessNumber}`);

          // Collect invoices (download Excel files)
          const result = await collectTaxInvoices(certData, certData.certificatePassword);

          if (!result.success) {
            throw new Error(result.error || 'Failed to collect tax invoices');
          }

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

          taxResults.push({
            businessNumber,
            businessName: certData.businessName || businessNumber,
            success: true,
            salesInserted,
            purchaseInserted,
          });

        } catch (error) {
          console.error(`[FinanceHubScheduler] Failed to sync tax for ${businessNumber}:`, error);
          taxResults.push({
            businessNumber,
            businessName: savedCertificates[businessNumber]?.businessName || businessNumber,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      console.error('[FinanceHubScheduler] Tax sync error:', error);
    }
  }

  // ============================================
  // Manual Sync
  // ============================================

  public async syncNow(): Promise<void> {
    console.log('[FinanceHubScheduler] Manual sync triggered');
    return this.executeSyncWithRetry();
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
    return this.isSyncing;
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
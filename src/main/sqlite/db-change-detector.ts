import Database from 'better-sqlite3';
import { BrowserWindow } from 'electron';

/**
 * DBChangeDetector
 * 
 * SQLite update_hook 기반의 실시간 데이터 변경 감지 및 브로드캐스트 디스패처 파서입니다.
 * 1. Neuron DB (AI Center): tasks 및 company_calendar의 실시간 상태 변이 감지 -> db:changed 알림 PUSH
 * 2. FinanceHub DB: bank_transactions 및 card_transactions의 스크래핑/수정 감지 -> financehub:changed 알림 PUSH
 */
export class DBChangeDetector {
  private static instance: DBChangeDetector;

  private constructor() {}

  public static getInstance(): DBChangeDetector {
    if (!DBChangeDetector.instance) {
      DBChangeDetector.instance = new DBChangeDetector();
    }
    return DBChangeDetector.instance;
  }

  /**
   * AI Center / Neuron DB (ai-system.db) 감시
   */
  public watchNeuron(db: Database.Database): void {
    try {
      db.updateHook((action, databaseName, tableName, rowId) => {
        if (tableName === 'tasks' || tableName === 'company_calendar') {
          console.log(`[DB Event Detector] 🔔 AI Center change: ${action} on ${tableName} (RowID: ${rowId})`);
          
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('db:changed', {
                tableName,
                action: action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE',
                rowId: rowId.toString()
              });
            }
          }
        }
      });
      console.log('✅ SQLite update_hook: AI Center Detector connected');
    } catch (err) {
      console.error('❌ Failed to bind AI Center update_hook:', err);
    }
  }

  /**
   * FinanceHub DB (financehub.db) 감시
   */
  public watchFinanceHub(db: Database.Database): void {
    try {
      db.updateHook((action, databaseName, tableName, rowId) => {
        // 감시 핵심 테이블: 계좌 내역, 카드 승인 내역, 국세청 세금계산서 등
        const watchedTables = ['bank_transactions', 'card_transactions', 'hometax_tax_invoices'];

        if (watchedTables.includes(tableName)) {
          console.log(`[FinanceHub Detector] 💰 Financial data update: ${action} on ${tableName} (RowID: ${rowId})`);

          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            if (!win.isDestroyed()) {
              win.webContents.send('financehub:changed', {
                tableName,
                action: action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE',
                rowId: rowId.toString()
              });
            }
          }
        }
      });
      console.log('✅ SQLite update_hook: FinanceHub Detector connected');
    } catch (err) {
      console.error('❌ Failed to bind FinanceHub update_hook:', err);
    }
  }
}

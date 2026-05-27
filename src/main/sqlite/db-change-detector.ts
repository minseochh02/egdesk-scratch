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
      // better-sqlite3 버전이나 환경에 따라 updateHook이 없을 수 있으므로 체크
      if (typeof (db as any).updateHook === 'function') {
        (db as any).updateHook((action: number, databaseName: string, tableName: string, rowId: any) => {
          if (tableName === 'tasks' || tableName === 'company_calendar') {
            console.log(`[DB Event Detector] 🔔 AI Center change: ${action} on ${tableName} (RowID: ${rowId})`);
            this.broadcastChange('db:changed', tableName, action, rowId);
          }
        });
        console.log('✅ SQLite update_hook: AI Center Detector connected');
      } else {
        console.warn('⚠️ SQLite updateHook not found. Falling back to trigger-based detection for Neuron DB.');
        this.setupTriggerFallback(db, ['tasks', 'company_calendar'], 'db:changed');
        console.log('✅ SQLite Triggers: AI Center Detector connected (Fallback)');
      }
    } catch (err) {
      console.error('❌ Failed to bind AI Center update_hook:', err);
    }
  }

  /**
   * FinanceHub DB (financehub.db) 감시
   */
  public watchFinanceHub(db: Database.Database): void {
    try {
      const watchedTables = [
        'bank_transactions',
        'card_transactions',
        'hometax_tax_invoices',
        'ibk_b2b_receivables',
      ];

      if (typeof (db as any).updateHook === 'function') {
        (db as any).updateHook((action: number, databaseName: string, tableName: string, rowId: any) => {
          if (watchedTables.includes(tableName)) {
            const actionStr = action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE';
            console.log(`[FinanceHub Detector] 💰 Financial data update: ${actionStr} on ${tableName} (RowID: ${rowId})`);
            this.broadcastChange('financehub:changed', tableName, action, rowId);
            this.triggerWorkflow(tableName, actionStr, rowId, db);
          }
        });
        console.log('✅ SQLite update_hook: FinanceHub Detector connected');
      } else {
        console.warn('⚠️ SQLite updateHook not found. Falling back to trigger-based detection for FinanceHub DB.');
        this.setupTriggerFallback(db, watchedTables, 'financehub:changed');
        console.log('✅ SQLite Triggers: FinanceHub Detector connected (Fallback)');
      }
    } catch (err) {
      console.error('❌ Failed to bind FinanceHub update_hook:', err);
    }
  }

  /**
   * 공통 브로드캐스트 로직
   */
  private broadcastChange(eventName: string, tableName: string, action: number, rowId: any): void {
    const actionStr = action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE';
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(eventName, {
          tableName,
          action: actionStr,
          rowId: rowId.toString()
        });
      }
    }
  }

  /**
   * 워크플로 트리거 로직
   */
  private triggerWorkflow(tableName: string, actionStr: string, rowId: any, db: Database.Database): void {
    try {
      const { WorkflowTriggerEngine } = require('../workflow/workflow-trigger-engine');
      WorkflowTriggerEngine.getInstance().onFinanceHubChange(
        tableName,
        actionStr,
        rowId.toString(),
        db,
      );
    } catch (triggerErr) {
      console.error('[FinanceHub Detector] WorkflowTriggerEngine call failed:', triggerErr);
    }
  }

  /**
   * updateHook 미지원 시 트리거 기반 감지 설정 (Fallback)
   */
  private setupTriggerFallback(db: Database.Database, tables: string[], eventName: string): void {
    // JS 함수 등록
    const functionName = `notify_change_${eventName.replace(':', '_')}`;
    db.function(functionName, (action: number, tableName: string, rowId: any) => {
      const actionStr = action === 1 ? 'INSERT' : action === 3 ? 'UPDATE' : 'DELETE';
      
      this.broadcastChange(eventName, tableName, action, rowId);
      
      if (eventName === 'financehub:changed') {
        this.triggerWorkflow(tableName, actionStr, rowId, db);
      }
    });

    // 각 테이블에 트리거 생성
    for (const table of tables) {
      try {
        db.exec(`
          CREATE TRIGGER IF NOT EXISTS trg_${table}_ai_insert AFTER INSERT ON ${table}
          BEGIN SELECT ${functionName}(1, '${table}', NEW.rowid); END;
          
          CREATE TRIGGER IF NOT EXISTS trg_${table}_ai_update AFTER UPDATE ON ${table}
          BEGIN SELECT ${functionName}(3, '${table}', NEW.rowid); END;
          
          CREATE TRIGGER IF NOT EXISTS trg_${table}_ai_delete AFTER DELETE ON ${table}
          BEGIN SELECT ${functionName}(2, '${table}', OLD.rowid); END;
        `);
      } catch (err) {
        console.error(`[DB Trigger Fallback] Failed to create triggers for ${table}:`, err);
      }
    }
  }
}

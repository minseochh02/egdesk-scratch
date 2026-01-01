import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// ============================================
// Types
// ============================================

export interface ShinhanAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  customerName: string;
  balance: number;
  availableBalance: number;
  openDate: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

export interface ShinhanTransaction {
  id: string;
  accountId: string;
  date: string;
  time: string;
  type: string;
  withdrawal: number;
  deposit: number;
  description: string;
  balance: number;
  branch: string;
  rawRowIndex?: number;
  createdAt: string;
  metadata?: any;
}

export interface ShinhanSyncOperation {
  id: string;
  accountId: string;
  accountNumber: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  queryPeriodStart: string;
  queryPeriodEnd: string;
  totalCount: number;
  totalDeposits: number;
  depositCount: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  excelFilePath?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface CreateShinhanAccountData {
  accountNumber: string;
  accountName: string;
  customerName: string;
  balance?: number;
  availableBalance?: number;
  openDate?: string;
  metadata?: any;
}

export interface CreateShinhanTransactionData {
  accountId: string;
  date: string;
  time: string;
  type: string;
  withdrawal: number;
  deposit: number;
  description: string;
  balance: number;
  branch: string;
  rawRowIndex?: number;
  metadata?: any;
}

export interface CreateShinhanSyncOperationData {
  accountId: string;
  accountNumber: string;
  queryPeriodStart: string;
  queryPeriodEnd: string;
}

export interface TransactionQueryOptions {
  accountId?: string;
  accountNumber?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'date' | 'amount' | 'balance';
  orderDir?: 'asc' | 'desc';
}

export interface TransactionStats {
  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  avgDeposit: number;
  avgWithdrawal: number;
  maxDeposit: number;
  maxWithdrawal: number;
  startDate: string | null;
  endDate: string | null;
}

// ============================================
// Schema Initialization
// ============================================

export function initializeShinhanTransactionsSchema(db: Database.Database): void {
  // Create accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shinhan_accounts (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL UNIQUE,
      account_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      available_balance INTEGER DEFAULT 0,
      open_date TEXT,
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata TEXT
    )
  `);

  // Create transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shinhan_transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      type TEXT,
      withdrawal INTEGER DEFAULT 0,
      deposit INTEGER DEFAULT 0,
      description TEXT,
      balance INTEGER DEFAULT 0,
      branch TEXT,
      raw_row_index INTEGER,
      created_at TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (account_id) REFERENCES shinhan_accounts(id) ON DELETE CASCADE
    )
  `);

  // Create sync operations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shinhan_sync_operations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      account_number TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      query_period_start TEXT,
      query_period_end TEXT,
      total_count INTEGER DEFAULT 0,
      total_deposits INTEGER DEFAULT 0,
      deposit_count INTEGER DEFAULT 0,
      total_withdrawals INTEGER DEFAULT 0,
      withdrawal_count INTEGER DEFAULT 0,
      excel_file_path TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES shinhan_accounts(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shinhan_accounts_account_number 
      ON shinhan_accounts(account_number);
    
    CREATE INDEX IF NOT EXISTS idx_shinhan_transactions_account_id 
      ON shinhan_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_shinhan_transactions_date 
      ON shinhan_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_shinhan_transactions_type 
      ON shinhan_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_shinhan_transactions_account_date 
      ON shinhan_transactions(account_id, date);
    
    CREATE INDEX IF NOT EXISTS idx_shinhan_sync_operations_account_id 
      ON shinhan_sync_operations(account_id);
    CREATE INDEX IF NOT EXISTS idx_shinhan_sync_operations_status 
      ON shinhan_sync_operations(status);
    CREATE INDEX IF NOT EXISTS idx_shinhan_sync_operations_started_at 
      ON shinhan_sync_operations(started_at);
  `);

  // Create trigger for updated_at timestamp on accounts
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_shinhan_accounts_timestamp 
    AFTER UPDATE ON shinhan_accounts
    BEGIN
      UPDATE shinhan_accounts SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  console.log('✅ Shinhan transactions schema initialized');
}

// ============================================
// SQLite Shinhan Transactions Manager
// ============================================

export class SQLiteShinhanTransactionsManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // ============================================
  // Account Operations
  // ============================================

  /**
   * Create or update an account (upsert)
   */
  upsertAccount(data: CreateShinhanAccountData): ShinhanAccount {
    const now = new Date().toISOString();
    
    // Check if account exists
    const existing = this.getAccountByNumber(data.accountNumber);
    
    if (existing) {
      // Update existing account
      const stmt = this.db.prepare(`
        UPDATE shinhan_accounts 
        SET account_name = ?,
            customer_name = ?,
            balance = COALESCE(?, balance),
            available_balance = COALESCE(?, available_balance),
            open_date = COALESCE(?, open_date),
            last_synced_at = ?,
            metadata = COALESCE(?, metadata)
        WHERE id = ?
      `);

      stmt.run(
        data.accountName,
        data.customerName,
        data.balance ?? null,
        data.availableBalance ?? null,
        data.openDate ?? null,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null,
        existing.id
      );

      return this.getAccount(existing.id)!;
    } else {
      // Create new account
      const id = randomUUID();
      
      const stmt = this.db.prepare(`
        INSERT INTO shinhan_accounts (
          id, account_number, account_name, customer_name,
          balance, available_balance, open_date,
          last_synced_at, created_at, updated_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.accountNumber,
        data.accountName,
        data.customerName,
        data.balance ?? 0,
        data.availableBalance ?? 0,
        data.openDate ?? null,
        now,
        now,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      );

      return this.getAccount(id)!;
    }
  }

  /**
   * Get account by ID
   */
  getAccount(id: string): ShinhanAccount | null {
    const stmt = this.db.prepare(`SELECT * FROM shinhan_accounts WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToAccount(row);
  }

  /**
   * Get account by account number
   */
  getAccountByNumber(accountNumber: string): ShinhanAccount | null {
    const stmt = this.db.prepare(`SELECT * FROM shinhan_accounts WHERE account_number = ?`);
    const row = stmt.get(accountNumber) as any;
    if (!row) return null;
    return this.mapRowToAccount(row);
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): ShinhanAccount[] {
    const stmt = this.db.prepare(`
      SELECT * FROM shinhan_accounts 
      ORDER BY last_synced_at DESC, account_number ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToAccount(row));
  }

  /**
   * Delete account and all associated transactions
   */
  deleteAccount(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM shinhan_accounts WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ============================================
  // Transaction Operations
  // ============================================

  /**
   * Create a single transaction
   */
  createTransaction(data: CreateShinhanTransactionData): ShinhanTransaction {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO shinhan_transactions (
        id, account_id, date, time, type, withdrawal, deposit,
        description, balance, branch, raw_row_index, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.accountId,
      data.date,
      data.time || null,
      data.type || null,
      data.withdrawal || 0,
      data.deposit || 0,
      data.description || null,
      data.balance || 0,
      data.branch || null,
      data.rawRowIndex ?? null,
      now,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return this.getTransaction(id)!;
  }

  /**
   * Bulk insert transactions (optimized for large imports)
   */
  bulkInsertTransactions(accountId: string, transactions: Omit<CreateShinhanTransactionData, 'accountId'>[]): number {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO shinhan_transactions (
        id, account_id, date, time, type, withdrawal, deposit,
        description, balance, branch, raw_row_index, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((txns: typeof transactions) => {
      let inserted = 0;
      for (const tx of txns) {
        stmt.run(
          randomUUID(),
          accountId,
          tx.date,
          tx.time || null,
          tx.type || null,
          tx.withdrawal || 0,
          tx.deposit || 0,
          tx.description || null,
          tx.balance || 0,
          tx.branch || null,
          tx.rawRowIndex ?? null,
          now,
          tx.metadata ? JSON.stringify(tx.metadata) : null
        );
        inserted++;
      }
      return inserted;
    });

    return insertMany(transactions);
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): ShinhanTransaction | null {
    const stmt = this.db.prepare(`SELECT * FROM shinhan_transactions WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToTransaction(row);
  }

  /**
   * Query transactions with filters
   */
  queryTransactions(options: TransactionQueryOptions = {}): ShinhanTransaction[] {
    const {
      accountId,
      accountNumber,
      startDate,
      endDate,
      type,
      minAmount,
      maxAmount,
      limit = 100,
      offset = 0,
      orderBy = 'date',
      orderDir = 'desc'
    } = options;

    let query = `
      SELECT t.* FROM shinhan_transactions t
      LEFT JOIN shinhan_accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (accountId) {
      query += ` AND t.account_id = ?`;
      params.push(accountId);
    }

    if (accountNumber) {
      query += ` AND a.account_number = ?`;
      params.push(accountNumber);
    }

    if (startDate) {
      query += ` AND t.date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND t.date <= ?`;
      params.push(endDate);
    }

    if (type) {
      query += ` AND t.type = ?`;
      params.push(type);
    }

    if (minAmount !== undefined) {
      query += ` AND (t.deposit >= ? OR t.withdrawal >= ?)`;
      params.push(minAmount, minAmount);
    }

    if (maxAmount !== undefined) {
      query += ` AND (t.deposit <= ? AND t.withdrawal <= ?)`;
      params.push(maxAmount, maxAmount);
    }

    // Order by
    const orderColumn = orderBy === 'amount' 
      ? '(t.deposit + t.withdrawal)' 
      : orderBy === 'balance' 
        ? 't.balance' 
        : 't.date';
    query += ` ORDER BY ${orderColumn} ${orderDir.toUpperCase()}, t.time ${orderDir.toUpperCase()}`;

    // Pagination
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.mapRowToTransaction(row));
  }

  /**
   * Get transactions for an account
   */
  getTransactionsByAccount(accountId: string, limit: number = 100, offset: number = 0): ShinhanTransaction[] {
    return this.queryTransactions({ accountId, limit, offset });
  }

  /**
   * Get transactions by date range
   */
  getTransactionsByDateRange(
    accountId: string, 
    startDate: string, 
    endDate: string
  ): ShinhanTransaction[] {
    return this.queryTransactions({ 
      accountId, 
      startDate, 
      endDate, 
      limit: 10000 // Large limit for exports
    });
  }

  /**
   * Check if transaction already exists (for deduplication)
   */
  transactionExists(
    accountId: string, 
    date: string, 
    time: string, 
    withdrawal: number, 
    deposit: number, 
    balance: number
  ): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM shinhan_transactions 
      WHERE account_id = ? 
        AND date = ? 
        AND time = ? 
        AND withdrawal = ? 
        AND deposit = ? 
        AND balance = ?
      LIMIT 1
    `);
    const result = stmt.get(accountId, date, time, withdrawal, deposit, balance);
    return result !== undefined;
  }

  /**
   * Delete transactions by account
   */
  deleteTransactionsByAccount(accountId: string): number {
    const stmt = this.db.prepare(`DELETE FROM shinhan_transactions WHERE account_id = ?`);
    const result = stmt.run(accountId);
    return result.changes;
  }

  /**
   * Delete transactions by date range
   */
  deleteTransactionsByDateRange(
    accountId: string, 
    startDate: string, 
    endDate: string
  ): number {
    const stmt = this.db.prepare(`
      DELETE FROM shinhan_transactions 
      WHERE account_id = ? AND date >= ? AND date <= ?
    `);
    const result = stmt.run(accountId, startDate, endDate);
    return result.changes;
  }

  // ============================================
  // Sync Operation Tracking
  // ============================================

  /**
   * Create a new sync operation
   */
  createSyncOperation(data: CreateShinhanSyncOperationData): ShinhanSyncOperation {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO shinhan_sync_operations (
        id, account_id, account_number, status, started_at,
        query_period_start, query_period_end, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.accountId,
      data.accountNumber,
      'running',
      now,
      data.queryPeriodStart,
      data.queryPeriodEnd,
      now
    );

    return this.getSyncOperation(id)!;
  }

  /**
   * Complete a sync operation (success)
   */
  completeSyncOperation(
    id: string,
    results: {
      totalCount: number;
      totalDeposits: number;
      depositCount: number;
      totalWithdrawals: number;
      withdrawalCount: number;
      excelFilePath?: string;
    }
  ): ShinhanSyncOperation {
    const now = new Date().toISOString();
    const operation = this.getSyncOperation(id);
    
    if (!operation) {
      throw new Error(`Sync operation not found: ${id}`);
    }

    const duration = new Date(now).getTime() - new Date(operation.startedAt).getTime();

    const stmt = this.db.prepare(`
      UPDATE shinhan_sync_operations 
      SET status = 'completed',
          completed_at = ?,
          duration = ?,
          total_count = ?,
          total_deposits = ?,
          deposit_count = ?,
          total_withdrawals = ?,
          withdrawal_count = ?,
          excel_file_path = ?
      WHERE id = ?
    `);

    stmt.run(
      now,
      duration,
      results.totalCount,
      results.totalDeposits,
      results.depositCount,
      results.totalWithdrawals,
      results.withdrawalCount,
      results.excelFilePath ?? null,
      id
    );

    return this.getSyncOperation(id)!;
  }

  /**
   * Fail a sync operation
   */
  failSyncOperation(id: string, errorMessage: string): ShinhanSyncOperation {
    const now = new Date().toISOString();
    const operation = this.getSyncOperation(id);
    
    if (!operation) {
      throw new Error(`Sync operation not found: ${id}`);
    }

    const duration = new Date(now).getTime() - new Date(operation.startedAt).getTime();

    const stmt = this.db.prepare(`
      UPDATE shinhan_sync_operations 
      SET status = 'failed',
          completed_at = ?,
          duration = ?,
          error_message = ?
      WHERE id = ?
    `);

    stmt.run(now, duration, errorMessage, id);

    return this.getSyncOperation(id)!;
  }

  /**
   * Get sync operation by ID
   */
  getSyncOperation(id: string): ShinhanSyncOperation | null {
    const stmt = this.db.prepare(`SELECT * FROM shinhan_sync_operations WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToSyncOperation(row);
  }

  /**
   * Get sync operations by account
   */
  getSyncOperationsByAccount(accountId: string, limit: number = 50): ShinhanSyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM shinhan_sync_operations 
      WHERE account_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    const rows = stmt.all(accountId, limit) as any[];
    return rows.map(row => this.mapRowToSyncOperation(row));
  }

  /**
   * Get recent sync operations
   */
  getRecentSyncOperations(limit: number = 100): ShinhanSyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM shinhan_sync_operations 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapRowToSyncOperation(row));
  }

  // ============================================
  // Statistics & Analytics
  // ============================================

  /**
   * Get transaction statistics for an account
   */
  getTransactionStats(accountId: string, startDate?: string, endDate?: string): TransactionStats {
    let query = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdrawal), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END), 0) as deposit_count,
        COALESCE(SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END), 0) as withdrawal_count,
        COALESCE(AVG(CASE WHEN deposit > 0 THEN deposit END), 0) as avg_deposit,
        COALESCE(AVG(CASE WHEN withdrawal > 0 THEN withdrawal END), 0) as avg_withdrawal,
        COALESCE(MAX(deposit), 0) as max_deposit,
        COALESCE(MAX(withdrawal), 0) as max_withdrawal,
        MIN(date) as start_date,
        MAX(date) as end_date
      FROM shinhan_transactions 
      WHERE account_id = ?
    `;
    const params: any[] = [accountId];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as any;

    return {
      totalTransactions: row.total_transactions || 0,
      totalDeposits: row.total_deposits || 0,
      totalWithdrawals: row.total_withdrawals || 0,
      depositCount: row.deposit_count || 0,
      withdrawalCount: row.withdrawal_count || 0,
      avgDeposit: Math.round(row.avg_deposit || 0),
      avgWithdrawal: Math.round(row.avg_withdrawal || 0),
      maxDeposit: row.max_deposit || 0,
      maxWithdrawal: row.max_withdrawal || 0,
      startDate: row.start_date,
      endDate: row.end_date
    };
  }

  /**
   * Get monthly summary
   */
  getMonthlySummary(accountId: string, year?: number): Array<{
    yearMonth: string;
    depositCount: number;
    withdrawalCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netChange: number;
  }> {
    let query = `
      SELECT 
        substr(date, 1, 7) as year_month,
        SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END) as withdrawal_count,
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdrawal), 0) as total_withdrawals,
        COALESCE(SUM(deposit), 0) - COALESCE(SUM(withdrawal), 0) as net_change
      FROM shinhan_transactions 
      WHERE account_id = ?
    `;
    const params: any[] = [accountId];

    if (year) {
      query += ` AND substr(date, 1, 4) = ?`;
      params.push(year.toString());
    }

    query += ` GROUP BY year_month ORDER BY year_month DESC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      yearMonth: row.year_month,
      depositCount: row.deposit_count,
      withdrawalCount: row.withdrawal_count,
      totalDeposits: row.total_deposits,
      totalWithdrawals: row.total_withdrawals,
      netChange: row.net_change
    }));
  }

  /**
   * Get overall database stats
   */
  getOverallStats(): {
    totalAccounts: number;
    totalTransactions: number;
    totalSyncOperations: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSyncAt: string | null;
  } {
    const accountsStmt = this.db.prepare(`SELECT COUNT(*) as count FROM shinhan_accounts`);
    const txStmt = this.db.prepare(`SELECT COUNT(*) as count FROM shinhan_transactions`);
    const syncStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(completed_at) as last_sync
      FROM shinhan_sync_operations
    `);

    const accounts = (accountsStmt.get() as any).count;
    const transactions = (txStmt.get() as any).count;
    const sync = syncStmt.get() as any;

    return {
      totalAccounts: accounts,
      totalTransactions: transactions,
      totalSyncOperations: sync.total || 0,
      successfulSyncs: sync.successful || 0,
      failedSyncs: sync.failed || 0,
      lastSyncAt: sync.last_sync
    };
  }

  // ============================================
  // Data Import/Export
  // ============================================

  /**
   * Import transactions from parsed Excel data
   * Handles deduplication automatically
   */
  importFromParsedData(
    accountData: {
      accountNumber: string;
      accountName: string;
      customerName: string;
      balance: number;
      availableBalance: number;
      openDate: string;
    },
    transactions: Array<{
      date: string;
      time: string;
      type: string;
      withdrawal: number;
      deposit: number;
      description: string;
      balance: number;
      branch: string;
    }>,
    syncMetadata: {
      queryPeriodStart: string;
      queryPeriodEnd: string;
      excelFilePath?: string;
    }
  ): {
    account: ShinhanAccount;
    syncOperation: ShinhanSyncOperation;
    importedCount: number;
    skippedCount: number;
  } {
    // Upsert account
    const account = this.upsertAccount({
      accountNumber: accountData.accountNumber,
      accountName: accountData.accountName,
      customerName: accountData.customerName,
      balance: accountData.balance,
      availableBalance: accountData.availableBalance,
      openDate: accountData.openDate
    });

    // Create sync operation
    const syncOperation = this.createSyncOperation({
      accountId: account.id,
      accountNumber: account.accountNumber,
      queryPeriodStart: syncMetadata.queryPeriodStart,
      queryPeriodEnd: syncMetadata.queryPeriodEnd
    });

    // Filter out duplicates and import
    let importedCount = 0;
    let skippedCount = 0;

    const toImport: Array<Omit<CreateShinhanTransactionData, 'accountId'>> = [];

    for (const tx of transactions) {
      if (this.transactionExists(
        account.id,
        tx.date,
        tx.time,
        tx.withdrawal,
        tx.deposit,
        tx.balance
      )) {
        skippedCount++;
      } else {
        toImport.push({
          date: tx.date,
          time: tx.time,
          type: tx.type,
          withdrawal: tx.withdrawal,
          deposit: tx.deposit,
          description: tx.description,
          balance: tx.balance,
          branch: tx.branch
        });
      }
    }

    if (toImport.length > 0) {
      importedCount = this.bulkInsertTransactions(account.id, toImport);
    }

    // Calculate totals
    let totalDeposits = 0;
    let depositCount = 0;
    let totalWithdrawals = 0;
    let withdrawalCount = 0;

    for (const tx of transactions) {
      if (tx.deposit > 0) {
        totalDeposits += tx.deposit;
        depositCount++;
      }
      if (tx.withdrawal > 0) {
        totalWithdrawals += tx.withdrawal;
        withdrawalCount++;
      }
    }

    // Complete sync operation
    const completedSync = this.completeSyncOperation(syncOperation.id, {
      totalCount: transactions.length,
      totalDeposits,
      depositCount,
      totalWithdrawals,
      withdrawalCount,
      excelFilePath: syncMetadata.excelFilePath
    });

    return {
      account,
      syncOperation: completedSync,
      importedCount,
      skippedCount
    };
  }

  // ============================================
  // Cleanup Operations
  // ============================================

  /**
   * Clean up old sync operations
   */
  cleanupOldSyncOperations(daysToKeep: number = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const stmt = this.db.prepare(`
      DELETE FROM shinhan_sync_operations 
      WHERE created_at < ? AND status != 'running'
    `);
    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  /**
   * Clear all data (use with caution!)
   */
  clearAllData(): void {
    this.db.exec(`DELETE FROM shinhan_transactions`);
    this.db.exec(`DELETE FROM shinhan_sync_operations`);
    this.db.exec(`DELETE FROM shinhan_accounts`);
    console.log('⚠️ All Shinhan transaction data cleared');
  }

  // ============================================
  // Row Mapping Helpers
  // ============================================

  private mapRowToAccount(row: any): ShinhanAccount {
    return {
      id: row.id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      customerName: row.customer_name,
      balance: row.balance,
      availableBalance: row.available_balance,
      openDate: row.open_date,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private mapRowToTransaction(row: any): ShinhanTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      date: row.date,
      time: row.time,
      type: row.type,
      withdrawal: row.withdrawal,
      deposit: row.deposit,
      description: row.description,
      balance: row.balance,
      branch: row.branch,
      rawRowIndex: row.raw_row_index,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private mapRowToSyncOperation(row: any): ShinhanSyncOperation {
    return {
      id: row.id,
      accountId: row.account_id,
      accountNumber: row.account_number,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      queryPeriodStart: row.query_period_start,
      queryPeriodEnd: row.query_period_end,
      totalCount: row.total_count,
      totalDeposits: row.total_deposits,
      depositCount: row.deposit_count,
      totalWithdrawals: row.total_withdrawals,
      withdrawalCount: row.withdrawal_count,
      excelFilePath: row.excel_file_path,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}
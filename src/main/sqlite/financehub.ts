// ============================================
// FINANCE HUB - Unified Multi-Bank Database Schema
// ============================================
// Supports all Korean banks with a single flexible schema

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// ============================================
// Types (Bank-Agnostic)
// ============================================

export interface BankAccount {
  id: string;
  bankId: string;              // 'shinhan', 'kookmin', 'woori', 'hana', etc.
  accountNumber: string;
  accountName: string;
  customerName: string;
  balance: number;
  availableBalance: number;
  currency: string;            // 'KRW', 'USD', etc.
  accountType: string;         // 'checking', 'savings', 'deposit', etc.
  openDate: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any> | null;  // Bank-specific extra fields
}

export interface Transaction {
  id: string;
  accountId: string;
  bankId: string;              // Denormalized for faster queries
  date: string;                // YYYY-MM-DD format (deprecated, use datetime)
  time: string | null;         // HH:MM:SS format (deprecated, use datetime)
  transaction_datetime: string; // YYYY/MM/DD HH:MM:SS format (combined date and time)
  type: string;                // Bank-specific transaction type
  category: string | null;     // AI-classified category
  withdrawal: number;
  deposit: number;
  description: string;
  memo: string | null;
  balance: number;
  branch: string | null;
  counterparty: string | null; // 상대방 (for transfers)
  transactionId: string | null; // Bank's own transaction ID if available
  createdAt: string;
  metadata: Record<string, any> | null;
}

export interface SyncOperation {
  id: string;
  accountId: string;
  bankId: string;
  status: 'running' | 'completed' | 'failed';
  syncType: 'full' | 'incremental';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  queryPeriodStart: string;
  queryPeriodEnd: string;
  totalCount: number;
  newCount: number;            // Newly inserted
  skippedCount: number;        // Duplicates skipped
  totalDeposits: number;
  depositCount: number;
  totalWithdrawals: number;
  withdrawalCount: number;
  filePath: string | null;     // Excel/CSV export path
  errorMessage: string | null;
  createdAt: string;
}

// Bank registry for validation and metadata
export interface BankInfo {
  id: string;
  name: string;
  nameKo: string;
  color: string;
  icon: string;
  supportsAutomation: boolean;
}

// ============================================
// Schema Initialization
// ============================================

export function initializeFinanceHubSchema(db: Database.Database): void {
  // ========================================
  // 1. Banks Registry Table
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS banks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_ko TEXT NOT NULL,
      color TEXT DEFAULT '#0046FF',
      icon TEXT DEFAULT '🏦',
      supports_automation INTEGER DEFAULT 0,
      login_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    )
  `);

  // Seed default Korean banks
  const seedBanks = db.prepare(`
    INSERT OR IGNORE INTO banks (id, name, name_ko, color, icon, supports_automation, login_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const koreanBanks = [
    ['shinhan', 'Shinhan Bank', '신한은행', '#0046FF', '🏦', 1, 'https://bank.shinhan.com/'],
    ['kookmin', 'KB Kookmin Bank', 'KB국민은행', '#FFBC00', '⭐', 0, 'https://www.kbstar.com/'],
    ['woori', 'Woori Bank', '우리은행', '#0072BC', '🏛️', 0, 'https://www.wooribank.com/'],
    ['hana', 'Hana Bank', '하나은행', '#009775', '🌿', 0, 'https://www.kebhana.com/'],
    ['nh', 'NH Bank', 'NH농협은행', '#00B140', '🌾', 0, 'https://banking.nonghyup.com/'],
    ['nh-business', 'NH Business Bank', 'NH농협은행(법인)', '#00B140', '🌾', 1, 'https://banking.nonghyup.com/'],
    ['ibk', 'IBK Bank', 'IBK기업은행', '#004A98', '🏢', 0, 'https://www.ibk.co.kr/'],
    ['kakao', 'Kakao Bank', '카카오뱅크', '#FFEB00', '💬', 0, null],
    ['toss', 'Toss Bank', '토스뱅크', '#0064FF', '💸', 0, null],
  ];

  // Seed card companies (stored in same table as banks)
  const cardCompanies = [
    ['nh-card', 'NH Card', 'NH농협카드', '#00B140', '💳', 1, 'https://card.nonghyup.com/'],
    ['bc-card', 'BC Card', 'BC카드', '#E20613', '💳', 1, 'https://wisebiz.bccard.com/app/corp/Intro.corp'],
    ['shinhan-card', 'Shinhan Card', '신한카드', '#0046FF', '💳', 1, 'https://www.shinhancard.com/'],
    ['kb-card', 'KB Card', 'KB국민카드', '#FFBC00', '💳', 0, 'https://www.kbcard.com/'],
    ['samsung-card', 'Samsung Card', '삼성카드', '#1428A0', '💳', 0, 'https://www.samsungcard.com/'],
    ['hyundai-card', 'Hyundai Card', '현대카드', '#000000', '💳', 0, 'https://www.hyundaicard.com/'],
  ];

  for (const bank of koreanBanks) {
    seedBanks.run(...bank);
  }

  for (const card of cardCompanies) {
    seedBanks.run(...card);
  }

  // ========================================
  // 2. Accounts Table (Multi-Bank)
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_name TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      balance INTEGER DEFAULT 0,
      available_balance INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'KRW',
      account_type TEXT DEFAULT 'checking',
      open_date TEXT,
      last_synced_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT,
      
      FOREIGN KEY (bank_id) REFERENCES banks(id),
      UNIQUE(bank_id, account_number)
    )
  `);

  // ========================================
  // 3. Transactions Table (Multi-Bank)
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      transaction_datetime TEXT,
      type TEXT,
      category TEXT,
      withdrawal INTEGER DEFAULT 0,
      deposit INTEGER DEFAULT 0,
      description TEXT,
      memo TEXT,
      balance INTEGER DEFAULT 0,
      branch TEXT,
      counterparty TEXT,
      transaction_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT,

      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_id) REFERENCES banks(id)
    )
  `);

  // ========================================
  // 4. Sync Operations Table
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_operations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      bank_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      sync_type TEXT DEFAULT 'full' CHECK (sync_type IN ('full', 'incremental')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      query_period_start TEXT,
      query_period_end TEXT,
      total_count INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      total_deposits INTEGER DEFAULT 0,
      deposit_count INTEGER DEFAULT 0,
      total_withdrawals INTEGER DEFAULT 0,
      withdrawal_count INTEGER DEFAULT 0,
      file_path TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_id) REFERENCES banks(id)
    )
  `);

  // ========================================
  // 5. Saved Credentials Table (Encrypted)
  // ========================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_credentials (
      id TEXT PRIMARY KEY,
      bank_id TEXT NOT NULL UNIQUE,
      user_id_encrypted TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      encryption_iv TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (bank_id) REFERENCES banks(id)
    )
  `);

  // ========================================
  // 6. Scheduler Execution History Table
  // ========================================
  // Tracks FinanceHub scheduler executions for recovery system
  db.exec(`
    CREATE TABLE IF NOT EXISTS financehub_scheduler_executions (
      id TEXT PRIMARY KEY,
      execution_type TEXT NOT NULL CHECK (execution_type IN ('bank_sync', 'tax_sync', 'combined')),
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration INTEGER,
      bank_sync_results TEXT,
      tax_sync_results TEXT,
      total_accounts_synced INTEGER DEFAULT 0,
      total_transactions_synced INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ========================================
  // 7. Indexes for Performance
  // ========================================
  db.exec(`
    -- Account indexes
    CREATE INDEX IF NOT EXISTS idx_accounts_bank_id ON accounts(bank_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
    CREATE INDEX IF NOT EXISTS idx_accounts_bank_account ON accounts(bank_id, account_number);

    -- Transaction indexes (critical for performance)
    CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_bank_id ON transactions(bank_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

    -- Legacy date index for backward compatibility
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  `);

  // Create transaction_datetime-related indexes separately (handled by migration 006)
  // These are created in the migration to avoid issues with column not existing yet

  db.exec(`
    -- Sync operation indexes
    CREATE INDEX IF NOT EXISTS idx_sync_operations_account_id ON sync_operations(account_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_bank_id ON sync_operations(bank_id);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_started_at ON sync_operations(started_at);

    -- Scheduler execution history indexes
    CREATE INDEX IF NOT EXISTS idx_fh_exec_date ON financehub_scheduler_executions(DATE(started_at));
    CREATE INDEX IF NOT EXISTS idx_fh_exec_status ON financehub_scheduler_executions(status);
    CREATE INDEX IF NOT EXISTS idx_fh_exec_started_at ON financehub_scheduler_executions(started_at);
  `);

  // ========================================
  // 8. Triggers for updated_at
  // ========================================
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_accounts_timestamp
    AFTER UPDATE ON accounts
    BEGIN
      UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_credentials_timestamp
    AFTER UPDATE ON saved_credentials
    BEGIN
      UPDATE saved_credentials SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  // Migration: Ensure BC Card exists in existing databases
  const ensureBCCard = db.prepare(`
    INSERT OR IGNORE INTO banks (id, name, name_ko, color, icon, supports_automation, login_url)
    VALUES ('bc-card', 'BC Card', 'BC카드', '#E20613', '💳', 1, 'https://wisebiz.bccard.com/app/corp/Intro.corp')
  `);
  ensureBCCard.run();

  // Migration: Ensure Shinhan Card exists and enable automation
  const ensureShinhanCard = db.prepare(`
    INSERT OR IGNORE INTO banks (id, name, name_ko, color, icon, supports_automation, login_url)
    VALUES ('shinhan-card', 'Shinhan Card', '신한카드', '#0046FF', '💳', 1, 'https://www.shinhancard.com/')
  `);
  ensureShinhanCard.run();

  // Update existing Shinhan Card entries to enable automation
  const updateShinhanCard = db.prepare(`
    UPDATE banks SET supports_automation = 1 WHERE id = 'shinhan-card'
  `);
  updateShinhanCard.run();

  console.log('✅ Finance Hub multi-bank schema initialized');
}

// ============================================
// Finance Hub Database Manager
// ============================================

export class FinanceHubDbManager {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // ========================================
  // Bank Operations
  // ========================================

  getAllBanks(): BankInfo[] {
    const stmt = this.db.prepare(`SELECT * FROM banks ORDER BY name_ko`);
    return stmt.all().map((row: any) => ({
      id: row.id,
      name: row.name,
      nameKo: row.name_ko,
      color: row.color,
      icon: row.icon,
      supportsAutomation: !!row.supports_automation,
    }));
  }

  getBank(bankId: string): BankInfo | null {
    const stmt = this.db.prepare(`SELECT * FROM banks WHERE id = ?`);
    const row = stmt.get(bankId) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      nameKo: row.name_ko,
      color: row.color,
      icon: row.icon,
      supportsAutomation: !!row.supports_automation,
    };
  }

  // ========================================
  // Account Operations (Multi-Bank)
  // ========================================

  upsertAccount(data: {
    bankId: string;
    accountNumber: string;
    accountName?: string;
    customerName?: string;
    balance?: number;
    availableBalance?: number;
    currency?: string;
    accountType?: string;
    openDate?: string;
    metadata?: Record<string, any>;
  }): BankAccount {
    const now = new Date().toISOString();
    
    // Check if exists
    const existing = this.getAccountByNumber(data.bankId, data.accountNumber);
    
    if (existing) {
      // Update
      const stmt = this.db.prepare(`
        UPDATE accounts SET
          account_name = COALESCE(?, account_name),
          customer_name = COALESCE(?, customer_name),
          balance = COALESCE(?, balance),
          available_balance = COALESCE(?, available_balance),
          currency = COALESCE(?, currency),
          account_type = COALESCE(?, account_type),
          open_date = COALESCE(?, open_date),
          last_synced_at = ?,
          metadata = COALESCE(?, metadata)
        WHERE id = ?
      `);
      
      stmt.run(
        data.accountName ?? null,
        data.customerName ?? null,
        data.balance ?? null,
        data.availableBalance ?? null,
        data.currency ?? null,
        data.accountType ?? null,
        data.openDate ?? null,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null,
        existing.id
      );
      
      return this.getAccount(existing.id)!;
    } else {
      // Insert
      const id = randomUUID();
      const stmt = this.db.prepare(`
        INSERT INTO accounts (
          id, bank_id, account_number, account_name, customer_name,
          balance, available_balance, currency, account_type, open_date,
          last_synced_at, created_at, updated_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        data.bankId,
        data.accountNumber,
        data.accountName || '',
        data.customerName || '',
        data.balance || 0,
        data.availableBalance || 0,
        data.currency || 'KRW',
        data.accountType || 'checking',
        data.openDate || null,
        now,
        now,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      );
      
      return this.getAccount(id)!;
    }
  }

  getAccount(id: string): BankAccount | null {
    const stmt = this.db.prepare(`SELECT * FROM accounts WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToAccount(row);
  }

  getAccountByNumber(bankId: string, accountNumber: string): BankAccount | null {
    const stmt = this.db.prepare(`
      SELECT * FROM accounts WHERE bank_id = ? AND account_number = ?
    `);
    const row = stmt.get(bankId, accountNumber) as any;
    if (!row) return null;
    return this.mapRowToAccount(row);
  }

  getAccountsByBank(bankId: string): BankAccount[] {
    const stmt = this.db.prepare(`
      SELECT * FROM accounts WHERE bank_id = ? AND is_active = 1
      ORDER BY account_number
    `);
    return stmt.all(bankId).map((row: any) => this.mapRowToAccount(row));
  }

  getAllAccounts(): BankAccount[] {
    const stmt = this.db.prepare(`
      SELECT * FROM accounts 
      ORDER BY bank_id, account_number
    `);
    return stmt.all().map((row: any) => this.mapRowToAccount(row));
  }

  updateAccountStatus(accountNumber: string, isActive: boolean): boolean {
    const stmt = this.db.prepare(`
      UPDATE accounts 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE account_number = ?
    `);
    
    const result = stmt.run(isActive ? 1 : 0, accountNumber);
    return result.changes > 0;
  }

  deleteAccount(accountNumber: string): boolean {
    // Start a transaction to ensure data integrity
    const deleteTransactions = this.db.prepare(`
      DELETE FROM transactions 
      WHERE account_id IN (SELECT id FROM accounts WHERE account_number = ?)
    `);
    
    const deleteAccount = this.db.prepare(`
      DELETE FROM accounts WHERE account_number = ?
    `);
    
    const transaction = this.db.transaction(() => {
      deleteTransactions.run(accountNumber);
      const result = deleteAccount.run(accountNumber);
      return result.changes > 0;
    });
    
    return transaction();
  }

  // ========================================
  // Transaction Operations (Multi-Bank)
  // ========================================

  bulkInsertTransactions(
    accountId: string,
    bankId: string,
    transactions: Array<{
      date: string;
      time?: string;
      transaction_datetime?: string;
      type?: string;
      category?: string;
      withdrawal?: number;
      deposit?: number;
      description?: string;
      memo?: string;
      balance?: number;
      branch?: string;
      counterparty?: string;
      transactionId?: string;
      metadata?: Record<string, any>;
    }>
  ): { inserted: number; skipped: number } {
    const now = new Date().toISOString();
    
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO transactions (
        id, account_id, bank_id, date, time, transaction_datetime, type, category,
        withdrawal, deposit, description, memo, balance,
        branch, counterparty, transaction_id, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    const insertMany = this.db.transaction((txns: typeof transactions) => {
      for (const tx of txns) {
        // Ensure numeric values are actual numbers to prevent data corruption
        const withdrawal = Number(tx.withdrawal) || 0;
        const deposit = Number(tx.deposit) || 0;
        const balance = Number(tx.balance) || 0;

        // Generate transaction_datetime if not provided
        const transactionDatetime = tx.transaction_datetime ||
          (tx.date && tx.time ? tx.date.replace(/-/g, '/') + ' ' + tx.time : tx.date.replace(/-/g, '/'));

        const result = insertStmt.run(
          randomUUID(),
          accountId,
          bankId,
          tx.date,
          tx.time || null,
          transactionDatetime || null,
          tx.type || null,
          tx.category || null,
          withdrawal,
          deposit,
          tx.description || null,
          tx.memo || null,
          balance,
          tx.branch || null,
          tx.counterparty || null,
          tx.transactionId || null,
          now,
          tx.metadata ? JSON.stringify(tx.metadata) : null
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
          // Log first few duplicates for debugging
          if (skipped <= 3) {
            console.log(`[FinanceHub] Duplicate detected: account=${accountId}, datetime=${transactionDatetime}, withdrawal=${withdrawal}, deposit=${deposit}, balance=${balance}`);
          }
        }
      }
    });

    insertMany(transactions);
    return { inserted, skipped };
  }

  queryTransactions(options: {
    accountId?: string;
    bankId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    searchText?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'date' | 'amount' | 'balance';
    orderDir?: 'asc' | 'desc';
  } = {}): Transaction[] {
    const {
      accountId,
      bankId,
      startDate,
      endDate,
      category,
      minAmount,
      maxAmount,
      searchText,
      limit = 100,
      offset = 0,
      orderBy = 'date',
      orderDir = 'desc'
    } = options;

    let query = `SELECT * FROM transactions WHERE 1=1`;
    const params: any[] = [];

    if (accountId) {
      query += ` AND account_id = ?`;
      params.push(accountId);
    }

    if (bankId) {
      query += ` AND bank_id = ?`;
      params.push(bankId);
    }

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (minAmount !== undefined) {
      query += ` AND (deposit >= ? OR withdrawal >= ?)`;
      params.push(minAmount, minAmount);
    }

    if (maxAmount !== undefined) {
      query += ` AND deposit <= ? AND withdrawal <= ?`;
      params.push(maxAmount, maxAmount);
    }

    if (searchText) {
      query += ` AND (description LIKE ? OR memo LIKE ? OR counterparty LIKE ?)`;
      const pattern = `%${searchText}%`;
      params.push(pattern, pattern, pattern);
    }

    // Order
    const orderColumn = orderBy === 'amount' 
      ? '(deposit + withdrawal)' 
      : orderBy === 'balance' 
        ? 'balance' 
        : 'date';
    query += ` ORDER BY ${orderColumn} ${orderDir.toUpperCase()}`;
    if (orderBy === 'date') {
      query += `, time ${orderDir.toUpperCase()}`;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => this.mapRowToTransaction(row));
  }

  // ========================================
  // Statistics (Cross-Bank)
  // ========================================

  getTransactionStats(options: {
    accountId?: string;
    bankId?: string;
    startDate?: string;
    endDate?: string;
  } = {}): {
    totalTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
    depositCount: number;
    withdrawalCount: number;
    netChange: number;
  } {
    let query = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdrawal), 0) as total_withdrawals,
        SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END) as withdrawal_count
      FROM transactions WHERE 1=1
    `;
    const params: any[] = [];

    if (options.accountId) {
      query += ` AND account_id = ?`;
      params.push(options.accountId);
    }
    if (options.bankId) {
      query += ` AND bank_id = ?`;
      params.push(options.bankId);
    }
    if (options.startDate) {
      query += ` AND date >= ?`;
      params.push(options.startDate);
    }
    if (options.endDate) {
      query += ` AND date <= ?`;
      params.push(options.endDate);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as any;

    return {
      totalTransactions: row.total_transactions || 0,
      totalDeposits: row.total_deposits || 0,
      totalWithdrawals: row.total_withdrawals || 0,
      depositCount: row.deposit_count || 0,
      withdrawalCount: row.withdrawal_count || 0,
      netChange: (row.total_deposits || 0) - (row.total_withdrawals || 0),
    };
  }

  getMonthlySummary(options: {
    accountId?: string;
    bankId?: string;
    year?: number;
    months?: number;  // How many months to return
  } = {}): Array<{
    yearMonth: string;
    bankId: string;
    depositCount: number;
    withdrawalCount: number;
    totalDeposits: number;
    totalWithdrawals: number;
    netChange: number;
  }> {
    let query = `
      SELECT 
        substr(date, 1, 7) as year_month,
        bank_id,
        SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END) as deposit_count,
        SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END) as withdrawal_count,
        COALESCE(SUM(deposit), 0) as total_deposits,
        COALESCE(SUM(withdrawal), 0) as total_withdrawals
      FROM transactions WHERE 1=1
    `;
    const params: any[] = [];

    if (options.accountId) {
      query += ` AND account_id = ?`;
      params.push(options.accountId);
    }
    if (options.bankId) {
      query += ` AND bank_id = ?`;
      params.push(options.bankId);
    }
    if (options.year) {
      query += ` AND substr(date, 1, 4) = ?`;
      params.push(options.year.toString());
    }

    query += ` GROUP BY year_month, bank_id ORDER BY year_month DESC`;

    if (options.months) {
      query += ` LIMIT ?`;
      params.push(options.months);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => ({
      yearMonth: row.year_month,
      bankId: row.bank_id,
      depositCount: row.deposit_count,
      withdrawalCount: row.withdrawal_count,
      totalDeposits: row.total_deposits,
      totalWithdrawals: row.total_withdrawals,
      netChange: row.total_deposits - row.total_withdrawals,
    }));
  }

  getOverallStats(): {
    totalBanks: number;
    totalAccounts: number;
    totalTransactions: number;
    totalBalance: number;
    bankBreakdown: Array<{
      bankId: string;
      bankName: string;
      accountCount: number;
      transactionCount: number;
      totalBalance: number;
    }>;
  } {
    const bankBreakdownStmt = this.db.prepare(`
      SELECT 
        b.id as bank_id,
        b.name_ko as bank_name,
        COUNT(DISTINCT a.id) as account_count,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(DISTINCT a.balance), 0) as total_balance
      FROM banks b
      LEFT JOIN accounts a ON b.id = a.bank_id AND a.is_active = 1
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY b.id
      HAVING account_count > 0
      ORDER BY account_count DESC
    `);

    const breakdown = bankBreakdownStmt.all().map((row: any) => ({
      bankId: row.bank_id,
      bankName: row.bank_name,
      accountCount: row.account_count,
      transactionCount: row.transaction_count,
      totalBalance: row.total_balance,
    }));

    return {
      totalBanks: breakdown.length,
      totalAccounts: breakdown.reduce((sum, b) => sum + b.accountCount, 0),
      totalTransactions: breakdown.reduce((sum, b) => sum + b.transactionCount, 0),
      totalBalance: breakdown.reduce((sum, b) => sum + b.totalBalance, 0),
      bankBreakdown: breakdown,
    };
  }

  /**
   * Query card transactions for export with filtering
   * Used by card export functionality to generate Excel files
   */
  exportCardTransactions(options: {
    accountId?: string;
    cardCompanyId?: string;
    startDate?: string;
    endDate?: string;
    includeRefunds?: boolean;
  } = {}): Array<Transaction & { account_name: string; customer_name: string; bank_id: string }> {
    let query = `
      SELECT
        t.*,
        a.account_name,
        a.customer_name,
        a.bank_id
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE json_extract(t.metadata, '$.isCardTransaction') = 1
    `;

    const params: any[] = [];

    if (options.accountId) {
      query += ` AND t.account_id = ?`;
      params.push(options.accountId);
    }

    if (options.cardCompanyId) {
      query += ` AND t.bank_id = ?`;
      params.push(options.cardCompanyId);
    }

    if (options.startDate) {
      query += ` AND t.date >= ?`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ` AND t.date <= ?`;
      params.push(options.endDate);
    }

    if (options.includeRefunds === false) {
      query += ` AND (json_extract(t.metadata, '$.isCancelled') IS NULL OR json_extract(t.metadata, '$.isCancelled') != 1)`;
    }

    query += ` ORDER BY t.date DESC, t.time DESC`;

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as any[];
  }

  // ========================================
  // Sync Operations
  // ========================================

  createSyncOperation(data: {
    accountId: string;
    bankId: string;
    syncType?: 'full' | 'incremental';
    queryPeriodStart: string;
    queryPeriodEnd: string;
  }): SyncOperation {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_operations (
        id, account_id, bank_id, status, sync_type,
        started_at, query_period_start, query_period_end, created_at
      ) VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.accountId,
      data.bankId,
      data.syncType || 'full',
      now,
      data.queryPeriodStart,
      data.queryPeriodEnd,
      now
    );

    return this.getSyncOperation(id)!;
  }

  completeSyncOperation(id: string, results: {
    totalCount: number;
    newCount: number;
    skippedCount: number;
    totalDeposits: number;
    depositCount: number;
    totalWithdrawals: number;
    withdrawalCount: number;
    filePath?: string;
  }): SyncOperation {
    const now = new Date().toISOString();
    const op = this.getSyncOperation(id);
    if (!op) throw new Error(`Sync operation not found: ${id}`);

    const duration = new Date(now).getTime() - new Date(op.startedAt).getTime();

    // Ensure all numeric values are actual numbers to prevent data corruption
    const safeResults = {
      totalCount: Number(results.totalCount) || 0,
      newCount: Number(results.newCount) || 0,
      skippedCount: Number(results.skippedCount) || 0,
      totalDeposits: Number(results.totalDeposits) || 0,
      depositCount: Number(results.depositCount) || 0,
      totalWithdrawals: Number(results.totalWithdrawals) || 0,
      withdrawalCount: Number(results.withdrawalCount) || 0,
    };

    const stmt = this.db.prepare(`
      UPDATE sync_operations SET
        status = 'completed',
        completed_at = ?,
        duration = ?,
        total_count = ?,
        new_count = ?,
        skipped_count = ?,
        total_deposits = ?,
        deposit_count = ?,
        total_withdrawals = ?,
        withdrawal_count = ?,
        file_path = ?
      WHERE id = ?
    `);

    stmt.run(
      now, duration,
      safeResults.totalCount, safeResults.newCount, safeResults.skippedCount,
      safeResults.totalDeposits, safeResults.depositCount,
      safeResults.totalWithdrawals, safeResults.withdrawalCount,
      results.filePath || null,
      id
    );

    return this.getSyncOperation(id)!;
  }

  failSyncOperation(id: string, errorMessage: string): SyncOperation {
    const now = new Date().toISOString();
    const op = this.getSyncOperation(id);
    if (!op) throw new Error(`Sync operation not found: ${id}`);

    const duration = new Date(now).getTime() - new Date(op.startedAt).getTime();

    const stmt = this.db.prepare(`
      UPDATE sync_operations SET
        status = 'failed',
        completed_at = ?,
        duration = ?,
        error_message = ?
      WHERE id = ?
    `);

    stmt.run(now, duration, errorMessage, id);
    return this.getSyncOperation(id)!;
  }

  getSyncOperation(id: string): SyncOperation | null {
    const stmt = this.db.prepare(`SELECT * FROM sync_operations WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRowToSyncOperation(row);
  }

  getRecentSyncOperations(limit: number = 50): SyncOperation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_operations 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit).map((row: any) => this.mapRowToSyncOperation(row));
  }

  // ========================================
  // High-Level Import Method
  // ========================================

  /**
   * Import transactions from any bank's parsed data
   * Handles account upsert, deduplication, and sync tracking
   */
  importTransactions(
    bankId: string,
    accountData: {
      accountNumber: string;
      accountName?: string;
      customerName?: string;
      balance?: number;
      availableBalance?: number;
      openDate?: string;
    },
    transactions: Array<{
      date?: string;
      time?: string;
      transaction_datetime?: string;
      type?: string;
      withdrawal?: number;
      deposit?: number;
      description?: string;
      memo?: string;
      balance?: number;
      branch?: string;
      counterparty?: string;
      // Card-specific fields (will be transformed)
      dateTime?: string;
      amount?: string;
      merchantName?: string;
      approvalNumber?: string;
      transactionMethod?: string;
      installmentPeriod?: string;
      cancellationStatus?: string;
      cardNumber?: string;
      xmlData?: string;
    }>,
    syncMetadata: {
      queryPeriodStart: string;
      queryPeriodEnd: string;
      filePath?: string;
    },
    isCard: boolean = false
  ): {
    account: BankAccount;
    syncOperation: SyncOperation;
    inserted: number;
    skipped: number;
  } {
    // 1. Transform card transactions if needed
    // Auto-detect cards by bankId (bc-card, nh-card, kb-card, etc.)
    const isCardTransaction = isCard || bankId.includes('-card');

    let transformedTransactions = transactions;
    if (isCardTransaction) {
      const { transformCardTransaction } = require('../financehub/utils/cardTransactionMapper');
      transformedTransactions = transactions.map(tx =>
        transformCardTransaction(tx, null, bankId) // accountId handled by bulkInsertTransactions
      );
    }

    // 2. Upsert account
    const account = this.upsertAccount({
      bankId,
      ...accountData,
    });

    // 3. Create sync operation
    const syncOp = this.createSyncOperation({
      accountId: account.id,
      bankId,
      queryPeriodStart: syncMetadata.queryPeriodStart,
      queryPeriodEnd: syncMetadata.queryPeriodEnd,
    });

    try {
      // 4. Bulk insert transactions (with dedup via UNIQUE index)
      const { inserted, skipped } = this.bulkInsertTransactions(
        account.id,
        bankId,
        transformedTransactions
      );

      // 4. Calculate totals (ensure numbers to prevent string concatenation)
      let totalDeposits = 0, depositCount = 0;
      let totalWithdrawals = 0, withdrawalCount = 0;

      for (const tx of transactions) {
        const depositAmount = Number(tx.deposit) || 0;
        const withdrawalAmount = Number(tx.withdrawal) || 0;

        if (depositAmount > 0) {
          totalDeposits += depositAmount;
          depositCount++;
        }
        if (withdrawalAmount > 0) {
          totalWithdrawals += withdrawalAmount;
          withdrawalCount++;
        }
      }

      // 5. Complete sync
      const completedSync = this.completeSyncOperation(syncOp.id, {
        totalCount: transactions.length,
        newCount: inserted,
        skippedCount: skipped,
        totalDeposits,
        depositCount,
        totalWithdrawals,
        withdrawalCount,
        filePath: syncMetadata.filePath,
      });

      return {
        account,
        syncOperation: completedSync,
        inserted,
        skipped,
      };
    } catch (error) {
      // Fail sync on error
      this.failSyncOperation(syncOp.id, (error as Error).message);
      throw error;
    }
  }

  // ========================================
  // Row Mappers
  // ========================================

  private mapRowToAccount(row: any): BankAccount {
    return {
      id: row.id,
      bankId: row.bank_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      customerName: row.customer_name,
      balance: row.balance,
      availableBalance: row.available_balance,
      currency: row.currency,
      accountType: row.account_type,
      openDate: row.open_date,
      lastSyncedAt: row.last_synced_at,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }

  private mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      accountId: row.account_id,
      bankId: row.bank_id,
      date: row.date,
      time: row.time,
      transaction_datetime: row.transaction_datetime || (row.date && row.time ? row.date.replace(/-/g, '/') + ' ' + row.time : row.date),
      type: row.type,
      category: row.category,
      withdrawal: row.withdrawal,
      deposit: row.deposit,
      description: row.description,
      memo: row.memo,
      balance: row.balance,
      branch: row.branch,
      counterparty: row.counterparty,
      transactionId: row.transaction_id,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }

  private mapRowToSyncOperation(row: any): SyncOperation {
    return {
      id: row.id,
      accountId: row.account_id,
      bankId: row.bank_id,
      status: row.status,
      syncType: row.sync_type,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      queryPeriodStart: row.query_period_start,
      queryPeriodEnd: row.query_period_end,
      totalCount: row.total_count,
      newCount: row.new_count,
      skippedCount: row.skipped_count,
      totalDeposits: row.total_deposits,
      depositCount: row.deposit_count,
      totalWithdrawals: row.total_withdrawals,
      withdrawalCount: row.withdrawal_count,
      filePath: row.file_path,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
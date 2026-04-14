// ============================================
// FINANCE HUB - Unified Multi-Bank Database Schema
// ============================================
// Supports all Korean banks with a single flexible schema

import path from 'path';
import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import { getTaxInvoices, getCashReceipts } from './hometax';

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

// New separate transaction types for Korean financial reporting
export interface BankTransaction {
  id: string;
  accountId: string;
  bankId: string;
  // 거래일자, 거래시간
  transactionDate: string;       // YYYY-MM-DD
  transactionTime: string | null; // HH:MM:SS
  transactionDatetime: string;   // Combined for sorting
  // 은행, 계좌번호, 계좌별칭
  accountNumber: string | null;
  accountName: string | null;
  // 입금, 출금, 잔액
  deposit: number;
  withdrawal: number;
  balance: number;
  // 취급지점, 상대계좌, 상대계좌예금주명
  branch: string | null;
  counterpartyAccount: string | null;
  counterpartyName: string | null;
  // 적요1, 적요2
  description: string | null;
  description2: string | null;
  // 비고, 수기
  memo: string | null;
  isManual: boolean;
  // System fields
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardTransaction {
  id: string;
  accountId: string;
  // 카드사
  cardCompanyId: string;
  // 본부명, 부서명 (BC Card specific)
  headquartersName: string | null;
  departmentName: string | null;
  // 카드번호, 카드구분, 카드소지자
  cardNumber: string;
  cardType: string | null;        // 개인/법인
  cardholderName: string | null;
  // 거래은행, 사용구분, 매출종류
  transactionBank: string | null;
  usageType: string | null;       // 일시불/할부
  salesType: string | null;       // 일반매출/취소
  // 접수일자/(승인일자), 청구일자
  approvalDatetime: string;       // YYYY/MM/DD HH:MM:SS
  approvalDate: string;           // YYYY-MM-DD (for indexing)
  billingDate: string | null;
  // 승인번호, 가맹점명/국가명(도시명), 이용금액
  approvalNumber: string | null;
  merchantName: string;
  amount: number;
  // (US $)
  foreignAmountUsd: number | null;
  // 비고
  memo: string | null;
  // System fields
  category: string | null;
  isCancelled: boolean;
  createdAt: string;
  updatedAt: string;
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
    ['hana-card', 'Hana Card', '하나카드', '#009775', '💳', 1, 'https://www.hanacard.co.kr/'],
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
      metadata TEXT,
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

  // Migration: Add metadata column to saved_credentials if it doesn't exist
  try {
    db.exec(`ALTER TABLE saved_credentials ADD COLUMN metadata TEXT`);
    console.log('✅ Added metadata column to saved_credentials table');
  } catch (e) {
    // Column already exists, ignore
  }

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

  // Migration: Ensure Hana Card exists in existing databases
  const ensureHanaCard = db.prepare(`
    INSERT OR IGNORE INTO banks (id, name, name_ko, color, icon, supports_automation, login_url)
    VALUES ('hana-card', 'Hana Card', '하나카드', '#009775', '💳', 1, 'https://www.hanacard.co.kr/')
  `);
  ensureHanaCard.run();

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

  /**
   * Feature flag: Check if separate transaction tables should be used
   *
   * DEFAULT: ON (uses separate bank_transactions and card_transactions tables)
   * To rollback to unified transactions table, set USE_SEPARATE_TRANSACTION_TABLES=false
   */
  private useSeparateTransactionTables(): boolean {
    return process.env.USE_SEPARATE_TRANSACTION_TABLES !== 'false';
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
  // Credential Operations (Encrypted)
  // ========================================

  /**
   * Save encrypted credentials for a bank/card
   */
  saveCredentials(bankId: string, userId: string, password: string, metadata?: Record<string, any>): void {
    const crypto = require('crypto');
    
    // Generate a unique IV for this credential
    const iv = crypto.randomBytes(16);
    
    // Get or generate encryption key
    const ENCRYPTION_KEY = this.getEncryptionKey();
    
    // Encrypt userId and password
    const userIdCipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const userIdEncrypted = userIdCipher.update(userId, 'utf8', 'hex') + userIdCipher.final('hex');
    
    const passwordCipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const passwordEncrypted = passwordCipher.update(password, 'utf8', 'hex') + passwordCipher.final('hex');
    
    const id = `cred_${bankId}_${Date.now()}`;
    const ivHex = iv.toString('hex');
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    
    // Upsert into saved_credentials table
    const stmt = this.db.prepare(`
      INSERT INTO saved_credentials (id, bank_id, user_id_encrypted, password_encrypted, encryption_iv, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(bank_id) DO UPDATE SET
        user_id_encrypted = excluded.user_id_encrypted,
        password_encrypted = excluded.password_encrypted,
        encryption_iv = excluded.encryption_iv,
        metadata = excluded.metadata,
        updated_at = datetime('now')
    `);
    
    stmt.run(id, bankId, userIdEncrypted, passwordEncrypted, ivHex, metadataJson);
    console.log(`[FinanceHubDb] Saved encrypted credentials for ${bankId}`);
  }

  /**
   * Get decrypted credentials for a bank/card
   */
  getCredentials(bankId: string): { userId: string; password: string; metadata?: Record<string, any> } | null {
    const stmt = this.db.prepare(`
      SELECT user_id_encrypted, password_encrypted, encryption_iv, metadata
      FROM saved_credentials
      WHERE bank_id = ?
    `);
    
    const row = stmt.get(bankId) as any;
    if (!row) return null;
    
    try {
      const crypto = require('crypto');
      const ENCRYPTION_KEY = this.getEncryptionKey();
      const iv = Buffer.from(row.encryption_iv, 'hex');
      
      // Decrypt userId
      const userIdDecipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      const userId = userIdDecipher.update(row.user_id_encrypted, 'hex', 'utf8') + userIdDecipher.final('utf8');
      
      // Decrypt password
      const passwordDecipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      const password = passwordDecipher.update(row.password_encrypted, 'hex', 'utf8') + passwordDecipher.final('utf8');
      
      const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;
      
      return { userId, password, metadata };
    } catch (error) {
      console.error(`[FinanceHubDb] Failed to decrypt credentials for ${bankId}:`, error);
      return null;
    }
  }

  /**
   * Remove credentials for a bank/card
   */
  removeCredentials(bankId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM saved_credentials WHERE bank_id = ?`);
    const result = stmt.run(bankId);
    console.log(`[FinanceHubDb] Removed credentials for ${bankId}`);
    return result.changes > 0;
  }

  /**
   * Get all bank IDs that have saved credentials
   */
  getBanksWithCredentials(): string[] {
    const stmt = this.db.prepare(`SELECT bank_id FROM saved_credentials ORDER BY bank_id`);
    return stmt.all().map((row: any) => row.bank_id);
  }

  /**
   * Check if credentials exist for a bank/card
   */
  hasCredentials(bankId: string): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM saved_credentials WHERE bank_id = ? LIMIT 1`);
    return !!stmt.get(bankId);
  }

  /**
   * Get or create encryption key for credentials
   * Uses environment variable or generates a persistent key
   */
  private getEncryptionKey(): Buffer {
    const crypto = require('crypto');
    
    // Try to get from environment first
    if (process.env.CREDENTIAL_ENCRYPTION_KEY) {
      return crypto.scryptSync(process.env.CREDENTIAL_ENCRYPTION_KEY, 'egdesk-salt', 32);
    }
    
    // Generate from a default secret (should be replaced with proper key management)
    const defaultSecret = 'egdesk-credential-secret-v1-change-in-production';
    return crypto.scryptSync(defaultSecret, 'egdesk-salt', 32);
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

  /**
   * Bulk insert bank transactions into the separate bank_transactions table
   * Feature flag: USE_SEPARATE_TRANSACTION_TABLES
   */
  bulkInsertBankTransactions(
    accountId: string,
    bankId: string,
    transactions: Array<{
      date: string;
      time?: string;
      transaction_datetime?: string;
      category?: string;
      withdrawal?: number;
      deposit?: number;
      description?: string;
      description2?: string;
      memo?: string;
      balance?: number;
      branch?: string;
      counterparty?: string;
      counterpartyAccount?: string;
      accountNumber?: string;
      accountName?: string;
    }>
  ): { inserted: number; skipped: number } {
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO bank_transactions (
        id, account_id, bank_id,
        transaction_date, transaction_time, transaction_datetime,
        account_number, account_name,
        deposit, withdrawal, balance,
        branch, counterparty_account, counterparty_name,
        description, description2, memo, is_manual,
        category, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    const insertMany = this.db.transaction((txns: typeof transactions) => {
      for (const tx of txns) {
        const withdrawal = Number(tx.withdrawal) || 0;
        const deposit = Number(tx.deposit) || 0;
        const balance = Number(tx.balance) || 0;

        const transactionDatetime = tx.transaction_datetime ||
          (tx.date && tx.time ? tx.date.replace(/-/g, '/') + ' ' + tx.time : tx.date.replace(/-/g, '/'));

        const result = insertStmt.run(
          randomUUID(),
          accountId,
          bankId,
          tx.date,
          tx.time || null,
          transactionDatetime,
          tx.accountNumber || null,
          tx.accountName || null,
          deposit,
          withdrawal,
          balance,
          tx.branch || null,
          tx.counterpartyAccount || null,
          tx.counterparty || null,
          tx.description || null,
          tx.description2 || null,
          tx.memo || null,
          0, // is_manual
          tx.category || null,
          now,
          now
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
          if (skipped <= 3) {
            console.log(`[FinanceHub] Bank duplicate detected: account=${accountId}, datetime=${transactionDatetime}, withdrawal=${withdrawal}, deposit=${deposit}`);
          }
        }
      }
    });

    insertMany(transactions);
    return { inserted, skipped };
  }

  /**
   * Bulk insert card transactions into the separate card_transactions table
   * Feature flag: USE_SEPARATE_TRANSACTION_TABLES
   */
  bulkInsertCardTransactions(
    accountId: string,
    cardCompanyId: string,
    transactions: Array<{
      approvalDatetime: string;
      approvalDate: string;
      merchantName: string;
      amount: number;
      cardNumber: string;
      category?: string;
      memo?: string;
      // BC Card specific
      headquartersName?: string;
      departmentName?: string;
      // Card details
      cardType?: string;
      cardholderName?: string;
      transactionBank?: string;
      usageType?: string;
      salesType?: string;
      billingDate?: string;
      approvalNumber?: string;
      foreignAmountUsd?: number;
      isCancelled?: boolean;
    }>
  ): { inserted: number; skipped: number } {
    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO card_transactions (
        id, account_id, card_company_id,
        headquarters_name, department_name,
        card_number, card_type, cardholder_name,
        transaction_bank, usage_type, sales_type,
        approval_datetime, approval_date, billing_date,
        approval_number, merchant_name, amount,
        foreign_amount_usd, memo,
        category, is_cancelled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    let skipped = 0;

    const insertMany = this.db.transaction((txns: typeof transactions) => {
      for (const tx of txns) {
        const amount = Number(tx.amount) || 0;

        const result = insertStmt.run(
          randomUUID(),
          accountId,
          cardCompanyId,
          tx.headquartersName || null,
          tx.departmentName || null,
          tx.cardNumber,
          tx.cardType || null,
          tx.cardholderName || null,
          tx.transactionBank || null,
          tx.usageType || null,
          tx.salesType || null,
          tx.approvalDatetime,
          tx.approvalDate,
          tx.billingDate || null,
          tx.approvalNumber || null,
          tx.merchantName,
          amount,
          tx.foreignAmountUsd || null,
          tx.memo || null,
          tx.category || null,
          tx.isCancelled ? 1 : 0,
          now,
          now
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
          if (skipped <= 3) {
            console.log(`[FinanceHub] Card duplicate detected: account=${accountId}, datetime=${tx.approvalDatetime}, merchant=${tx.merchantName}`);
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
    transactionType?: 'bank' | 'card'; // For routing when feature flag is on
  } = {}): Transaction[] {
    // Feature flag routing: Use separate tables if enabled
    if (this.useSeparateTransactionTables()) {
      const isCard = options.transactionType === 'card' || (options.bankId && options.bankId.includes('-card'));

      if (isCard) {
        // Query card transactions and map to Transaction interface for compatibility
        const cardTxns = this.queryCardTransactions({
          accountId: options.accountId,
          cardCompanyId: options.bankId,
          startDate: options.startDate,
          endDate: options.endDate,
          category: options.category,
          minAmount: options.minAmount,
          maxAmount: options.maxAmount,
          searchText: options.searchText,
          limit: options.limit,
          offset: options.offset,
          orderBy: options.orderBy === 'balance' ? 'date' : options.orderBy,
          orderDir: options.orderDir,
        });

        // Map CardTransaction to Transaction for backward compatibility
        return cardTxns.map(ct => ({
          id: ct.id,
          accountId: ct.accountId,
          bankId: ct.cardCompanyId,
          date: ct.approvalDate,
          time: null,
          transaction_datetime: ct.approvalDatetime,
          type: ct.salesType || '',
          category: ct.category,
          withdrawal: ct.amount,
          deposit: 0,
          description: ct.merchantName,
          memo: ct.memo,
          balance: 0,
          branch: null,
          counterparty: null,
          transactionId: ct.approvalNumber,
          createdAt: ct.createdAt,
          metadata: {
            isCardTransaction: true, // Flag for sheets export detection
            cardCompanyId: ct.cardCompanyId,
            cardNumber: ct.cardNumber,
            cardType: ct.cardType,
            cardholderName: ct.cardholderName,
            transactionBank: ct.transactionBank,
            usageType: ct.usageType,
            salesType: ct.salesType,
            billingDate: ct.billingDate,
            approvalNumber: ct.approvalNumber,
            foreignAmountUSD: ct.foreignAmountUsd,
            isCancelled: ct.isCancelled,
            headquartersName: ct.headquartersName,
            departmentName: ct.departmentName,
          },
        }));
      } else {
        // Query bank transactions and map to Transaction interface for compatibility
        const bankTxns = this.queryBankTransactions({
          accountId: options.accountId,
          bankId: options.bankId,
          startDate: options.startDate,
          endDate: options.endDate,
          category: options.category,
          minAmount: options.minAmount,
          maxAmount: options.maxAmount,
          searchText: options.searchText,
          limit: options.limit,
          offset: options.offset,
          orderBy: options.orderBy,
          orderDir: options.orderDir,
        });

        // Map BankTransaction to Transaction for backward compatibility
        return bankTxns.map(bt => ({
          id: bt.id,
          accountId: bt.accountId,
          bankId: bt.bankId,
          date: bt.transactionDate,
          time: bt.transactionTime,
          transaction_datetime: bt.transactionDatetime,
          type: '',
          category: bt.category,
          withdrawal: bt.withdrawal,
          deposit: bt.deposit,
          description: bt.description || '',
          memo: bt.memo,
          balance: bt.balance,
          branch: bt.branch,
          counterparty: bt.counterpartyName,
          transactionId: null,
          createdAt: bt.createdAt,
          metadata: null,
        }));
      }
    }

    // Original implementation: Use unified transactions table
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

  /**
   * Query bank transactions from the separate bank_transactions table
   * Feature flag: USE_SEPARATE_TRANSACTION_TABLES
   */
  queryBankTransactions(options: {
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
  } = {}): BankTransaction[] {
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

    let query = `SELECT * FROM bank_transactions WHERE 1=1`;
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
      query += ` AND transaction_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND transaction_date <= ?`;
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
      query += ` AND (description LIKE ? OR memo LIKE ? OR counterparty_name LIKE ?)`;
      const pattern = `%${searchText}%`;
      params.push(pattern, pattern, pattern);
    }

    // Order
    const orderColumn = orderBy === 'amount'
      ? '(deposit + withdrawal)'
      : orderBy === 'balance'
        ? 'balance'
        : 'transaction_datetime';
    query += ` ORDER BY ${orderColumn} ${orderDir.toUpperCase()}`;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => this.mapRowToBankTransaction(row));
  }

  /**
   * Query card transactions from the separate card_transactions table
   * Feature flag: USE_SEPARATE_TRANSACTION_TABLES
   */
  queryCardTransactions(options: {
    accountId?: string;
    cardCompanyId?: string;
    startDate?: string;
    endDate?: string;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    searchText?: string;
    cardNumber?: string;
    merchantName?: string;
    limit?: number;
    offset?: number;
    orderBy?: 'date' | 'amount';
    orderDir?: 'asc' | 'desc';
  } = {}): CardTransaction[] {
    const {
      accountId,
      cardCompanyId,
      startDate,
      endDate,
      category,
      minAmount,
      maxAmount,
      searchText,
      cardNumber,
      merchantName,
      limit = 100,
      offset = 0,
      orderBy = 'date',
      orderDir = 'desc'
    } = options;

    let query = `SELECT * FROM card_transactions WHERE 1=1`;
    const params: any[] = [];

    if (accountId) {
      query += ` AND account_id = ?`;
      params.push(accountId);
    }

    if (cardCompanyId) {
      query += ` AND card_company_id = ?`;
      params.push(cardCompanyId);
    }

    if (startDate) {
      query += ` AND approval_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND approval_date <= ?`;
      params.push(endDate);
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (minAmount !== undefined) {
      query += ` AND amount >= ?`;
      params.push(minAmount);
    }

    if (maxAmount !== undefined) {
      query += ` AND amount <= ?`;
      params.push(maxAmount);
    }

    if (searchText) {
      query += ` AND (merchant_name LIKE ? OR memo LIKE ? OR cardholder_name LIKE ?)`;
      const pattern = `%${searchText}%`;
      params.push(pattern, pattern, pattern);
    }

    if (cardNumber) {
      query += ` AND card_number LIKE ?`;
      params.push(`%${cardNumber}%`);
    }

    if (merchantName) {
      query += ` AND merchant_name LIKE ?`;
      params.push(`%${merchantName}%`);
    }

    // Order
    const orderColumn = orderBy === 'amount'
      ? 'amount'
      : 'approval_datetime';
    query += ` ORDER BY ${orderColumn} ${orderDir.toUpperCase()}`;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params).map((row: any) => this.mapRowToCardTransaction(row));
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
    if (this.useSeparateTransactionTables()) {
      // Determine if querying bank or card or both
      const isCard = options.bankId?.includes('-card');

      let bankStats = { total: 0, deposits: 0, withdrawals: 0, depositCount: 0, withdrawalCount: 0 };
      let cardStats = { total: 0, deposits: 0, withdrawals: 0, depositCount: 0, withdrawalCount: 0 };

      // Query bank transactions (if not filtering by card-only bankId)
      if (!isCard || !options.bankId) {
        let query = `
          SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(deposit), 0) as total_deposits,
            COALESCE(SUM(withdrawal), 0) as total_withdrawals,
            SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END) as deposit_count,
            SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END) as withdrawal_count
          FROM bank_transactions WHERE 1=1
        `;
        const params: any[] = [];

        if (options.accountId) {
          query += ` AND account_id = ?`;
          params.push(options.accountId);
        }
        if (options.bankId && !isCard) {
          query += ` AND bank_id = ?`;
          params.push(options.bankId);
        }
        if (options.startDate) {
          query += ` AND transaction_date >= ?`;
          params.push(options.startDate);
        }
        if (options.endDate) {
          query += ` AND transaction_date <= ?`;
          params.push(options.endDate);
        }

        const row = this.db.prepare(query).get(...params) as any;
        bankStats = {
          total: row.total_transactions || 0,
          deposits: row.total_deposits || 0,
          withdrawals: row.total_withdrawals || 0,
          depositCount: row.deposit_count || 0,
          withdrawalCount: row.withdrawal_count || 0
        };
      }

      // Query card transactions (if not filtering by bank-only bankId)
      if (isCard || !options.bankId) {
        let query = `
          SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(CASE WHEN is_cancelled = 1 THEN amount ELSE 0 END), 0) as total_deposits,
            COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN amount ELSE 0 END), 0) as total_withdrawals,
            SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END) as deposit_count,
            SUM(CASE WHEN is_cancelled = 0 THEN 1 ELSE 0 END) as withdrawal_count
          FROM card_transactions WHERE 1=1
        `;
        const params: any[] = [];

        if (options.accountId) {
          query += ` AND account_id = ?`;
          params.push(options.accountId);
        }
        if (options.bankId && isCard) {
          query += ` AND card_company_id = ?`;
          params.push(options.bankId);
        }
        if (options.startDate) {
          query += ` AND approval_date >= ?`;
          params.push(options.startDate);
        }
        if (options.endDate) {
          query += ` AND approval_date <= ?`;
          params.push(options.endDate);
        }

        const row = this.db.prepare(query).get(...params) as any;
        cardStats = {
          total: row.total_transactions || 0,
          deposits: row.total_deposits || 0,
          withdrawals: row.total_withdrawals || 0,
          depositCount: row.deposit_count || 0,
          withdrawalCount: row.withdrawal_count || 0
        };
      }

      // Merge results
      return {
        totalTransactions: bankStats.total + cardStats.total,
        totalDeposits: bankStats.deposits + cardStats.deposits,
        totalWithdrawals: bankStats.withdrawals + cardStats.withdrawals,
        depositCount: bankStats.depositCount + cardStats.depositCount,
        withdrawalCount: bankStats.withdrawalCount + cardStats.withdrawalCount,
        netChange: (bankStats.deposits + cardStats.deposits) - (bankStats.withdrawals + cardStats.withdrawals)
      };
    } else {
      // Existing implementation (old transactions table)
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
    if (this.useSeparateTransactionTables()) {
      const isCard = options.bankId?.includes('-card');
      const results = new Map<string, any>(); // key: "yearMonth|bankId"

      // Query bank transactions
      if (!isCard || !options.bankId) {
        let query = `
          SELECT
            substr(transaction_date, 1, 7) as year_month,
            bank_id,
            SUM(CASE WHEN deposit > 0 THEN 1 ELSE 0 END) as deposit_count,
            SUM(CASE WHEN withdrawal > 0 THEN 1 ELSE 0 END) as withdrawal_count,
            COALESCE(SUM(deposit), 0) as total_deposits,
            COALESCE(SUM(withdrawal), 0) as total_withdrawals
          FROM bank_transactions WHERE 1=1
        `;
        const params: any[] = [];

        if (options.accountId) {
          query += ` AND account_id = ?`;
          params.push(options.accountId);
        }
        if (options.bankId && !isCard) {
          query += ` AND bank_id = ?`;
          params.push(options.bankId);
        }
        if (options.year) {
          query += ` AND substr(transaction_date, 1, 4) = ?`;
          params.push(options.year.toString());
        }

        query += ` GROUP BY year_month, bank_id`;

        const rows = this.db.prepare(query).all(...params) as any[];

        for (const row of rows) {
          const key = `${row.year_month}|${row.bank_id}`;
          results.set(key, {
            yearMonth: row.year_month,
            bankId: row.bank_id,
            depositCount: row.deposit_count || 0,
            withdrawalCount: row.withdrawal_count || 0,
            totalDeposits: row.total_deposits || 0,
            totalWithdrawals: row.total_withdrawals || 0
          });
        }
      }

      // Query card transactions
      if (isCard || !options.bankId) {
        let query = `
          SELECT
            substr(approval_date, 1, 7) as year_month,
            card_company_id as bank_id,
            SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END) as deposit_count,
            SUM(CASE WHEN is_cancelled = 0 THEN 1 ELSE 0 END) as withdrawal_count,
            COALESCE(SUM(CASE WHEN is_cancelled = 1 THEN amount ELSE 0 END), 0) as total_deposits,
            COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN amount ELSE 0 END), 0) as total_withdrawals
          FROM card_transactions WHERE 1=1
        `;
        const params: any[] = [];

        if (options.accountId) {
          query += ` AND account_id = ?`;
          params.push(options.accountId);
        }
        if (options.bankId && isCard) {
          query += ` AND card_company_id = ?`;
          params.push(options.bankId);
        }
        if (options.year) {
          query += ` AND substr(approval_date, 1, 4) = ?`;
          params.push(options.year.toString());
        }

        query += ` GROUP BY year_month, card_company_id`;

        const rows = this.db.prepare(query).all(...params) as any[];

        for (const row of rows) {
          const key = `${row.year_month}|${row.bank_id}`;
          const existing = results.get(key);

          if (existing) {
            // Merge with existing bank data
            existing.depositCount += row.deposit_count || 0;
            existing.withdrawalCount += row.withdrawal_count || 0;
            existing.totalDeposits += row.total_deposits || 0;
            existing.totalWithdrawals += row.total_withdrawals || 0;
          } else {
            results.set(key, {
              yearMonth: row.year_month,
              bankId: row.bank_id,
              depositCount: row.deposit_count || 0,
              withdrawalCount: row.withdrawal_count || 0,
              totalDeposits: row.total_deposits || 0,
              totalWithdrawals: row.total_withdrawals || 0
            });
          }
        }
      }

      // Convert map to array, add netChange, sort, and limit
      const resultArray = Array.from(results.values()).map(item => ({
        ...item,
        netChange: item.totalDeposits - item.totalWithdrawals
      }));

      // Sort by yearMonth DESC
      resultArray.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

      // Apply limit if specified
      const limit = options.months || 12;
      return resultArray.slice(0, limit);

    } else {
      // Existing implementation (old transactions table)
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
    if (this.useSeparateTransactionTables()) {
      // Get bank transaction counts per account
      const bankTxCounts = new Map<string, number>();
      const bankTxCountsQuery = this.db.prepare(`
        SELECT account_id, COUNT(*) as tx_count
        FROM bank_transactions
        GROUP BY account_id
      `);
      for (const row of bankTxCountsQuery.all() as any[]) {
        bankTxCounts.set(row.account_id, row.tx_count);
      }

      // Get card transaction counts per account
      const cardTxCounts = new Map<string, number>();
      const cardTxCountsQuery = this.db.prepare(`
        SELECT account_id, COUNT(*) as tx_count
        FROM card_transactions
        GROUP BY account_id
      `);
      for (const row of cardTxCountsQuery.all() as any[]) {
        cardTxCounts.set(row.account_id, row.tx_count);
      }

      // Get bank breakdown with accounts
      const breakdownQuery = this.db.prepare(`
        SELECT
          b.id as bank_id,
          b.name_ko as bank_name,
          COUNT(DISTINCT a.id) as account_count,
          COALESCE(SUM(DISTINCT a.balance), 0) as total_balance
        FROM banks b
        LEFT JOIN accounts a ON b.id = a.bank_id AND a.is_active = 1
        GROUP BY b.id
        HAVING account_count > 0
        ORDER BY account_count DESC
      `);

      const breakdown = breakdownQuery.all().map((row: any) => {
        // Get all accounts for this bank
        const accountsQuery = this.db.prepare(`
          SELECT id FROM accounts
          WHERE bank_id = ? AND is_active = 1
        `);
        const accounts = accountsQuery.all(row.bank_id) as any[];

        // Sum transaction counts from both tables
        let transactionCount = 0;
        for (const account of accounts) {
          transactionCount += bankTxCounts.get(account.id) || 0;
          transactionCount += cardTxCounts.get(account.id) || 0;
        }

        return {
          bankId: row.bank_id,
          bankName: row.bank_name,
          accountCount: row.account_count,
          transactionCount: transactionCount,
          totalBalance: row.total_balance
        };
      });

      return {
        totalBanks: breakdown.length,
        totalAccounts: breakdown.reduce((sum, b) => sum + b.accountCount, 0),
        totalTransactions: breakdown.reduce((sum, b) => sum + b.transactionCount, 0),
        totalBalance: breakdown.reduce((sum, b) => sum + b.totalBalance, 0),
        bankBreakdown: breakdown
      };

    } else {
      // Existing implementation (old transactions table)
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
  // Hometax (read-only; same DB as FinanceHub)
  // ========================================

  /**
   * List rows from hometax_connections (business registry, spreadsheet URLs, counts).
   */
  listHometaxConnections(): Record<string, unknown>[] {
    const stmt = this.db.prepare(`
      SELECT * FROM hometax_connections ORDER BY business_number ASC
    `);
    return stmt.all() as Record<string, unknown>[];
  }

  queryTaxInvoices(filters: {
    businessNumber?: string;
    invoiceType?: 'sales' | 'purchase';
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }): { invoices: Record<string, unknown>[]; total: number; error?: string } {
    const r = getTaxInvoices(this.db, {
      businessNumber: filters.businessNumber,
      invoiceType: filters.invoiceType,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
      offset: filters.offset
    });
    if (!r.success) {
      return { invoices: [], total: 0, error: r.error };
    }
    return {
      invoices: (r.data ?? []) as Record<string, unknown>[],
      total: r.total ?? 0
    };
  }

  queryCashReceipts(filters: {
    businessNumber?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }): { receipts: Record<string, unknown>[]; total: number; error?: string } {
    const r = getCashReceipts(this.db, {
      businessNumber: filters.businessNumber,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
      offset: filters.offset
    });
    if (!r.success) {
      return { receipts: [], total: 0, error: r.error };
    }
    return {
      receipts: (r.data ?? []) as Record<string, unknown>[],
      total: r.total ?? 0
    };
  }

  /**
   * Hometax Excel sync history (table hometax_sync_operations), not bank sync_operations.
   */
  getHometaxSyncOperations(limit: number = 50): Record<string, unknown>[] {
    const capped = Math.min(Math.max(limit, 1), 1000);
    const stmt = this.db.prepare(`
      SELECT * FROM hometax_sync_operations
      ORDER BY started_at DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(capped) as Record<string, unknown>[];
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
      /** JSON string: excel_parsing_logic.md 적요2 bundle */
      description2?: string;
      memo?: string;
      balance?: number;
      branch?: string;
      counterparty?: string;
      counterpartyAccount?: string;
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
    console.log(`[FinanceHubDb] 🔍 importTransactions called:`);
    console.log(`[FinanceHubDb]    bankId: ${bankId}`);
    console.log(`[FinanceHubDb]    accountNumber: ${accountData.accountNumber}`);
    console.log(`[FinanceHubDb]    transactions count: ${transactions.length}`);
    console.log(`[FinanceHubDb]    isCard param: ${isCard}`);
    
    // 1. Transform card transactions if needed
    // Auto-detect cards by bankId (bc-card, nh-card, kb-card, etc.)
    const isCardTransaction = isCard || bankId.includes('-card');
    console.log(`[FinanceHubDb]    isCardTransaction: ${isCardTransaction}`);

    let transformedTransactions = transactions;
    if (isCardTransaction) {
      const { transformCardTransaction } = require('../financehub/utils/cardTransactionMapper');
      transformedTransactions = transactions.map(tx =>
        transformCardTransaction(tx, null, bankId) // accountId handled by bulkInsertTransactions
      );
    }

    // 2. Upsert account
    console.log(`[FinanceHubDb] 📝 Upserting account...`);
    const account = this.upsertAccount({
      bankId,
      ...accountData,
    });
    console.log(`[FinanceHubDb]    ✅ Account upserted: ${account.id}`);

    // 3. Create sync operation
    console.log(`[FinanceHubDb] 📝 Creating sync operation...`);
    const syncOp = this.createSyncOperation({
      accountId: account.id,
      bankId,
      queryPeriodStart: syncMetadata.queryPeriodStart,
      queryPeriodEnd: syncMetadata.queryPeriodEnd,
    });
    console.log(`[FinanceHubDb]    ✅ Sync operation created: ${syncOp.id}`);

    try {
      // 4. Bulk insert transactions (with dedup via UNIQUE index)
      console.log(`[FinanceHubDb] 💾 Bulk inserting ${transformedTransactions.length} transactions...`);

      let inserted: number, skipped: number;

      // Feature flag: Route to appropriate table based on USE_SEPARATE_TRANSACTION_TABLES
      if (this.useSeparateTransactionTables()) {
        console.log(`[FinanceHubDb]    🔀 Using separate transaction tables (feature flag enabled)`);
        if (isCardTransaction) {
          console.log(`[FinanceHubDb]    💳 Inserting into card_transactions table`);
          ({ inserted, skipped } = this.bulkInsertCardTransactions(
            account.id,
            bankId,
            transformedTransactions.map(tx => ({
              approvalDatetime: tx.transaction_datetime || tx.date || '',
              approvalDate: tx.date || '',
              merchantName: tx.description || 'UNKNOWN',
              amount: tx.withdrawal || tx.deposit || 0,
              cardNumber: (tx as any).cardNumber || tx.metadata?.cardNumber || 'UNKNOWN', // Top level first, fallback to metadata
              category: tx.category,
              memo: tx.memo,
              // Extract from metadata if available
              headquartersName: tx.metadata?.headquartersName,
              departmentName: tx.metadata?.departmentName,
              cardType: tx.metadata?.cardType,
              cardholderName: tx.metadata?.userName || tx.metadata?.cardHolder,
              transactionBank: tx.metadata?.transactionBank,
              usageType: tx.metadata?.transactionMethod,
              salesType: tx.metadata?.salesType,
              billingDate: tx.metadata?.billingDate,
              approvalNumber: tx.metadata?.approvalNumber,
              foreignAmountUsd: tx.metadata?.foreignAmountUSD,
              isCancelled: tx.metadata?.isCancelled,
            }))
          ));
        } else {
          console.log(`[FinanceHubDb]    🏦 Inserting into bank_transactions table`);
          ({ inserted, skipped } = this.bulkInsertBankTransactions(
            account.id,
            bankId,
            transformedTransactions
          ));
        }
      } else {
        console.log(`[FinanceHubDb]    📊 Using unified transactions table (feature flag disabled)`);
        ({ inserted, skipped } = this.bulkInsertTransactions(
          account.id,
          bankId,
          transformedTransactions
        ));
      }

      console.log(`[FinanceHubDb]    ✅ Bulk insert complete: ${inserted} inserted, ${skipped} skipped`);

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
      console.log(`[FinanceHubDb] 📝 Completing sync operation...`);
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
      console.log(`[FinanceHubDb]    ✅ Sync operation completed`);

      console.log(`[FinanceHubDb] 🎉 importTransactions SUCCESS: ${inserted} inserted, ${skipped} skipped`);
      return {
        account,
        syncOperation: completedSync,
        inserted,
        skipped,
      };
    } catch (error) {
      // Fail sync on error
      console.error(`[FinanceHubDb] ❌ importTransactions FAILED:`, error);
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

  private mapRowToBankTransaction(row: any): BankTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      bankId: row.bank_id,
      transactionDate: row.transaction_date,
      transactionTime: row.transaction_time,
      transactionDatetime: row.transaction_datetime,
      accountNumber: row.account_number,
      accountName: row.account_name,
      deposit: row.deposit,
      withdrawal: row.withdrawal,
      balance: row.balance,
      branch: row.branch,
      counterpartyAccount: row.counterparty_account,
      counterpartyName: row.counterparty_name,
      description: row.description,
      description2: row.description2,
      memo: row.memo,
      isManual: Boolean(row.is_manual),
      category: row.category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToCardTransaction(row: any): CardTransaction {
    return {
      id: row.id,
      accountId: row.account_id,
      cardCompanyId: row.card_company_id,
      headquartersName: row.headquarters_name,
      departmentName: row.department_name,
      cardNumber: row.card_number,
      cardType: row.card_type,
      cardholderName: row.cardholder_name,
      transactionBank: row.transaction_bank,
      usageType: row.usage_type,
      salesType: row.sales_type,
      approvalDatetime: row.approval_datetime,
      approvalDate: row.approval_date,
      billingDate: row.billing_date,
      approvalNumber: row.approval_number,
      merchantName: row.merchant_name,
      amount: row.amount,
      foreignAmountUsd: row.foreign_amount_usd,
      memo: row.memo,
      category: row.category,
      isCancelled: Boolean(row.is_cancelled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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

  /**
   * List promissory notes for the UI (joins bank display name and account number).
   */
  getPromissoryNotes(): Array<{
    id: string;
    accountId: string;
    bankId: string;
    bankName: string;
    accountNumber: string;
    noteNumber: string;
    noteType: string;
    issuerName: string;
    issuerRegistrationNumber?: string;
    payeeName: string;
    payeeRegistrationNumber?: string;
    amount: number;
    currency: string;
    issueDate: string;
    maturityDate: string;
    collectionDate?: string;
    status: string;
    processingBank?: string;
    bankBranch?: string;
    category?: string;
    memo?: string;
    isManual: boolean;
    createdAt: string;
    updatedAt: string;
  }> {
    try {
      const exists = this.db
        .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='promissory_notes' LIMIT 1`)
        .get();
      if (!exists) {
        return [];
      }

      const stmt = this.db.prepare(`
        SELECT
          pn.id,
          pn.account_id,
          pn.bank_id,
          pn.note_number,
          pn.note_type,
          pn.issuer_name,
          pn.issuer_registration_number,
          pn.payee_name,
          pn.payee_registration_number,
          pn.amount,
          pn.currency,
          pn.issue_date,
          pn.maturity_date,
          pn.collection_date,
          pn.status,
          pn.processing_bank,
          pn.bank_branch,
          pn.category,
          pn.memo,
          pn.is_manual,
          pn.created_at,
          pn.updated_at,
          b.name_ko AS bank_name_ko,
          a.account_number AS account_number
        FROM promissory_notes pn
        LEFT JOIN banks b ON b.id = pn.bank_id
        LEFT JOIN accounts a ON a.id = pn.account_id
        ORDER BY pn.maturity_date ASC, pn.created_at DESC
      `);
      const rows = stmt.all() as any[];
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        bankId: row.bank_id,
        bankName: row.bank_name_ko || row.bank_id,
        accountNumber: row.account_number || '',
        noteNumber: row.note_number,
        noteType: row.note_type,
        issuerName: row.issuer_name,
        issuerRegistrationNumber: row.issuer_registration_number ?? undefined,
        payeeName: row.payee_name,
        payeeRegistrationNumber: row.payee_registration_number ?? undefined,
        amount: row.amount,
        currency: row.currency || 'KRW',
        issueDate: row.issue_date,
        maturityDate: row.maturity_date,
        collectionDate: row.collection_date ?? undefined,
        status: row.status,
        processingBank: row.processing_bank ?? undefined,
        bankBranch: row.bank_branch ?? undefined,
        category: row.category ?? undefined,
        memo: row.memo ?? undefined,
        isManual: !!row.is_manual,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (e: any) {
      console.error('[FinanceHubDb] getPromissoryNotes:', e?.message || e);
      return [];
    }
  }

  /**
   * Query promissory notes (promissory_notes) with filters and pagination — read-only, for MCP/UI.
   */
  queryPromissoryNotes(filters: {
    bankId?: string;
    accountId?: string;
    status?: string;
    noteType?: 'issued' | 'received';
    maturityStart?: string;
    maturityEnd?: string;
    issueStart?: string;
    issueEnd?: string;
    searchText?: string;
    limit: number;
    offset: number;
  }): {
    notes: Array<{
      id: string;
      accountId: string;
      bankId: string;
      bankName: string;
      accountNumber: string;
      noteNumber: string;
      noteType: string;
      issuerName: string;
      issuerRegistrationNumber?: string;
      payeeName: string;
      payeeRegistrationNumber?: string;
      amount: number;
      currency: string;
      issueDate: string;
      maturityDate: string;
      collectionDate?: string;
      status: string;
      processingBank?: string;
      bankBranch?: string;
      category?: string;
      memo?: string;
      isManual: boolean;
      createdAt: string;
      updatedAt: string;
      endorsementInfo?: string;
      discountInfo?: string;
      metadata?: Record<string, unknown>;
    }>;
    total: number;
    error?: string;
  } {
    try {
      const exists = this.db
        .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='promissory_notes' LIMIT 1`)
        .get();
      if (!exists) {
        return { notes: [], total: 0 };
      }

      let where = 'WHERE 1=1';
      const params: unknown[] = [];

      if (filters.bankId) {
        where += ' AND pn.bank_id = ?';
        params.push(filters.bankId);
      }
      if (filters.accountId) {
        where += ' AND pn.account_id = ?';
        params.push(filters.accountId);
      }
      if (filters.status) {
        where += ' AND pn.status = ?';
        params.push(filters.status);
      }
      if (filters.noteType) {
        where += ' AND pn.note_type = ?';
        params.push(filters.noteType);
      }
      if (filters.maturityStart) {
        where += ' AND pn.maturity_date >= ?';
        params.push(filters.maturityStart);
      }
      if (filters.maturityEnd) {
        where += ' AND pn.maturity_date <= ?';
        params.push(filters.maturityEnd);
      }
      if (filters.issueStart) {
        where += ' AND pn.issue_date >= ?';
        params.push(filters.issueStart);
      }
      if (filters.issueEnd) {
        where += ' AND pn.issue_date <= ?';
        params.push(filters.issueEnd);
      }
      if (filters.searchText && String(filters.searchText).trim()) {
        const t = `%${String(filters.searchText).trim().replace(/%/g, '')}%`;
        where +=
          ' AND (pn.note_number LIKE ? OR pn.issuer_name LIKE ? OR pn.payee_name LIKE ? OR pn.memo LIKE ?)';
        params.push(t, t, t, t);
      }

      const from = `
        FROM promissory_notes pn
        LEFT JOIN banks b ON b.id = pn.bank_id
        LEFT JOIN accounts a ON a.id = pn.account_id
        ${where}
      `;

      const countRow = this.db
        .prepare(`SELECT COUNT(*) AS total ${from}`)
        .get(...params) as { total: number };
      const total = countRow?.total ?? 0;

      const limit = Math.min(Math.max(filters.limit, 1), 1000);
      const offset = Math.max(filters.offset, 0);

      const stmt = this.db.prepare(`
        SELECT
          pn.id,
          pn.account_id,
          pn.bank_id,
          pn.note_number,
          pn.note_type,
          pn.issuer_name,
          pn.issuer_registration_number,
          pn.payee_name,
          pn.payee_registration_number,
          pn.amount,
          pn.currency,
          pn.issue_date,
          pn.maturity_date,
          pn.collection_date,
          pn.status,
          pn.processing_bank,
          pn.bank_branch,
          pn.category,
          pn.memo,
          pn.is_manual,
          pn.created_at,
          pn.updated_at,
          pn.endorsement_info,
          pn.discount_info,
          pn.metadata,
          b.name_ko AS bank_name_ko,
          a.account_number AS account_number
        ${from}
        ORDER BY pn.maturity_date ASC, pn.created_at DESC
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(...params, limit, offset) as any[];

      const notes = rows.map((row) => {
        let metadata: Record<string, unknown> | undefined;
        if (row.metadata) {
          try {
            metadata = JSON.parse(row.metadata) as Record<string, unknown>;
          } catch {
            metadata = undefined;
          }
        }
        return {
          id: row.id,
          accountId: row.account_id,
          bankId: row.bank_id,
          bankName: row.bank_name_ko || row.bank_id,
          accountNumber: row.account_number || '',
          noteNumber: row.note_number,
          noteType: row.note_type,
          issuerName: row.issuer_name,
          issuerRegistrationNumber: row.issuer_registration_number ?? undefined,
          payeeName: row.payee_name,
          payeeRegistrationNumber: row.payee_registration_number ?? undefined,
          amount: row.amount,
          currency: row.currency || 'KRW',
          issueDate: row.issue_date,
          maturityDate: row.maturity_date,
          collectionDate: row.collection_date ?? undefined,
          status: row.status,
          processingBank: row.processing_bank ?? undefined,
          bankBranch: row.bank_branch ?? undefined,
          category: row.category ?? undefined,
          memo: row.memo ?? undefined,
          isManual: !!row.is_manual,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          endorsementInfo: row.endorsement_info ?? undefined,
          discountInfo: row.discount_info ?? undefined,
          metadata,
        };
      });

      return { notes, total };
    } catch (e: any) {
      console.error('[FinanceHubDb] queryPromissoryNotes:', e?.message || e);
      return {
        notes: [],
        total: 0,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Stable primary key for promissory_notes upserts (same bank + note number → same id).
   */
  private stablePromissoryNoteId(bankId: string, noteNumber: string): string {
    const h = createHash('sha256').update(`${bankId}\n${noteNumber}`).digest('hex');
    return `pn_${h.slice(0, 40)}`;
  }

  /**
   * Parse IBK 외상매출채권 Excel (header row 3) and upsert into `promissory_notes`.
   * Uses first active IBK account for `account_id` and `customer_name` / `account_name` for `payee_name`.
   */
  importIbkPromissoryNotesFromExcel(filePath: string): {
    success: boolean;
    imported: number;
    skipped: number;
    error?: string;
    warnings?: string[];
  } {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { parseIbkPromissoryNotesExcel } = require('../financehub/utils/ibk-promissory-notes-excel.js');

    const bankId = 'ibk';
    try {
      const table = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='promissory_notes'`)
        .get() as { name: string } | undefined;
      if (!table) {
        return { success: false, imported: 0, skipped: 0, error: 'promissory_notes 테이블이 없습니다. 앱을 최신으로 실행해 마이그레이션을 적용하세요.' };
      }

      const accounts = this.getAccountsByBank(bankId);
      if (!accounts.length) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          error: 'IBK 활성 계좌가 없습니다. 먼저 기업뱅킹에서 계좌를 연결하세요.',
        };
      }
      const account = accounts[0];
      const payeeName =
        (account.customerName && account.customerName.trim()) ||
        (account.accountName && account.accountName.trim()) ||
        '본인';

      const { rows, warnings } = parseIbkPromissoryNotesExcel(filePath) as {
        rows: Array<{
          noteNumber: string;
          issuerName: string;
          issuerRegistrationNumber: string | null;
          amount: number;
          issueDate: string;
          maturityDate: string;
          collectionDate: string | null;
          status: string;
          category: string | null;
          bankBranch: string | null;
          memo: string | null;
          metadata: Record<string, unknown>;
        }>;
        warnings: string[];
      };

      if (!rows.length) {
        return {
          success: true,
          imported: 0,
          skipped: 0,
          warnings: warnings?.length ? warnings : undefined,
        };
      }

      const upsert = this.db.prepare(`
        INSERT INTO promissory_notes (
          id, account_id, bank_id, note_number, note_type,
          issuer_name, issuer_registration_number, payee_name, payee_registration_number,
          amount, currency, issue_date, maturity_date, collection_date,
          status, endorsement_info, discount_info, processing_bank, bank_branch,
          category, memo, is_manual, created_at, updated_at, metadata
        ) VALUES (
          @id, @account_id, @bank_id, @note_number, @note_type,
          @issuer_name, @issuer_registration_number, @payee_name, @payee_registration_number,
          @amount, @currency, @issue_date, @maturity_date, @collection_date,
          @status, @endorsement_info, @discount_info, @processing_bank, @bank_branch,
          @category, @memo, @is_manual, datetime('now'), datetime('now'), @metadata
        )
        ON CONFLICT(note_number, bank_id) DO UPDATE SET
          account_id = excluded.account_id,
          issuer_name = excluded.issuer_name,
          issuer_registration_number = excluded.issuer_registration_number,
          payee_name = excluded.payee_name,
          payee_registration_number = excluded.payee_registration_number,
          amount = excluded.amount,
          issue_date = excluded.issue_date,
          maturity_date = excluded.maturity_date,
          collection_date = excluded.collection_date,
          status = excluded.status,
          processing_bank = excluded.processing_bank,
          bank_branch = excluded.bank_branch,
          category = excluded.category,
          memo = excluded.memo,
          metadata = excluded.metadata,
          updated_at = datetime('now')
      `);

      const run = this.db.transaction(() => {
        let n = 0;
        for (const r of rows) {
          const id = this.stablePromissoryNoteId(bankId, r.noteNumber);
          upsert.run({
            id,
            account_id: account.id,
            bank_id: bankId,
            note_number: r.noteNumber,
            note_type: 'received',
            issuer_name: r.issuerName,
            issuer_registration_number: r.issuerRegistrationNumber,
            payee_name: payeeName,
            payee_registration_number: null,
            amount: r.amount,
            currency: 'KRW',
            issue_date: r.issueDate,
            maturity_date: r.maturityDate,
            collection_date: r.collectionDate,
            status: r.status,
            endorsement_info: null,
            discount_info: null,
            processing_bank: null,
            bank_branch: r.bankBranch,
            category: r.category,
            memo: r.memo,
            is_manual: 0,
            metadata: JSON.stringify({ ...r.metadata, importSourceFile: path.basename(filePath) }),
          });
          n += 1;
        }
        return n;
      });

      const imported = run();
      console.log(`[FinanceHubDb] importIbkPromissoryNotesFromExcel: ${imported} rows from ${filePath}`);

      return {
        success: true,
        imported,
        skipped: 0,
        warnings: warnings?.length ? warnings : undefined,
      };
    } catch (error: any) {
      console.error('[FinanceHubDb] importIbkPromissoryNotesFromExcel failed:', error);
      return {
        success: false,
        imported: 0,
        skipped: 0,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Execute raw SQL query (DEBUG/DEV ONLY)
   * @param {string} sql - SQL query to execute
   * @param {any[]} params - Query parameters
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async runRawQuery(sql: string, params: any[] = []): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      // Determine if this is a SELECT query or a mutation
      const isSelect = sql.trim().toLowerCase().startsWith('select');

      if (isSelect) {
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return { success: true, data: rows };
      } else {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...params);
        return { success: true, data: { changes: result.changes, lastInsertRowid: result.lastInsertRowid } };
      }
    } catch (error: any) {
      console.error('[FinanceHubDb] Raw query error:', error);
      return { success: false, error: error.message };
    }
  }
}
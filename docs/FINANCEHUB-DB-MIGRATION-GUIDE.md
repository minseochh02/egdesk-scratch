# Finance Hub: Multi-Bank Database Architecture

## Overview

This document explains how to upgrade your current Shinhan-specific database schema to a flexible multi-bank architecture.

## Current State vs. Proposed State

### Current (Shinhan-Specific)
```
shinhan_accounts          → Only stores Shinhan accounts
shinhan_transactions      → Only stores Shinhan transactions
shinhan_sync_operations   → Only tracks Shinhan syncs
```

### Proposed (Multi-Bank Unified)
```
banks                     → Registry of all supported banks
accounts                  → All banks, distinguished by bank_id
transactions              → All banks, with bank_id for filtering
sync_operations           → All banks, tracks sync per account
saved_credentials         → Encrypted credentials per bank
```

## Key Schema Changes

### 1. Unified `accounts` Table
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,           -- 'shinhan', 'kookmin', 'woori', etc.
  account_number TEXT NOT NULL,
  account_name TEXT,
  customer_name TEXT,
  balance INTEGER DEFAULT 0,
  -- ... other fields
  UNIQUE(bank_id, account_number)  -- Composite unique constraint
);
```

### 2. Unified `transactions` Table with Deduplication
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,           -- Denormalized for faster queries
  date TEXT NOT NULL,
  time TEXT,
  type TEXT,
  category TEXT,                    -- For AI categorization
  withdrawal INTEGER DEFAULT 0,
  deposit INTEGER DEFAULT 0,
  description TEXT,
  balance INTEGER DEFAULT 0,
  -- ... other fields
  
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Deduplication index (prevents duplicate imports)
CREATE UNIQUE INDEX idx_transactions_dedup 
  ON transactions(account_id, date, time, withdrawal, deposit, balance);
```

### 3. Banks Registry Table
```sql
CREATE TABLE banks (
  id TEXT PRIMARY KEY,             -- 'shinhan', 'kookmin', etc.
  name TEXT NOT NULL,              -- 'Shinhan Bank'
  name_ko TEXT NOT NULL,           -- '신한은행'
  color TEXT DEFAULT '#0046FF',
  icon TEXT DEFAULT '🏦',
  supports_automation INTEGER DEFAULT 0,
  login_url TEXT,
  metadata TEXT                    -- Bank-specific config as JSON
);
```

## Implementation Status

✅ **Implemented**: The unified schema and migration logic have been implemented.

- **Schema Definition**: `src/main/sqlite/financehub.ts`
- **Migration Script**: `src/main/sqlite/migrations/001-unified-schema.ts`
- **Manager Class**: `src/main/sqlite/manager.ts` (Updated to use `FinanceHubDbManager`)
- **Initialization**: `src/main/sqlite/init.ts` (Updated to run migration on startup)

### Migration Strategy (Implemented)

The application automatically runs the migration script on startup:

1. Initializes the new unified schema tables (`banks`, `accounts`, `transactions`, `sync_operations`).
2. Checks for existing Shinhan data in `shinhan_*` tables.
3. Migrates data to the new tables with `bank_id = 'shinhan'`.
4. Uses `ON CONFLICT DO NOTHING` to ensure idempotency (can be run multiple times safely).

### API Changes

The frontend now uses the `financeHubDb` API instead of `shinhanDb`.

```typescript
// Old API (Shinhan-specific)
// window.electron.shinhanDb.getTransactionsByAccount(accountId);

// New API (Multi-bank)
window.electron.financeHubDb.queryTransactions({ accountId });
window.electron.financeHubDb.importTransactions('shinhan', accountData, transactions, meta);
```

## Usage Examples

### Querying Across All Banks
```typescript
// Get all accounts across all banks
const allAccounts = await window.electron.financeHubDb.getAllAccounts();

// Get transactions from all banks for a date range
const transactions = await window.electron.financeHubDb.queryTransactions({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  limit: 1000,
});

// Get overall statistics
const stats = await window.electron.financeHubDb.getOverallStats();
// → { totalBanks: 3, totalAccounts: 5, totalTransactions: 1234, ... }
```

### Querying Single Bank
```typescript
// Get only Shinhan accounts
const shinhanAccounts = await window.electron.financeHubDb.getAccountsByBank('shinhan');

// Get Shinhan transactions only
const shinhanTx = await window.electron.financeHubDb.queryTransactions({ bankId: 'shinhan' });

// Get stats for Kookmin Bank
const kbStats = await window.electron.financeHubDb.getTransactionStats({ bankId: 'kookmin' });
```

### Importing from New Bank
```typescript
// When you add KB Kookmin support later:
const result = await window.electron.financeHubDb.importTransactions(
  'kookmin',  // bankId
  {
    accountNumber: '123-45-6789012',
    accountName: '급여통장',
    customerName: '홍길동',
    balance: 5000000,
  },
  transactions,  // Array from KB automation
  {
    queryPeriodStart: '2024-01-01',
    queryPeriodEnd: '2024-03-31',
  }
);
```

## Benefits of Unified Schema

| Aspect | Separate Tables/DBs | Unified Schema |
|--------|---------------------|----------------|
| Cross-bank queries | Complex UNION queries | Simple WHERE clause |
| Code duplication | N copies of CRUD | Single implementation |
| Schema changes | Update N tables | Update 1 table |
| Total balance | Complex aggregation | Simple SUM |
| New bank support | New table + new code | Just add bank_id |
| Index maintenance | N×M indexes | M indexes |
| Backup/restore | Multiple files | Single file |

## Index Strategy

The schema includes optimized indexes for common query patterns:

```sql
-- Fast filtering by bank
CREATE INDEX idx_transactions_bank_id ON transactions(bank_id);

-- Fast date range queries
CREATE INDEX idx_transactions_date ON transactions(date);

-- Fast per-account queries
CREATE INDEX idx_transactions_account_id ON transactions(account_id);

-- Compound index for common pattern (account + date range)
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date);

-- Deduplication (prevents double-import)
CREATE UNIQUE INDEX idx_transactions_dedup 
  ON transactions(account_id, date, time, withdrawal, deposit, balance);
```

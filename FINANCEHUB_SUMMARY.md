# Finance Hub - Database Schema Summary

> **Note**: This document covers the **database schema** (`src/main/sqlite/financehub.ts`).
> For the complete **automation framework** (`src/main/financehub/`), see [FINANCEHUB_COMPLETE_SUMMARY.md](./FINANCEHUB_COMPLETE_SUMMARY.md).

## Overview

Finance Hub Database is a unified multi-bank database system designed to manage financial data from multiple Korean banks using a single flexible schema. Built with `better-sqlite3`, it provides a comprehensive solution for account management, transaction tracking, and synchronization operations.

This database works in conjunction with the Finance Hub Automation Framework to store and manage data retrieved from automated bank logins and transaction queries.

## Architecture

### Core Components

1. **Type System** (Lines 13-82)
   - `BankAccount`: Account details with bank-agnostic structure
   - `Transaction`: Standardized transaction records
   - `SyncOperation`: Sync job tracking and metrics
   - `BankInfo`: Bank registry metadata

2. **Database Schema** (Lines 88-275)
   - 5 main tables with comprehensive indexing
   - Automatic timestamp triggers
   - Foreign key constraints for data integrity

3. **Database Manager** (Lines 281-1093)
   - `FinanceHubDbManager` class for all database operations
   - CRUD operations for banks, accounts, and transactions
   - Analytics and statistics methods

## Database Schema

### 1. Banks Table (Lines 92-104)
**Purpose**: Central registry of supported banks

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (e.g., 'shinhan', 'kookmin') |
| name | TEXT | English name |
| name_ko | TEXT | Korean name |
| color | TEXT | Brand color (#hex) |
| icon | TEXT | Emoji icon |
| supports_automation | INTEGER | Whether automation is supported |
| login_url | TEXT | Bank's login URL |
| metadata | TEXT | JSON for extra fields |

**Seeded Banks** (Lines 112-125):
- Shinhan Bank (신한은행) - Blue (#0046FF) 🏦
- KB Kookmin Bank (KB국민은행) - Yellow (#FFBC00) ⭐
- Woori Bank (우리은행) - Blue (#0072BC) 🏛️
- Hana Bank (하나은행) - Green (#009775) 🌿
- NH Bank (NH농협은행) - Green (#00B140) 🌾
- IBK Bank (IBK기업은행) - Navy (#004A98) 🏢
- Kakao Bank (카카오뱅크) - Yellow (#FFEB00) 💬
- Toss Bank (토스뱅크) - Blue (#0064FF) 💸

### 2. Accounts Table (Lines 130-151)
**Purpose**: Store account information from multiple banks

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| bank_id | TEXT | Foreign key to banks |
| account_number | TEXT | Account number |
| account_name | TEXT | Account nickname |
| customer_name | TEXT | Account holder name |
| balance | INTEGER | Current balance |
| available_balance | INTEGER | Available balance |
| currency | TEXT | Currency code (default: KRW) |
| account_type | TEXT | checking/savings/deposit |
| open_date | TEXT | Account opening date |
| last_synced_at | TEXT | Last sync timestamp |
| is_active | INTEGER | Active status (0/1) |
| metadata | TEXT | JSON for bank-specific fields |

**Constraints**:
- UNIQUE(bank_id, account_number) - Prevents duplicate accounts
- Auto-updating updated_at via trigger

### 3. Transactions Table (Lines 156-179)
**Purpose**: Universal transaction storage for all banks

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| account_id | TEXT | FK to accounts |
| bank_id | TEXT | Denormalized for faster queries |
| date | TEXT | YYYY-MM-DD format |
| time | TEXT | HH:MM:SS format |
| type | TEXT | Bank-specific transaction type |
| category | TEXT | AI-classified category |
| withdrawal | INTEGER | Withdrawal amount |
| deposit | INTEGER | Deposit amount |
| description | TEXT | Transaction description |
| memo | TEXT | Additional notes |
| balance | INTEGER | Balance after transaction |
| branch | TEXT | Branch information |
| counterparty | TEXT | Transfer recipient/sender |
| transaction_id | TEXT | Bank's transaction ID |
| metadata | TEXT | JSON for extra fields |

**Key Features**:
- Deduplication via unique index on (account_id, date, time, withdrawal, deposit, balance)
- Cascade deletion when account is deleted
- Comprehensive indexing for performance

### 4. Sync Operations Table (Lines 184-210)
**Purpose**: Track synchronization jobs and their results

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| account_id | TEXT | FK to accounts |
| bank_id | TEXT | FK to banks |
| status | TEXT | running/completed/failed |
| sync_type | TEXT | full/incremental |
| started_at | TEXT | Job start time |
| completed_at | TEXT | Job completion time |
| duration | INTEGER | Duration in milliseconds |
| query_period_start | TEXT | Query date range start |
| query_period_end | TEXT | Query date range end |
| total_count | INTEGER | Total transactions processed |
| new_count | INTEGER | Newly inserted records |
| skipped_count | INTEGER | Duplicate records skipped |
| total_deposits | INTEGER | Sum of all deposits |
| deposit_count | INTEGER | Number of deposits |
| total_withdrawals | INTEGER | Sum of all withdrawals |
| withdrawal_count | INTEGER | Number of withdrawals |
| file_path | TEXT | Export file path (Excel/CSV) |
| error_message | TEXT | Error details if failed |

### 5. Saved Credentials Table (Lines 215-227)
**Purpose**: Store encrypted banking credentials

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| bank_id | TEXT | Unique FK to banks |
| user_id_encrypted | TEXT | Encrypted user ID |
| password_encrypted | TEXT | Encrypted password |
| encryption_iv | TEXT | Initialization vector for decryption |

## Performance Optimizations

### Indexes (Lines 232-255)
1. **Account Indexes**:
   - `idx_accounts_bank_id`: Fast bank filtering
   - `idx_accounts_account_number`: Quick account lookup
   - `idx_accounts_bank_account`: Composite for uniqueness checks

2. **Transaction Indexes** (Critical for performance):
   - `idx_transactions_account_id`: Filter by account
   - `idx_transactions_bank_id`: Filter by bank
   - `idx_transactions_date`: Date range queries
   - `idx_transactions_category`: Category filtering
   - `idx_transactions_account_date`: Composite for account timeline
   - `idx_transactions_bank_date`: Composite for bank timeline
   - `idx_transactions_dedup`: UNIQUE index for deduplication

3. **Sync Operation Indexes**:
   - Multiple indexes on account_id, bank_id, status, started_at

## Key Features and Methods

### Bank Operations (Lines 292-316)
- `getAllBanks()`: Get all registered banks
- `getBank(bankId)`: Get specific bank info

### Account Operations (Lines 322-462)
- `upsertAccount(data)`: Create or update account
- `getAccount(id)`: Get account by ID
- `getAccountByNumber(bankId, accountNumber)`: Find specific account
- `getAccountsByBank(bankId)`: Get all accounts for a bank
- `getAllAccounts()`: Get all accounts across banks
- `updateAccountStatus(accountNumber, isActive)`: Activate/deactivate account
- `deleteAccount(accountNumber)`: Delete account and its transactions

### Transaction Operations (Lines 468-628)
- `bulkInsertTransactions(accountId, bankId, transactions)`: Batch insert with deduplication
  - Uses `INSERT OR IGNORE` for automatic duplicate skipping
  - Returns `{ inserted, skipped }` counts
  - Wrapped in transaction for atomicity

- `queryTransactions(options)`: Flexible transaction search
  - Filters: accountId, bankId, dateRange, category, amount, searchText
  - Pagination: limit, offset
  - Sorting: by date/amount/balance, asc/desc
  - Full-text search in description, memo, counterparty

### Statistics & Analytics (Lines 634-789)
- `getTransactionStats(options)`: Aggregate statistics
  - Total transactions, deposits, withdrawals
  - Deposit/withdrawal counts
  - Net change calculation

- `getMonthlySummary(options)`: Monthly breakdown
  - Group by year-month and bank
  - Deposit/withdrawal totals and counts
  - Net change per month

- `getOverallStats()`: System-wide statistics
  - Total banks, accounts, transactions
  - Total balance across all accounts
  - Per-bank breakdown with account/transaction counts

### Sync Operations (Lines 795-915)
- `createSyncOperation(data)`: Start new sync job
- `completeSyncOperation(id, results)`: Mark sync as completed with metrics
- `failSyncOperation(id, errorMessage)`: Mark sync as failed
- `getSyncOperation(id)`: Get sync operation details
- `getRecentSyncOperations(limit)`: Get recent sync history

### High-Level Import (Lines 925-1021)
- `importTransactions(bankId, accountData, transactions, syncMetadata)`: Complete import workflow
  1. Upserts account information
  2. Creates sync operation
  3. Bulk inserts transactions (with deduplication)
  4. Calculates totals and statistics
  5. Completes sync operation with results
  6. Returns comprehensive import summary

## Data Integrity Features

1. **Deduplication**: UNIQUE index prevents duplicate transactions
2. **Cascade Deletion**: Transactions auto-delete when account is removed
3. **Numeric Safety**: All monetary values converted to Number to prevent string concatenation
4. **Transaction Wrapping**: Batch operations use SQLite transactions for atomicity
5. **Automatic Timestamps**: Triggers update `updated_at` on changes

## Key Design Patterns

### 1. Bank-Agnostic Schema
- Single schema supports all Korean banks
- Bank-specific data stored in JSON `metadata` fields
- Denormalized `bank_id` in transactions for query performance

### 2. Flexible Metadata
- All main tables have `metadata` TEXT column
- Stores JSON for bank-specific or future fields
- Prevents schema changes for edge cases

### 3. Comprehensive Tracking
- Every sync operation tracked with detailed metrics
- Enables audit trail and performance monitoring
- Supports incremental vs full sync differentiation

### 4. Type Safety
- TypeScript interfaces for all data models
- Row mappers convert DB rows to typed objects
- Prevents type errors in application code

## File Location
`src/main/sqlite/financehub.ts`

## Dependencies
- `better-sqlite3`: Fast synchronous SQLite3 bindings
- `crypto`: UUID generation via `randomUUID()`

## Summary
Finance Hub Database provides a robust, scalable solution for managing multi-bank financial data in Korean banking applications. Its unified schema, comprehensive indexing, and transaction safety features make it suitable for production use in financial applications requiring reliable data storage and retrieval across multiple banking institutions.

---

## See Also

- **[FINANCEHUB_COMPLETE_SUMMARY.md](./FINANCEHUB_COMPLETE_SUMMARY.md)** - Complete automation framework documentation
  - Bank automators (Shinhan, KB Kookmin, NH, NH Business)
  - Card company automators (6 card companies)
  - AI-powered virtual keyboard handling
  - Transaction history retrieval
  - Scheduler system
  - Type definitions and utilities

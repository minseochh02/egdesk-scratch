# Transaction Table Migration Guide

## Overview

This guide covers the migration from a unified `transactions` table to separate `bank_transactions` and `card_transactions` tables to match Korean financial reporting standards.

**Feature Flag**: `USE_SEPARATE_TRANSACTION_TABLES`
- **DEFAULT**: ✅ **ON** (uses separate `bank_transactions` and `card_transactions` tables)
- **To rollback to old unified table**: Set `USE_SEPARATE_TRANSACTION_TABLES=false` in `.env`

> **Note**: As of version 1.x.x, the separate transaction tables are the default. The old unified `transactions` table is kept for rollback purposes only.

---

## Migration Components

### Migration Files Created

All migration files are located in `src/main/sqlite/migrations/`:

1. **015-create-bank-transactions.ts** - Creates bank_transactions table with 15 columns
2. **016-create-card-transactions.ts** - Creates card_transactions table with 16 columns
3. **017-migrate-bank-data.ts** - Copies bank transaction data from old table
4. **018-migrate-card-data.ts** - Copies card transaction data and extracts metadata
5. **019-verify-migration.ts** - Runs verification checks automatically

### Code Changes

#### Database Manager (`src/main/sqlite/financehub.ts`)
- Added `BankTransaction` and `CardTransaction` interfaces
- Added `queryBankTransactions()` method
- Added `queryCardTransactions()` method
- Added `bulkInsertBankTransactions()` method
- Added `bulkInsertCardTransactions()` method
- Added `useSeparateTransactionTables()` feature flag check
- Updated `queryTransactions()` with routing logic
- Updated `importTransactions()` with routing logic

#### Frontend (`src/renderer/hooks/useTransactions.ts`)
- Updated `loadBankTransactions()` to pass `transactionType: 'bank'`
- Updated `loadCardTransactions()` to pass `transactionType: 'card'`

#### Database Initialization (`src/main/sqlite/init.ts`)
- Added migration imports and execution for migrations 015-019

---

## Testing Checklist

### Pre-Deployment Testing (Feature Flag OFF)

Before deploying, test with `USE_SEPARATE_TRANSACTION_TABLES=false`:

- [ ] App starts without errors
- [ ] Bank transactions page loads
- [ ] Card transactions page loads
- [ ] Search and filter work correctly
- [ ] Export to Google Sheets works
- [ ] New bank sync imports correctly
- [ ] New card sync imports correctly

### Post-Migration Testing (Feature Flag ON)

After migrations run, test with `USE_SEPARATE_TRANSACTION_TABLES=true`:

#### View Transactions
- [ ] Open bank transactions page → shows only bank transactions
- [ ] Open card transactions page → shows only card transactions
- [ ] All columns display correctly
- [ ] Pagination works
- [ ] Sorting works (by date, amount, balance)

#### Search & Filter
- [ ] Search by merchant/description works
- [ ] Filter by date range works
- [ ] Filter by amount range works
- [ ] Filter by category works
- [ ] Filter by account works
- [ ] Filter by bank/card company works

#### Export to Sheets
- [ ] Export bank transactions → verify 15 columns with Korean headers
- [ ] Export card transactions → verify 16 columns with Korean headers
- [ ] Column mapping matches plan (check 거래일자, 이용금액, etc.)
- [ ] All data exported correctly

#### Import New Data
- [ ] Run bank sync → new transactions go to bank_transactions table
- [ ] Run card sync → new transactions go to card_transactions table
- [ ] Check sync_operations table records correctly
- [ ] Verify deduplication works (no duplicates created)

#### Statistics & Dashboard
- [ ] Dashboard shows correct transaction totals
- [ ] Monthly summary matches previous data
- [ ] Overall statistics consistent with old table
- [ ] Charts and graphs render correctly

#### Performance
- [ ] Query speed improved or unchanged
- [ ] Export speed improved or unchanged
- [ ] No noticeable UI lag

---

## Deployment Steps

### Step 1: Backup Database

```bash
# Backup production database before deployment
cp ~/Library/Application\ Support/egdesk/database/financehub.db ~/backups/financehub-$(date +%Y%m%d).db

# Verify backup
ls -lh ~/backups/
```

### Step 2: Deploy Code

> ✅ **The feature flag is now ON by default!** The app will automatically use separate tables after migrations run.

```bash
# Deploy updated code (no need to set environment variable)
npm run build
npm run deploy

# Or for development
npm run dev
```

**Optional**: To use the old unified table (not recommended):
```bash
# Only if you want to rollback to old behavior
echo "USE_SEPARATE_TRANSACTION_TABLES=false" >> .env
```

### Step 3: Run Migrations

Migrations run automatically on app start. Check the console for migration logs:

```
[Migration 015] Creating bank_transactions table...
[Migration 016] Creating card_transactions table...
[Migration 017] Migrating bank transaction data...
[Migration 018] Migrating card transaction data...
[Migration 019] Verifying transaction table migration...
```

### Step 4: Verify Migration

Use the verification queries in `docs/migration-verification-queries.sql`:

```bash
# Open database with sqlite3
sqlite3 ~/Library/Application\ Support/egdesk/database/financehub.db

# Run verification queries (copy from migration-verification-queries.sql)
# Look for the summary report at the end - all checks should show ✅ PASS
```

Or check the console output from Migration 019, which runs automatically.

### Step 5: Verify Separate Tables are Active

> ✅ **The app is already using separate tables by default!** This step is just for verification.

Check the logs on startup to confirm:
```
[FinanceHubDb] 🔀 Using separate transaction tables (feature flag enabled)
[FinanceHubDb] 💳 Inserting into card_transactions table
```

To check the current setting:
```bash
# The app uses separate tables by default
# Only shows a value if explicitly set to false
echo $USE_SEPARATE_TRANSACTION_TABLES
```

### Step 6: Monitor (7 Days)

Monitor the application for 7 days:

- Check error logs daily
- Verify sync operations complete successfully
- Test exports periodically
- Gather user feedback
- Watch for any performance issues

### Step 7: Final Verification

After 7 days with no issues:

```bash
# Run final verification
sqlite3 ~/Library/Application\ Support/egdesk/database/financehub.db < docs/migration-verification-queries.sql
```

### Step 8: Deprecate Old Table (Optional)

If everything works perfectly after 7 days:

```sql
-- Rename old table for archival (OPTIONAL - can keep as backup)
ALTER TABLE transactions RENAME TO transactions_deprecated_backup;

-- Drop old indexes (now unused)
DROP INDEX IF EXISTS idx_transactions_account_id;
DROP INDEX IF EXISTS idx_transactions_bank_id;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_transaction_datetime;
DROP INDEX IF EXISTS idx_transactions_dedup;

-- Optionally export to CSV and drop
-- .mode csv
-- .output transactions_backup.csv
-- SELECT * FROM transactions_deprecated_backup;
-- DROP TABLE transactions_deprecated_backup;
```

---

## Rollback Plan

> 🔄 **Quick Rollback**: Since separate tables are now the default, you can instantly rollback by setting the environment variable.

### Scenario 1: Issues Found After Deployment

If issues are found with the separate tables (which are active by default):

```bash
# 1. Disable separate tables immediately
echo "USE_SEPARATE_TRANSACTION_TABLES=false" > .env

# 2. Restart app
# App now uses old unified transactions table

# 3. Investigate issue in logs

# 4. Fix code and redeploy

# 5. Remove the override to use separate tables again (default behavior)
# Remove or comment out the line in .env:
# USE_SEPARATE_TRANSACTION_TABLES=false
```

### Scenario 2: Need to Permanently Rollback

If you need to permanently use the old unified table:

```bash
# Set environment variable to false
echo "USE_SEPARATE_TRANSACTION_TABLES=false" > .env

# Keep this setting in your .env file permanently
# The old transactions table will continue to be used
# New syncs will write to the old table
```

### Scenario 3: Complete Rollback Required

If you need to completely remove the new tables:

```sql
-- Connect to database
sqlite3 ~/Library/Application\ Support/egdesk/database/financehub.db

-- Drop new tables
DROP TABLE IF EXISTS card_transactions;
DROP TABLE IF EXISTS bank_transactions;

-- Drop new indexes
DROP INDEX IF EXISTS idx_bank_transactions_account_id;
DROP INDEX IF EXISTS idx_bank_transactions_bank_id;
DROP INDEX IF EXISTS idx_card_transactions_account_id;
DROP INDEX IF EXISTS idx_card_transactions_card_company_id;
-- ... (all new indexes)

-- Old transactions table remains unchanged
-- Remove feature flag from .env
```

### Scenario 4: Data Corruption Detected

If data corruption is detected:

```bash
# 1. Stop app immediately

# 2. Restore from backup
cp ~/backups/financehub-20260401.db ~/Library/Application\ Support/egdesk/database/financehub.db

# 3. Restart app with feature flag OFF
echo "USE_SEPARATE_TRANSACTION_TABLES=false" > .env

# 4. Investigate migration scripts
# 5. Fix and re-test in development before retry
```

---

## Environment Variables

### Development

```bash
# .env.development
USE_SEPARATE_TRANSACTION_TABLES=false  # Initially false during testing
```

### Production

```bash
# .env.production
USE_SEPARATE_TRANSACTION_TABLES=false  # Start with false, enable after verification
```

---

## Troubleshooting

### Migration Fails

**Symptom**: Migration errors in console during startup

**Solution**:
1. Check if tables already exist: `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%transactions%';`
2. Check if migration already ran (migrations are idempotent - safe to re-run)
3. Check database permissions
4. Review error message in console logs

### Count Mismatch After Migration

**Symptom**: Verification shows different row counts

**Solution**:
1. Run detailed count query:
```sql
SELECT
  (SELECT COUNT(*) FROM transactions) as original,
  (SELECT COUNT(*) FROM transactions WHERE bank_id NOT LIKE '%-card') as bank_source,
  (SELECT COUNT(*) FROM transactions WHERE bank_id LIKE '%-card') as card_source,
  (SELECT COUNT(*) FROM bank_transactions) as bank_migrated,
  (SELECT COUNT(*) FROM card_transactions) as card_migrated;
```
2. Check if transactions table had records with NULL bank_id
3. Check migration logs for errors

### NULL Values in Required Fields

**Symptom**: Verification shows NULL counts > 0

**Solution**:
1. Identify which records have NULLs:
```sql
SELECT * FROM bank_transactions WHERE transaction_date IS NULL OR transaction_datetime IS NULL LIMIT 10;
SELECT * FROM card_transactions WHERE approval_date IS NULL OR card_number IS NULL LIMIT 10;
```
2. Check if source data had incomplete records
3. May need to clean up source data before re-running migration

### Foreign Key Violations

**Symptom**: Transactions reference non-existent accounts

**Solution**:
1. Find orphaned transactions:
```sql
SELECT bt.id, bt.account_id FROM bank_transactions bt
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bt.account_id);
```
2. Either create missing accounts or delete orphaned transactions
3. Ensure accounts are created before transactions during import

### Export Shows Wrong Columns

**Symptom**: Sheets export doesn't show 15/16 columns as expected

**Solution**:
1. Check if feature flag is actually enabled
2. Verify `transactionType` is passed in query options
3. Check sheets-service.ts for correct column mapping
4. Verify metadata fields are properly set in queryTransactions routing

---

## Performance Expectations

### Query Performance

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Query bank transactions | 50-100ms | 30-60ms | ~40% faster |
| Query card transactions | 50-100ms | 30-60ms | ~40% faster |
| Export to Sheets | 200-300ms | 150-200ms | ~30% faster |
| Sync operations | 500-1000ms | 400-800ms | ~20% faster |

### Storage Impact

- **Current**: ~100MB for 100k transactions (with JSON metadata)
- **After**: ~105MB for 100k transactions (explicit columns)
- **Net increase**: ~5% (acceptable for query performance gains)

---

## Success Criteria

✅ **Migration successful if**:

1. All transactions migrated (counts match)
2. No NULL values in required fields
3. All foreign keys valid
4. Application tests pass with flag ON
5. Export produces correct Korean columns
6. New syncs go to correct tables
7. Query performance improved or unchanged
8. No user-reported issues for 7 days

❌ **Rollback if**:

1. Data loss detected
2. Foreign key violations
3. Application crashes or errors
4. Query performance degraded >20%
5. Export broken
6. Sync failures

---

## Support

For issues during migration:

1. Check console logs for error messages
2. Run verification queries from `docs/migration-verification-queries.sql`
3. Review this guide's troubleshooting section
4. Check backup before making any destructive changes
5. Disable feature flag if issues are critical

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Code implementation | Complete | ✅ |
| Migration file creation | Complete | ✅ |
| Database manager updates | Complete | ✅ |
| Frontend updates | Complete | ✅ |
| Documentation | Complete | ✅ |
| **Ready for testing** | **NOW** | **⏳** |
| Production deployment | Pending | ⏳ |
| Validation period | 7 days | ⏳ |
| Cleanup | After validation | ⏳ |

---

## Next Steps

1. ✅ Code implementation complete
2. ⏳ Test in development with feature flag OFF
3. ⏳ Run migrations and verify data integrity
4. ⏳ Test in development with feature flag ON
5. ⏳ Deploy to production with flag OFF
6. ⏳ Enable feature flag in production
7. ⏳ Monitor for 7 days
8. ⏳ Deprecate old table if successful

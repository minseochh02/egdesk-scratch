-- =============================================
-- Transaction Table Migration Verification Queries
-- =============================================
-- Use these queries to verify the migration from unified transactions table
-- to separate bank_transactions and card_transactions tables
--
-- Run these queries against the financehub.db database

-- =============================================
-- 1. PRE-MIGRATION CHECKS
-- =============================================

-- Count total transactions before migration
SELECT COUNT(*) as total_transactions FROM transactions;

-- Count by transaction type (bank vs card)
SELECT
  CASE WHEN bank_id LIKE '%-card' THEN 'card' ELSE 'bank' END as type,
  COUNT(*) as count
FROM transactions
GROUP BY type;

-- Get date range
SELECT
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM transactions;

-- Sum amounts by type
SELECT
  'Bank Deposits' as metric,
  SUM(deposit) as total
FROM transactions
WHERE bank_id NOT LIKE '%-card'
UNION ALL
SELECT
  'Bank Withdrawals' as metric,
  SUM(withdrawal) as total
FROM transactions
WHERE bank_id NOT LIKE '%-card'
UNION ALL
SELECT
  'Card Transactions' as metric,
  SUM(withdrawal + deposit) as total
FROM transactions
WHERE bank_id LIKE '%-card';

-- =============================================
-- 2. POST-MIGRATION ROW COUNT VERIFICATION
-- =============================================

-- Verify total row counts match
SELECT
  (SELECT COUNT(*) FROM transactions) as original_count,
  (SELECT COUNT(*) FROM bank_transactions) as bank_count,
  (SELECT COUNT(*) FROM card_transactions) as card_count,
  (SELECT COUNT(*) FROM bank_transactions) +
  (SELECT COUNT(*) FROM card_transactions) as total_migrated,
  CASE
    WHEN (SELECT COUNT(*) FROM transactions) =
         (SELECT COUNT(*) FROM bank_transactions) +
         (SELECT COUNT(*) FROM card_transactions)
    THEN '✅ Counts match'
    ELSE '❌ Count mismatch'
  END as status;

-- =============================================
-- 3. CHECK FOR NULL VALUES IN REQUIRED FIELDS
-- =============================================

-- Bank transactions - check for NULLs in required fields
SELECT 'Bank Transactions - NULL Check' as check_type,
  COUNT(*) as null_count
FROM bank_transactions
WHERE transaction_date IS NULL
   OR transaction_datetime IS NULL
   OR account_id IS NULL
   OR bank_id IS NULL;

-- Card transactions - check for NULLs in required fields
SELECT 'Card Transactions - NULL Check' as check_type,
  COUNT(*) as null_count
FROM card_transactions
WHERE approval_date IS NULL
   OR approval_datetime IS NULL
   OR card_number IS NULL
   OR merchant_name IS NULL
   OR account_id IS NULL
   OR card_company_id IS NULL;

-- =============================================
-- 4. FOREIGN KEY INTEGRITY CHECKS
-- =============================================

-- Bank transactions with invalid account_id
SELECT 'Bank TXs - Invalid account_id' as check_type,
  COUNT(*) as invalid_count
FROM bank_transactions bt
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bt.account_id);

-- Card transactions with invalid account_id
SELECT 'Card TXs - Invalid account_id' as check_type,
  COUNT(*) as invalid_count
FROM card_transactions ct
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = ct.account_id);

-- Bank transactions with invalid bank_id
SELECT 'Bank TXs - Invalid bank_id' as check_type,
  COUNT(*) as invalid_count
FROM bank_transactions bt
WHERE NOT EXISTS (SELECT 1 FROM banks b WHERE b.id = bt.bank_id);

-- Card transactions with invalid card_company_id
SELECT 'Card TXs - Invalid card_company_id' as check_type,
  COUNT(*) as invalid_count
FROM card_transactions ct
WHERE NOT EXISTS (SELECT 1 FROM banks b WHERE b.id = ct.card_company_id);

-- =============================================
-- 5. DUPLICATE ID CHECKS
-- =============================================

-- Check for duplicate IDs across both tables
SELECT id, COUNT(*) as occurrence_count
FROM (
  SELECT id FROM bank_transactions
  UNION ALL
  SELECT id FROM card_transactions
)
GROUP BY id
HAVING COUNT(*) > 1;

-- Check for duplicate transactions within bank_transactions
SELECT
  account_id,
  transaction_datetime,
  withdrawal,
  deposit,
  balance,
  COUNT(*) as duplicate_count
FROM bank_transactions
GROUP BY account_id, transaction_datetime, withdrawal, deposit, balance
HAVING COUNT(*) > 1;

-- Check for duplicate transactions within card_transactions
SELECT
  account_id,
  approval_datetime,
  card_number,
  merchant_name,
  amount,
  COUNT(*) as duplicate_count
FROM card_transactions
GROUP BY account_id, approval_datetime, card_number, merchant_name, amount
HAVING COUNT(*) > 1;

-- =============================================
-- 6. AMOUNT VERIFICATION
-- =============================================

-- Compare bank transaction amounts
SELECT
  'Original Bank Deposits' as metric,
  SUM(deposit) as amount
FROM transactions
WHERE bank_id NOT LIKE '%-card'
UNION ALL
SELECT
  'Migrated Bank Deposits' as metric,
  SUM(deposit) as amount
FROM bank_transactions
UNION ALL
SELECT
  'Original Bank Withdrawals' as metric,
  SUM(withdrawal) as amount
FROM transactions
WHERE bank_id NOT LIKE '%-card'
UNION ALL
SELECT
  'Migrated Bank Withdrawals' as metric,
  SUM(withdrawal) as amount
FROM bank_transactions;

-- Compare card transaction amounts
SELECT
  'Original Card Total' as metric,
  SUM(withdrawal + deposit) as amount
FROM transactions
WHERE bank_id LIKE '%-card'
UNION ALL
SELECT
  'Migrated Card Total (non-cancelled)' as metric,
  SUM(amount) as amount
FROM card_transactions
WHERE is_cancelled = 0
UNION ALL
SELECT
  'Migrated Card Total (all)' as metric,
  SUM(amount) as amount
FROM card_transactions;

-- =============================================
-- 7. DATE RANGE VERIFICATION
-- =============================================

-- Compare date ranges
SELECT
  'Original Transactions' as source,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM transactions
UNION ALL
SELECT
  'Bank Transactions' as source,
  MIN(transaction_date) as earliest_date,
  MAX(transaction_date) as latest_date
FROM bank_transactions
UNION ALL
SELECT
  'Card Transactions' as source,
  MIN(approval_date) as earliest_date,
  MAX(approval_date) as latest_date
FROM card_transactions;

-- =============================================
-- 8. SAMPLING CHECK (SPOT CHECK)
-- =============================================

-- Sample 5 bank transactions to verify data integrity
SELECT
  'Bank Sample' as sample_type,
  bt.id,
  bt.transaction_date,
  bt.deposit,
  bt.withdrawal,
  bt.balance,
  bt.description
FROM bank_transactions bt
LIMIT 5;

-- Sample 5 card transactions to verify data integrity
SELECT
  'Card Sample' as sample_type,
  ct.id,
  ct.approval_date,
  ct.merchant_name,
  ct.amount,
  ct.card_number
FROM card_transactions ct
LIMIT 5;

-- =============================================
-- 9. SUMMARY REPORT
-- =============================================

SELECT
  '=============================================' as separator
UNION ALL
SELECT 'MIGRATION VERIFICATION SUMMARY'
UNION ALL
SELECT '============================================='
UNION ALL
SELECT ''
UNION ALL
SELECT 'Row Count Status: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM transactions) =
         (SELECT COUNT(*) FROM bank_transactions) +
         (SELECT COUNT(*) FROM card_transactions)
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT 'Bank NULL Fields: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM bank_transactions
          WHERE transaction_date IS NULL OR transaction_datetime IS NULL
             OR account_id IS NULL OR bank_id IS NULL) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT 'Card NULL Fields: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM card_transactions
          WHERE approval_date IS NULL OR approval_datetime IS NULL
             OR card_number IS NULL OR merchant_name IS NULL
             OR account_id IS NULL OR card_company_id IS NULL) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT 'Bank Foreign Keys: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM bank_transactions bt
          WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = bt.account_id)) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT 'Card Foreign Keys: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM card_transactions ct
          WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = ct.account_id)) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT 'No Duplicate IDs: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM (
            SELECT id FROM bank_transactions
            UNION ALL
            SELECT id FROM card_transactions
          )
          GROUP BY id
          HAVING COUNT(*) > 1) = 0
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END
UNION ALL
SELECT ''
UNION ALL
SELECT '============================================='
UNION ALL
SELECT 'If all checks show ✅ PASS, migration is successful!';

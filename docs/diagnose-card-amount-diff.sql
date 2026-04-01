-- Diagnostic query to check card amount differences

-- 1. Check how many cancelled transactions exist
SELECT
  'Cancelled Transactions' as metric,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM card_transactions
WHERE is_cancelled = 1;

-- 2. Compare totals with and without cancelled
SELECT
  'Total (all transactions)' as metric,
  SUM(amount) as amount
FROM card_transactions
UNION ALL
SELECT
  'Total (non-cancelled only)' as metric,
  SUM(amount) as amount
FROM card_transactions
WHERE is_cancelled = 0
UNION ALL
SELECT
  'Original total' as metric,
  SUM(withdrawal + deposit) as amount
FROM transactions
WHERE bank_id LIKE '%-card';

-- 3. Check if metadata has isCancelled field in original
SELECT
  'Transactions with isCancelled in metadata' as metric,
  COUNT(*) as count
FROM transactions
WHERE bank_id LIKE '%-card'
  AND metadata LIKE '%isCancelled%';

-- 4. Sample cancelled transactions
SELECT
  'Sample Cancelled Transactions' as info,
  id,
  approval_date,
  merchant_name,
  amount,
  is_cancelled
FROM card_transactions
WHERE is_cancelled = 1
LIMIT 5;

-- 5. Check if there are transactions with amount = 0
SELECT
  'Zero Amount Transactions' as metric,
  COUNT(*) as count
FROM card_transactions
WHERE amount = 0;

-- 6. Check for any NULL amounts
SELECT
  'NULL Amount Transactions' as metric,
  COUNT(*) as count
FROM card_transactions
WHERE amount IS NULL;

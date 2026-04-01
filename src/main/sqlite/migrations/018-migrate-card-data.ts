import Database from 'better-sqlite3';

/**
 * Migration 018: Migrate card transaction data
 *
 * Copies card transactions from the unified transactions table to the new
 * card_transactions table. Identifies card transactions by bank_id ending with '-card'.
 * Extracts metadata fields to proper columns instead of keeping them in JSON.
 */
export function migrate018MigrateCardData(db: Database.Database): void {
  console.log('[Migration 018] Migrating card transaction data...');

  // Check if source table exists
  const sourceTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'
  `).all();

  if (sourceTable.length === 0) {
    console.log('  ℹ️ Source transactions table does not exist - skipping migration');
    return;
  }

  // Check if destination table exists
  const destTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='card_transactions'
  `).all();

  if (destTable.length === 0) {
    console.log('  ❌ Destination card_transactions table does not exist - run migration 016 first');
    return;
  }

  // Check if already migrated
  const existingCount = db.prepare(`SELECT COUNT(*) as count FROM card_transactions`).get() as { count: number };
  if (existingCount.count > 0) {
    console.log(`  ℹ️ card_transactions already has ${existingCount.count} records - skipping migration`);
    return;
  }

  // Count card transactions to migrate
  const sourceCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM transactions
    WHERE bank_id LIKE '%-card'
  `).get() as { count: number };

  console.log(`  📊 Found ${sourceCount.count} card transactions to migrate`);

  if (sourceCount.count === 0) {
    console.log('  ℹ️ No card transactions to migrate');
    return;
  }

  // Migrate card transaction data
  console.log('  🔄 Copying card transaction data and extracting metadata...');

  // Fetch all card transactions from source
  const cardTransactions = db.prepare(`
    SELECT
      t.*,
      a.account_number,
      a.account_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE t.bank_id LIKE '%-card'
  `).all() as any[];

  console.log(`  📦 Processing ${cardTransactions.length} card transactions...`);

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT INTO card_transactions (
      id,
      account_id,
      card_company_id,
      headquarters_name,
      department_name,
      card_number,
      card_type,
      cardholder_name,
      transaction_bank,
      usage_type,
      sales_type,
      approval_datetime,
      approval_date,
      billing_date,
      approval_number,
      merchant_name,
      amount,
      foreign_amount_usd,
      memo,
      category,
      is_cancelled,
      created_at,
      updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  // Process each transaction and extract metadata
  let successCount = 0;
  let errorCount = 0;

  for (const txn of cardTransactions) {
    try {
      // Parse metadata JSON
      let metadata: any = {};
      if (txn.metadata) {
        try {
          metadata = JSON.parse(txn.metadata);
        } catch (e) {
          console.warn(`  ⚠️ Failed to parse metadata for transaction ${txn.id}`);
        }
      }

      // Extract card-specific fields from metadata
      const headquartersName = metadata.headquartersName || metadata.본부명 || null;
      const departmentName = metadata.departmentName || metadata.부서명 || null;
      const cardNumber = metadata.cardNumber || metadata.카드번호 || 'UNKNOWN';
      const cardType = metadata.cardType || metadata.카드구분 || null;
      const cardholderName = metadata.userName || metadata.cardHolder || metadata.카드소지자 || null;
      const transactionBank = metadata.transactionBank || metadata.거래은행 || null;
      const usageType = metadata.transactionMethod || metadata.사용구분 || null;
      const salesType = metadata.salesType || metadata.매출종류 || null;
      const billingDate = metadata.billingDate || metadata.청구일자 || null;
      const approvalNumber = metadata.approvalNumber || metadata.승인번호 || null;
      const foreignAmountUsd = metadata.foreignAmountUSD || null;
      const isCancelled = metadata.isCancelled || metadata.취소 || 0;

      // Determine approval_datetime and approval_date
      const approvalDatetime = txn.transaction_datetime || (txn.date + ' ' + (txn.time || '00:00:00'));
      const approvalDate = txn.date;

      // Determine merchant name (from description)
      const merchantName = txn.description || 'UNKNOWN';

      // Determine amount (card transactions usually use withdrawal)
      const amount = txn.withdrawal || txn.deposit || 0;

      // Insert into card_transactions
      insertStmt.run(
        txn.id,
        txn.account_id,
        txn.bank_id, // card_company_id
        headquartersName,
        departmentName,
        cardNumber,
        cardType,
        cardholderName,
        transactionBank,
        usageType,
        salesType,
        approvalDatetime,
        approvalDate,
        billingDate,
        approvalNumber,
        merchantName,
        amount,
        foreignAmountUsd,
        txn.memo,
        txn.category,
        isCancelled ? 1 : 0,
        txn.created_at,
        new Date().toISOString()
      );

      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate transaction ${txn.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`  ✅ Successfully migrated ${successCount} card transactions`);
  if (errorCount > 0) {
    console.log(`  ⚠️ Failed to migrate ${errorCount} card transactions`);
  }

  // Verify migration
  const migratedCount = db.prepare(`SELECT COUNT(*) as count FROM card_transactions`).get() as { count: number };
  console.log(`  🔍 Verification: card_transactions now has ${migratedCount.count} records`);

  if (migratedCount.count === successCount) {
    console.log('  ✅ Migration successful - counts match');
  } else {
    console.log(`  ⚠️ Count mismatch: expected ${successCount}, got ${migratedCount.count}`);
  }

  console.log('[Migration 018] Card transaction data migration complete');
}

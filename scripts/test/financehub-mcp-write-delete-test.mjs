#!/usr/bin/env node
/**
 * Smoke test: FinanceHub MCP upsert → import → list → delete
 * Requires EGDesk running with financehub MCP enabled on localhost:8080
 */

const BASE = process.env.EGDESK_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EGDESK_API_KEY || process.argv[2] || '';

const TEST_BANK_ID = 'serp';
const TEST_CARD_ID = 'bc-card';
const TEST_BANK_ACCOUNT = 'MCP-TEST-BANK-99001';
const TEST_CARD_ACCOUNT = 'MCP-TEST-CARD-99002';

async function callTool(tool, args = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;

  const res = await fetch(`${BASE}/financehub/tools/call`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool, arguments: args }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `${tool} failed HTTP ${res.status}`);
  }
  const text = data.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : data.result;
}

function log(step, payload) {
  console.log(`\n✓ ${step}`);
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  console.log(`FinanceHub MCP write/delete test → ${BASE}`);

  // 1. Upsert test bank account
  const bankAcc = await callTool('financehub_upsert_account', {
    bankId: TEST_BANK_ID,
    accountNumber: TEST_BANK_ACCOUNT,
    accountName: 'MCP Test Bank Account',
    balance: 1_000_000,
    accountType: 'checking',
  });
  log('Upsert bank account', bankAcc);

  // 2. Upsert test card account
  const cardAcc = await callTool('financehub_upsert_account', {
    bankId: TEST_CARD_ID,
    accountNumber: TEST_CARD_ACCOUNT,
    accountName: 'MCP Test Card',
    accountType: 'credit',
  });
  log('Upsert card account', cardAcc);

  // 3. Import bank transaction
  const bankImport = await callTool('financehub_import_transactions', {
    bankId: TEST_BANK_ID,
    accountData: {
      accountNumber: TEST_BANK_ACCOUNT,
      accountName: 'MCP Test Bank Account',
    },
    transactions: [
      {
        date: '2026-05-15',
        deposit: 50000,
        description: 'MCP test deposit',
        balance: 1_050_000,
      },
    ],
    syncMetadata: {
      queryPeriodStart: '2026-05-01',
      queryPeriodEnd: '2026-05-31',
    },
  });
  log('Import bank transaction', bankImport);

  // 4. Import card transaction
  const cardImport = await callTool('financehub_import_transactions', {
    bankId: TEST_CARD_ID,
    isCard: true,
    accountData: {
      accountNumber: TEST_CARD_ACCOUNT,
      accountName: 'MCP Test Card',
    },
    transactions: [
      {
        approvalDatetime: '2026-05-16 14:30:00',
        approvalDate: '2026-05-16',
        amount: 12000,
        merchantName: 'MCP Test Merchant',
        cardNumber: TEST_CARD_ACCOUNT,
      },
    ],
    syncMetadata: {
      queryPeriodStart: '2026-05-01',
      queryPeriodEnd: '2026-05-31',
    },
  });
  log('Import card transaction', cardImport);

  // 5. Verify accounts exist
  const accounts = await callTool('financehub_list_accounts', {
    bankId: TEST_BANK_ID,
  });
  const bankListed = accounts.accounts?.some(
    (a) => a.accountNumber === TEST_BANK_ACCOUNT || a.accountNumber?.includes('99001')
  );
  if (!bankListed) {
    const all = await callTool('financehub_list_accounts', {});
    const found = all.accounts?.filter(
      (a) =>
        a.accountNumber === TEST_BANK_ACCOUNT ||
        a.accountNumber === TEST_CARD_ACCOUNT
    );
    log('List accounts (fallback all)', { found });
  } else {
    log('List bank accounts', { total: accounts.totalAccounts });
  }

  // 6. Query transactions
  const txs = await callTool('financehub_query_transactions', {
    bankId: TEST_BANK_ID,
    searchText: 'MCP test',
    limit: 10,
  });
  log('Query bank transactions', { totalReturned: txs.totalReturned });

  const cardTxs = await callTool('financehub_query_card_transactions', {
    cardCompanyId: TEST_CARD_ID,
    merchantName: 'MCP Test',
    limit: 10,
  });
  log('Query card transactions', { totalReturned: cardTxs.totalReturned });

  // 7. Delete transactions by date (bank)
  // Account numbers are normalized in DB (hyphens stripped)
  const normBank = 'MCPTESTBANK99001';
  const normCard = 'MCPTESTCARD99002';

  const delTx = await callTool('financehub_delete_transactions', {
    bankId: TEST_BANK_ID,
    accountNumber: normBank,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });
  log('Delete bank transactions', delTx);

  // 8. Delete card transactions
  const delCardTx = await callTool('financehub_delete_transactions', {
    bankId: TEST_CARD_ID,
    accountNumber: normCard,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    isCard: true,
  });
  log('Delete card transactions', delCardTx);

  // 9. Delete accounts
  const delBank = await callTool('financehub_delete_account', {
    bankId: TEST_BANK_ID,
    accountNumber: normBank,
  });
  log('Delete bank account', delBank);

  const delCard = await callTool('financehub_delete_account', {
    bankId: TEST_CARD_ID,
    accountNumber: normCard,
  });
  log('Delete card account', delCard);

  // 10. Verify gone
  const after = await callTool('financehub_list_accounts', {});
  const leftover = (after.accounts || []).filter(
    (a) => a.accountNumber === normBank || a.accountNumber === normCard
  );
  if (leftover.length > 0) {
    throw new Error(`Test accounts still present: ${JSON.stringify(leftover)}`);
  }
  log('Verify cleanup', { message: 'No test accounts remain', totalAccounts: after.totalAccounts });

  console.log('\n🎉 All FinanceHub MCP write/delete steps passed.');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});

/**
 * Direct FinanceHub MCP service test (no HTTP).
 * Uses real financehub.db — creates test bank/card data then deletes it.
 */
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import { FinanceHubMCPService } from '../../src/main/mcp/financehub/financehub-mcp-service';
import { initializeFinanceHubSchema } from '../../src/main/sqlite/financehub';

const DB_PATH =
  process.env.FINANCEHUB_DB_PATH ||
  path.join(os.homedir(), 'Library/Application Support/egdesk/database/financehub.db');

const TEST_BANK_ID = 'serp';
const TEST_CARD_ID = 'bc-card';
const TEST_BANK_ACCOUNT = 'MCP-TEST-BANK-99001';
const TEST_CARD_ACCOUNT = 'MCP-TEST-CARD-99002';

async function runTool(service: FinanceHubMCPService, tool: string, args: Record<string, unknown>) {
  const result = await service.executeTool(tool, args);
  const text = result.content[0]?.text;
  if (!text) throw new Error(`${tool}: empty result`);
  return JSON.parse(text) as Record<string, unknown>;
}

function log(step: string, payload: unknown) {
  console.log(`\n✓ ${step}`);
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  console.log(`FinanceHub MCP direct test\nDB: ${DB_PATH}`);

  const db = new Database(DB_PATH);
  initializeFinanceHubSchema(db);
  const service = new FinanceHubMCPService(db);

  const bankAcc = await runTool(service, 'financehub_upsert_account', {
    bankId: TEST_BANK_ID,
    accountNumber: TEST_BANK_ACCOUNT,
    accountName: 'MCP Test Bank Account',
    balance: 1_000_000,
    accountType: 'checking',
  });
  log('Upsert bank account', bankAcc);

  const cardAcc = await runTool(service, 'financehub_upsert_account', {
    bankId: TEST_CARD_ID,
    accountNumber: TEST_CARD_ACCOUNT,
    accountName: 'MCP Test Card',
    accountType: 'credit',
  });
  log('Upsert card account', cardAcc);

  const bankImport = await runTool(service, 'financehub_import_transactions', {
    bankId: TEST_BANK_ID,
    accountData: { accountNumber: TEST_BANK_ACCOUNT, accountName: 'MCP Test Bank Account' },
    transactions: [
      { date: '2026-05-15', deposit: 50000, description: 'MCP test deposit', balance: 1_050_000 },
    ],
    syncMetadata: { queryPeriodStart: '2026-05-01', queryPeriodEnd: '2026-05-31' },
  });
  log('Import bank transaction', bankImport);

  const cardImport = await runTool(service, 'financehub_import_transactions', {
    bankId: TEST_CARD_ID,
    isCard: true,
    accountData: { accountNumber: TEST_CARD_ACCOUNT, accountName: 'MCP Test Card' },
    transactions: [
      {
        approvalDatetime: '2026-05-16 14:30:00',
        approvalDate: '2026-05-16',
        amount: 12000,
        merchantName: 'MCP Test Merchant',
        cardNumber: TEST_CARD_ACCOUNT,
      },
    ],
    syncMetadata: { queryPeriodStart: '2026-05-01', queryPeriodEnd: '2026-05-31' },
  });
  log('Import card transaction', cardImport);

  const txs = await runTool(service, 'financehub_query_transactions', {
    bankId: TEST_BANK_ID,
    searchText: 'MCP test',
    limit: 10,
  });
  log('Query bank transactions', { totalReturned: txs.totalReturned });

  const cardTxs = await runTool(service, 'financehub_query_card_transactions', {
    cardCompanyId: TEST_CARD_ID,
    merchantName: 'MCP Test',
    limit: 10,
  });
  log('Query card transactions', { totalReturned: cardTxs.totalReturned });

  const delTx = await runTool(service, 'financehub_delete_transactions', {
    bankId: TEST_BANK_ID,
    accountNumber: TEST_BANK_ACCOUNT,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
  });
  log('Delete bank transactions', delTx);

  const delCardTx = await runTool(service, 'financehub_delete_transactions', {
    bankId: TEST_CARD_ID,
    accountNumber: TEST_CARD_ACCOUNT,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    isCard: true,
  });
  log('Delete card transactions', delCardTx);

  const delBank = await runTool(service, 'financehub_delete_account', {
    bankId: TEST_BANK_ID,
    accountNumber: TEST_BANK_ACCOUNT,
  });
  log('Delete bank account', delBank);

  const delCard = await runTool(service, 'financehub_delete_account', {
    bankId: TEST_CARD_ID,
    accountNumber: TEST_CARD_ACCOUNT,
  });
  log('Delete card account', delCard);

  const after = await runTool(service, 'financehub_list_accounts', {});
  const accounts = (after.accounts as Array<{ accountNumber: string }>) || [];
  const leftover = accounts.filter(
    (a) => a.accountNumber === TEST_BANK_ACCOUNT || a.accountNumber === TEST_CARD_ACCOUNT
  );
  if (leftover.length > 0) {
    throw new Error(`Test accounts still present: ${JSON.stringify(leftover)}`);
  }
  log('Verify cleanup', { ok: true, totalAccounts: after.totalAccounts });

  db.close();
  console.log('\n🎉 All FinanceHub MCP write/delete steps passed.');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

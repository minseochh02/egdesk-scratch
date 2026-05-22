const { parseTransactionExcel } = require('../src/main/financehub/utils/transactionParser');

const filePath = 'C:/Users/user/AppData/Roaming/egdesk/output/ibk/ibk-biz-downloads/IBK기업_922-001568-15-114_2026-05-22T02-13-24.xls';

// IBK Automator context 모킹
const mockCtx = {
  config: {
    bank: {
      id: 'ibk'
    }
  },
  log: (m) => console.log('[LOG]', m),
  warn: (m) => console.warn('[WARN]', m),
  error: (m) => console.error('[ERROR]', m)
};

try {
  const result = parseTransactionExcel(filePath, mockCtx);
  console.log('\n--- Parse Success!');
  console.log('Total Transactions Parsed:', result.transactions.length);
  console.log('First 3 transactions:');
  console.log(JSON.stringify(result.transactions.slice(0, 3), null, 2));
} catch (e) {
  console.error('Failed to parse:', e);
}

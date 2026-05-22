const { parseTransactionExcel } = require('../src/main/financehub/utils/transactionParser');
const fs = require('fs');
const path = require('path');

const filePath = `C:\\Users\\user\\Downloads\\거래내역조회_입출식 예금20260522.xlsx`;

console.log('=== TEST MANUAL IMPORT EXCEL PARSER FIX ===');
if (!fs.existsSync(filePath)) {
  console.error(`Excel file not found at: ${filePath}`);
  process.exit(1);
}

const mockCtx = {
  config: {
    bank: {
      id: 'ibk'
    }
  },
  log: (msg) => console.log('[LOG]', msg),
  warn: (msg) => console.warn('[WARN]', msg),
  error: (msg) => console.error('[ERROR]', msg)
};

try {
  const result = parseTransactionExcel(filePath, mockCtx);
  console.log('\n--- PARSE SUCCESS! ---');
  console.log('Parsed Metadata:', JSON.stringify(result.metadata, null, 2));
  console.log('Transactions Count:', result.transactions.length);
  
  if (result.metadata.accountNumber === '306-063568-04-075') {
    console.log('\n✅ SUCCESS: Account Number matched correctly: 306-063568-04-075');
  } else {
    console.log('\n❌ FAILURE: Account Number did not match. Got:', result.metadata.accountNumber);
  }
} catch (e) {
  console.error('Failed to parse Excel:', e);
}

const { parseTransactionExcel } = require('../src/main/financehub/utils/transactionParser');
const path = require('path');
const fs = require('fs');

const filePath = `C:\\Users\\user\\Downloads\\거래내역조회_입출식 예금20260522.xlsx`;

console.log('=== MANUAL EXCEL UPLOAD DEBUGGING ===');
console.log('Target File:', filePath);

if (!fs.existsSync(filePath)) {
  console.error('Error: File does not exist at path!');
  process.exit(1);
}

// 1. Generic parser test (without bank context)
console.log('\n--- 1. Testing with Generic Parser (No Bank ID) ---');
try {
  const result = parseTransactionExcel(filePath);
  console.log('Success!');
  console.log('Parsed Transactions count:', result.transactions.length);
  if (result.transactions.length > 0) {
    console.log('First Transaction:', JSON.stringify(result.transactions[0], null, 2));
  }
} catch (e) {
  console.error('Failed Generic Parser:', e.message);
}

// 2. IBK Schema parser test (with IBK Bank ID)
console.log('\n--- 2. Testing with IBK Schema Parser ---');
const mockIbkCtx = {
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
  const result = parseTransactionExcel(filePath, mockIbkCtx);
  console.log('Success!');
  console.log('Parsed Transactions count:', result.transactions.length);
  if (result.transactions.length > 0) {
    console.log('First Transaction:', JSON.stringify(result.transactions[0], null, 2));
    console.log('Last Transaction:', JSON.stringify(result.transactions[result.transactions.length - 1], null, 2));
  }
} catch (e) {
  console.error('Failed IBK Parser:', e.message);
}

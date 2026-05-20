const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath, { readonly: true });

try {
  console.log('=== bank_transactions 테이블의 account_number 고유값 ===');
  const bankTxNums = db.prepare("SELECT DISTINCT account_number, COUNT(*) as cnt FROM bank_transactions GROUP BY account_number").all();
  console.table(bankTxNums);

  console.log('\n=== ibk_loan_transactions 테이블의 account_number 고유값 ===');
  const loanTxNums = db.prepare("SELECT DISTINCT account_number, COUNT(*) as cnt FROM ibk_loan_transactions GROUP BY account_number").all();
  console.table(loanTxNums);

  console.log('\n=== ibk_b2b_receivables 테이블의 deposit_account_number 고유값 ===');
  const b2bNums = db.prepare("SELECT DISTINCT deposit_account_number, COUNT(*) as cnt FROM ibk_b2b_receivables GROUP BY deposit_account_number").all();
  console.table(b2bNums);

} catch (e) {
  console.error(e);
} finally {
  db.close();
}

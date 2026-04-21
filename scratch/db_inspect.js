
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
console.log('Connecting to database:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  console.log('\n--- Tax Invoices (과세) Monthly Count ---');
  const taxInvoices = db.prepare(`
    SELECT SUBSTR(작성일자, 1, 6) as month, invoice_type, COUNT(*) as count
    FROM tax_invoices
    GROUP BY month, invoice_type
    ORDER BY month ASC, invoice_type ASC
  `).all();
  console.table(taxInvoices);

  console.log('\n--- Tax-Exempt Invoices (면세) Monthly Count ---');
  const exemptInvoices = db.prepare(`
    SELECT SUBSTR(작성일자, 1, 6) as month, invoice_type, COUNT(*) as count
    FROM tax_exempt_invoices
    GROUP BY month, invoice_type
    ORDER BY month ASC, invoice_type ASC
  `).all();
  console.table(exemptInvoices);

  console.log('\n--- Cash Receipts (현금영수증) Monthly Count ---');
  const cashReceipts = db.prepare(`
    SELECT SUBSTR(매출일시, 1, 6) as month, 발행구분, COUNT(*) as count
    FROM cash_receipts
    GROUP BY month, 발행구분
    ORDER BY month ASC
  `).all();
  console.table(cashReceipts);

  db.close();
} catch (err) {
  console.error('Error reading database:', err);
}

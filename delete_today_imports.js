const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'Library/Application Support/EGDesk/database/user_data.db');

console.log('='.repeat(80));
console.log('Delete Today\'s Imports - 2026-03-12');
console.log('='.repeat(80));
console.log(`Database: ${dbPath}`);
console.log('='.repeat(80));

const db = new Database(dbPath);

// Check counts before deletion
console.log('\nBefore Deletion:');
const ppCountBefore = db.prepare("SELECT COUNT(*) as count FROM pending_purchases WHERE DATE(imported_at) = '2026-03-12'").get();
const psCountBefore = db.prepare("SELECT COUNT(*) as count FROM pending_sales WHERE DATE(imported_at) = '2026-03-12'").get();
console.log(`  pending_purchases: ${ppCountBefore.count} rows`);
console.log(`  pending_sales: ${psCountBefore.count} rows`);

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nAre you sure you want to delete these rows? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('\nDeleting rows...');

    // Delete from pending_purchases
    const deletePP = db.prepare("DELETE FROM pending_purchases WHERE DATE(imported_at) = '2026-03-12'");
    const resultPP = deletePP.run();
    console.log(`  pending_purchases: ${resultPP.changes} rows deleted`);

    // Delete from pending_sales
    const deletePS = db.prepare("DELETE FROM pending_sales WHERE DATE(imported_at) = '2026-03-12'");
    const resultPS = deletePS.run();
    console.log(`  pending_sales: ${resultPS.changes} rows deleted`);

    // Verify deletion
    console.log('\nAfter Deletion:');
    const ppCountAfter = db.prepare("SELECT COUNT(*) as count FROM pending_purchases WHERE DATE(imported_at) = '2026-03-12'").get();
    const psCountAfter = db.prepare("SELECT COUNT(*) as count FROM pending_sales WHERE DATE(imported_at) = '2026-03-12'").get();
    console.log(`  pending_purchases: ${ppCountAfter.count} rows`);
    console.log(`  pending_sales: ${psCountAfter.count} rows`);

    console.log('\n' + '='.repeat(80));
    console.log('Deletion completed successfully!');
    console.log('='.repeat(80));
  } else {
    console.log('\nDeletion cancelled.');
  }

  db.close();
  rl.close();
});

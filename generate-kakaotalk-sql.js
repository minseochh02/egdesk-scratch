const fs = require('fs');
const path = require('path');

/**
 * Generate SQL import file for KakaoTalk chat data
 *
 * Creates a SQL file that can be imported using the app's SQL import feature
 */

function main() {
  console.log('🚀 Generating KakaoTalk SQL import file...\n');

  // Load parsed data
  console.log('📖 Loading parsed chat data...');
  const dataPath = path.join(__dirname, 'kakaotalk-parsed.json');
  const chatMessages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`   ✅ Loaded ${chatMessages.length} messages\n`);

  // Generate SQL content
  console.log('📝 Generating SQL statements...');

  let sql = `-- KakaoTalk Chat Data Import
-- Generated: ${new Date().toISOString()}
-- Messages: ${chatMessages.length}
-- Date Range: ${chatMessages[0]?.chat_date} to ${chatMessages[chatMessages.length - 1]?.chat_date}

-- ============================================
-- Table: KakaoTalk - EGdesk PM Team Chat
-- SQL Name: kakaotalk_egdesk_pm
-- Description: KakaoTalk chat history from EGdesk PM team
-- ============================================

CREATE TABLE "kakaotalk_egdesk_pm" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "chat_date" TEXT NOT NULL,
  "user_name" TEXT NOT NULL,
  "message" TEXT NOT NULL
);

`;

  // Generate INSERT statements
  let insertCount = 0;
  for (const msg of chatMessages) {
    // Escape single quotes in strings
    const chatDate = (msg.chat_date || '').replace(/'/g, "''");
    const userName = (msg.user_name || '').replace(/'/g, "''");
    const message = (msg.message || '').replace(/'/g, "''");

    sql += `INSERT INTO "kakaotalk_egdesk_pm" ("chat_date", "user_name", "message") VALUES ('${chatDate}', '${userName}', '${message}');\n`;
    insertCount++;
  }

  sql += `\n-- Total messages inserted: ${insertCount}\n`;

  // Write SQL file
  const sqlPath = path.join(__dirname, 'kakaotalk-import.sql');
  fs.writeFileSync(sqlPath, sql, 'utf8');

  console.log(`   ✅ Generated ${insertCount} INSERT statements\n`);

  // Display summary
  console.log('═══════════════════════════════════════════════');
  console.log('✅ SQL FILE GENERATED');
  console.log('═══════════════════════════════════════════════');
  console.log(`File: kakaotalk-import.sql`);
  console.log(`Size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`Statements: ${insertCount + 1} (1 CREATE + ${insertCount} INSERT)`);
  console.log('═══════════════════════════════════════════════\n');

  console.log('📝 Next Steps:');
  console.log('1. Open the EGDesk app');
  console.log('2. Navigate to User Data page');
  console.log('3. Click "Import SQL" button (or use IPC handler "user-data:import-sql")');
  console.log('4. Select the generated "kakaotalk-import.sql" file');
  console.log('5. Wait for import to complete');
  console.log('6. Find "kakaotalk_egdesk_pm" table in the table list');
  console.log('7. Click "Embed Table" to create embeddings for semantic search');
  console.log('8. Test semantic search with Korean queries\n');
}

main();

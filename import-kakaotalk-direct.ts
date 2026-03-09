import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { UserDataDbManager } from './src/main/sqlite/user-data';
import { ColumnSchema, ColumnType } from './src/main/user-data/types';

/**
 * Direct import script for KakaoTalk chat data
 *
 * This script imports parsed KakaoTalk chat data into the user database
 * using the UserDataDbManager directly
 */

const USER_DATA_DB_PATH = path.join(
  process.env.HOME || '',
  'Library/Application Support/egdesk/user-data.db'
);

async function main() {
  try {
    console.log('🚀 Starting KakaoTalk chat data import...\n');

    // Load parsed data
    console.log('📖 Loading parsed chat data...');
    const dataPath = path.join(__dirname, 'kakaotalk-parsed.json');
    const chatMessages = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`   ✅ Loaded ${chatMessages.length} messages\n`);

    // Connect to database
    console.log('🔌 Connecting to user data database...');
    console.log(`   Path: ${USER_DATA_DB_PATH}`);

    if (!fs.existsSync(USER_DATA_DB_PATH)) {
      throw new Error(`Database file not found: ${USER_DATA_DB_PATH}`);
    }

    const db = new Database(USER_DATA_DB_PATH);
    const userDataManager = new UserDataDbManager(db);
    console.log('   ✅ Connected successfully\n');

    // Define table schema
    const schema: ColumnSchema[] = [
      { name: 'chat_date', type: 'TEXT' as ColumnType, notNull: true },
      { name: 'user_name', type: 'TEXT' as ColumnType, notNull: true },
      { name: 'message', type: 'TEXT' as ColumnType, notNull: true },
    ];

    // Create table
    console.log('📋 Creating table...');
    const table = userDataManager.createTableFromSchema(
      'KakaoTalk - EGdesk PM Team Chat',
      schema,
      {
        tableName: 'kakaotalk_egdesk_pm',
        description: 'KakaoTalk chat history from EGdesk PM team (2025-06 to 2026-03)',
        uniqueKeyColumns: [], // No duplicate detection
        duplicateAction: 'skip',
      }
    );
    console.log(`   ✅ Table created: ${table.id}`);
    console.log(`   Table name: ${table.tableName}`);
    console.log(`   Display name: ${table.displayName}\n`);

    // Create import operation
    console.log('📥 Creating import operation...');
    const importOp = userDataManager.createImportOperation({
      tableId: table.id,
      fileName: 'KakaoTalk_Chat_EGdesk-PM_2026-03-08-18-20-48.csv',
    });
    console.log(`   ✅ Import operation created: ${importOp.id}\n`);

    // Insert rows
    console.log('💾 Inserting chat messages...');
    console.log(`   Total messages to insert: ${chatMessages.length}`);

    const insertResult = userDataManager.insertRows(table.id, chatMessages);

    console.log('\n📊 Insert Results:');
    console.log(`   ✅ Inserted: ${insertResult.inserted}`);
    console.log(`   ⏭️  Skipped: ${insertResult.skipped}`);
    console.log(`   🔄 Duplicates: ${insertResult.duplicates}`);
    console.log(`   ❌ Errors: ${insertResult.errors.length}`);

    if (insertResult.errors.length > 0) {
      console.log('\n   First 5 errors:');
      insertResult.errors.slice(0, 5).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }

    // Complete import operation
    console.log('\n✅ Completing import operation...');
    userDataManager.completeImportOperation(importOp.id, {
      rowsImported: insertResult.inserted,
      rowsSkipped: insertResult.skipped,
      errorMessage:
        insertResult.errors.length > 0
          ? insertResult.errors.slice(0, 5).join('; ')
          : undefined,
    });
    console.log('   ✅ Import operation completed\n');

    // Display summary
    console.log('═══════════════════════════════════════════════');
    console.log('✅ IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════════');
    console.log(`Table ID: ${table.id}`);
    console.log(`Table Name: ${table.tableName}`);
    console.log(`Display Name: ${table.displayName}`);
    console.log(`Messages Imported: ${insertResult.inserted} / ${chatMessages.length}`);
    console.log('═══════════════════════════════════════════════\n');

    console.log('📝 Next Steps:');
    console.log('1. Open the EGDesk app');
    console.log('2. Navigate to User Data page');
    console.log('3. Find "KakaoTalk - EGdesk PM Team Chat" table');
    console.log('4. Click "Embed Table" to create embeddings for semantic search');
    console.log('5. Test semantic search with Korean queries like "회의 일정" or "커피"\n');

    // Close database
    db.close();
    console.log('🔒 Database connection closed');

  } catch (error) {
    console.error('\n❌ Error during import:', error);
    process.exit(1);
  }
}

main();

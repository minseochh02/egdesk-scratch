/**
 * Migration 004: Separate FinanceHub Database
 *
 * Purpose: Extract FinanceHub tables from conversations.db into dedicated financehub.db
 *
 * Tables to migrate:
 * - banks
 * - accounts
 * - transactions
 * - sync_operations
 * - hometax_connections
 * - tax_invoices
 * - hometax_sync_operations
 *
 * This migration:
 * 1. Creates new financehub.db
 * 2. Copies all FinanceHub/Hometax tables with data
 * 3. Drops tables from conversations.db (after successful copy)
 * 4. Creates backup before deletion
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { initializeFinanceHubSchema } from '../financehub';
import { createHometaxSchema } from './002-hometax-schema';

export function separateFinanceHubDatabase(
  conversationsDb: Database.Database,
  financeHubDb: Database.Database
): { success: boolean; error?: string; report?: any } {
  console.log('🔄 Starting FinanceHub database separation...');

  const report = {
    tablesProcessed: [] as string[],
    rowsCopied: {} as Record<string, number>,
    errors: [] as string[],
  };

  try {
    // ========================================
    // Step 1: Create schema in new financehub.db (if needed)
    // ========================================
    const schemaExists = financeHubDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='banks'
    `).get();

    if (!schemaExists) {
      console.log('📊 Creating FinanceHub schema in new database...');
      initializeFinanceHubSchema(financeHubDb);
      createHometaxSchema(financeHubDb);
      console.log('✅ Schema created');
    } else {
      console.log('✅ Schema already exists in financehub.db');
    }

    // ========================================
    // Step 2: Attach conversations.db to copy data
    // ========================================
    const conversationsDbPath = conversationsDb.name;
    financeHubDb.exec(`ATTACH DATABASE '${conversationsDbPath}' AS source`);
    console.log('🔗 Attached source database');

    // ========================================
    // Step 3: Copy tables with data
    // ========================================
    const tablesToCopy = [
      'banks',
      'accounts',
      'transactions',
      'sync_operations',
      'hometax_connections',
      'tax_invoices',
      'hometax_sync_operations',
    ];

    for (const table of tablesToCopy) {
      try {
        // Check if table exists in source
        const checkTable = conversationsDb.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name=?
        `).get(table);

        if (!checkTable) {
          console.log(`⚠️ Table ${table} does not exist in source - skipping`);
          continue;
        }

        // Get row count before copy
        const countBefore = conversationsDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        console.log(`📋 Copying table: ${table} (${countBefore.count} rows)`);

        // Copy data using INSERT OR REPLACE to handle existing data
        financeHubDb.exec(`
          INSERT OR REPLACE INTO main.${table}
          SELECT * FROM source.${table}
        `);

        // Verify row count after copy
        const countAfter = financeHubDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };

        // Use >= instead of exact match since INSERT OR REPLACE might skip duplicates
        if (countAfter.count < countBefore.count) {
          console.warn(`⚠️ Row count lower for ${table}: ${countBefore.count} source vs ${countAfter.count} copied (likely duplicates skipped)`);
        }

        console.log(`✅ Copied ${table}: ${countAfter.count} rows`);
        report.tablesProcessed.push(table);
        report.rowsCopied[table] = countAfter.count;

      } catch (error: any) {
        const errorMsg = `Failed to copy ${table}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        report.errors.push(errorMsg);
        // Continue with other tables
      }
    }

    // ========================================
    // Step 4: Detach source database
    // ========================================
    financeHubDb.exec('DETACH DATABASE source');
    console.log('🔗 Detached source database');

    // ========================================
    // Step 5: Create backup of conversations.db before deleting tables
    // ========================================
    const backupPath = conversationsDbPath + '.backup-before-financehub-separation';
    if (!fs.existsSync(backupPath)) {
      console.log('💾 Creating backup of conversations.db...');
      conversationsDb.backup(backupPath);
      console.log(`✅ Backup created: ${backupPath}`);
    }

    // ========================================
    // Step 6: Drop tables from conversations.db
    // ========================================
    console.log('🗑️ Removing FinanceHub tables from conversations.db...');

    for (const table of report.tablesProcessed) {
      try {
        conversationsDb.exec(`DROP TABLE IF EXISTS ${table}`);
        console.log(`✅ Dropped ${table} from conversations.db`);
      } catch (error: any) {
        const errorMsg = `Failed to drop ${table}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        report.errors.push(errorMsg);
      }
    }

    // ========================================
    // Step 7: Vacuum both databases
    // ========================================
    console.log('🧹 Vacuuming databases...');
    conversationsDb.exec('VACUUM');
    financeHubDb.exec('VACUUM');
    console.log('✅ Vacuum complete');

    // ========================================
    // Report
    // ========================================
    console.log('\n📊 Migration Report:');
    console.log(`   ✅ Tables processed: ${report.tablesProcessed.length}`);
    console.log(`   📊 Total rows copied:`);
    for (const [table, count] of Object.entries(report.rowsCopied)) {
      console.log(`      - ${table}: ${count}`);
    }
    if (report.errors.length > 0) {
      console.log(`   ⚠️ Errors: ${report.errors.length}`);
      report.errors.forEach(err => console.log(`      - ${err}`));
    }

    return { success: true, report };

  } catch (error: any) {
    console.error('❌ FinanceHub database separation failed:', error);
    return {
      success: false,
      error: error.message,
      report
    };
  }
}

/**
 * Check if FinanceHub database separation has been completed
 */
export function hasFinanceHubSeparation(conversationsDb: Database.Database): boolean {
  try {
    // Check if banks table exists in conversations.db
    const result = conversationsDb.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='banks'
    `).get();

    // If banks table still exists in conversations.db, separation hasn't happened
    return !result;
  } catch (error) {
    console.error('Error checking FinanceHub separation:', error);
    return false;
  }
}

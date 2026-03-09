import Database from 'better-sqlite3';

/**
 * Migration 012: Fix date column types (DEV ONLY)
 *
 * This migration converts TEXT date columns to DATE type in user data tables.
 * Specifically targets "일자" column that should be DATE but was created as TEXT.
 *
 * **DEV ONLY**: This migration is only run in development environment.
 * It's specific to dev data and should not run in production.
 */
export function migrate012FixDateColumnTypesDev(db: Database.Database): void {
  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === 'development' || process.env.DEV_MIGRATION === 'true';

  if (!isDev) {
    console.log('⏭️  Migration 012: Skipped (dev-only migration, not in dev mode)');
    return;
  }

  console.log('🔄 Migration 012: Fixing date column types (DEV ONLY)...');

  try {
    // Get all user data tables from the user_tables metadata table
    const metadataExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_tables'`)
      .get();

    if (!metadataExists) {
      console.log('   ⏭️  No user_tables table found - no user tables to migrate');
      return;
    }

    const userTables = db
      .prepare(`SELECT id, table_name FROM user_tables`)
      .all() as Array<{ id: string; table_name: string }>;

    console.log(`   Found ${userTables.length} user data table(s) to check`);

    let migratedCount = 0;

    for (const { table_name: tableName } of userTables) {
      // Check if this table has "일자" column as TEXT
      const columns = db.pragma(`table_info(${tableName})`) as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      // Debug: Log all column names and types
      console.log(`   🔍 Checking table "${tableName}":`);
      console.log(`      Columns:`, columns.map(c => `${c.name} (${c.type})`).join(', '));

      const iljaColumn = columns.find(col => col.name === '일자');

      if (!iljaColumn) {
        console.log(`      ⏭️  No "일자" column found - skipping`);
        continue;
      }

      // Check metadata schema_json to see if it needs fixing
      const metadata = db
        .prepare(`SELECT * FROM user_tables WHERE table_name = ?`)
        .get(tableName) as any;

      if (!metadata || !metadata.schema_json) {
        console.log(`      ⏭️  No metadata found - skipping`);
        continue;
      }

      const schema = JSON.parse(metadata.schema_json);
      const iljaSchemaCol = schema.find((col: any) => col.name === '일자');

      if (!iljaSchemaCol) {
        console.log(`      ⏭️  "일자" not in metadata schema - skipping`);
        continue;
      }

      // If actual table has DATE but metadata has TEXT, fix metadata only
      if (iljaColumn.type === 'DATE' && iljaSchemaCol.type === 'TEXT') {
        console.log(`      🔧 Actual table has DATE, but metadata has TEXT - fixing metadata only`);

        iljaSchemaCol.type = 'DATE';
        db.prepare(`UPDATE user_tables SET schema_json = ?, updated_at = datetime('now') WHERE table_name = ?`)
          .run(JSON.stringify(schema), tableName);

        console.log(`      ✅ Updated metadata schema from TEXT to DATE`);
        migratedCount++;
        continue;
      }

      if (iljaColumn.type !== 'TEXT') {
        console.log(`      ⏭️  "일자" column is already ${iljaColumn.type} type (metadata: ${iljaSchemaCol.type}) - skipping`);
        continue;
      }

      console.log(`   🔧 Migrating table "${tableName}": Converting "일자" from TEXT to DATE`);

      try {
        db.exec('BEGIN TRANSACTION');

        // Step 1: Create new table with correct schema
        const createColumns = columns.map(col => {
          let type = col.type;

          // Convert "일자" from TEXT to DATE
          if (col.name === '일자') {
            type = 'DATE';
          }

          const notNull = col.notnull ? 'NOT NULL' : '';
          const defaultVal = col.dflt_value ? `DEFAULT ${col.dflt_value}` : '';
          const primaryKey = col.pk ? 'PRIMARY KEY' : '';

          return `${col.name} ${type} ${notNull} ${defaultVal} ${primaryKey}`.trim();
        }).join(', ');

        const newTableName = `${tableName}_new`;

        db.exec(`CREATE TABLE ${newTableName} (${createColumns})`);
        console.log(`      ✓ Created new table with DATE type`);

        // Step 2: Copy data from old table to new table
        const columnNames = columns.map(col => col.name).join(', ');
        db.exec(`INSERT INTO ${newTableName} SELECT ${columnNames} FROM ${tableName}`);
        console.log(`      ✓ Copied ${db.prepare(`SELECT COUNT(*) as count FROM ${newTableName}`).get().count} rows`);

        // Step 3: Drop old table
        db.exec(`DROP TABLE ${tableName}`);
        console.log(`      ✓ Dropped old table`);

        // Step 4: Rename new table to original name
        db.exec(`ALTER TABLE ${newTableName} RENAME TO ${tableName}`);
        console.log(`      ✓ Renamed new table`);

        // Step 5: Update user_tables schema_json (already have metadata and schema from above)
        iljaSchemaCol.type = 'DATE';
        db.prepare(`UPDATE user_tables SET schema_json = ?, updated_at = datetime('now') WHERE table_name = ?`)
          .run(JSON.stringify(schema), tableName);
        console.log(`      ✓ Updated metadata schema`);

        db.exec('COMMIT');
        console.log(`   ✅ Table "${tableName}" migrated successfully`);
        migratedCount++;

      } catch (tableError) {
        db.exec('ROLLBACK');
        console.error(`   ❌ Failed to migrate table "${tableName}":`, tableError);
      }
    }

    if (migratedCount > 0) {
      console.log(`✅ Migration 012 complete: Fixed ${migratedCount} table(s)`);
    } else {
      console.log(`✅ Migration 012 complete: No tables needed migration`);
    }

  } catch (error) {
    console.error('❌ Migration 012 error:', error);
    throw error;
  }
}

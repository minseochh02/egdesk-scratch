// ============================================
// Migration 011: Add applied_splits column to sync_configurations
// ============================================
// Adds the applied_splits column to store column split configurations

import Database from 'better-sqlite3';

export function migrate011AddAppliedSplitsToSyncConfig(db: Database.Database): void {
  console.log('🔄 Migration 011: Adding applied_splits to sync_configurations...');

  // Check if sync_configurations table exists
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sync_configurations'`).all();

  if (tables.length === 0) {
    console.log('  ℹ️ sync_configurations table does not exist - skipping migration');
    return;
  }

  // Check if column already exists
  const columns = db.prepare(`PRAGMA table_info(sync_configurations)`).all() as any[];
  const hasAppliedSplits = columns.some((col: any) => col.name === 'applied_splits');

  if (hasAppliedSplits) {
    console.log('  ✅ sync_configurations already has applied_splits column - skipping');
    return;
  }

  console.log('  🔧 Adding applied_splits column to sync_configurations...');

  // Add the new column
  db.exec(`
    ALTER TABLE sync_configurations
    ADD COLUMN applied_splits TEXT DEFAULT NULL;
  `);

  console.log('  ✅ Migration 011 complete - sync_configurations now has applied_splits column');
}

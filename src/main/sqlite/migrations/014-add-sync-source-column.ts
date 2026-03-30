import Database from 'better-sqlite3';

/**
 * Migration 014: Add source column to sync_configurations
 *
 * Adds a 'source' column to distinguish between browser and desktop recorder sources
 */
export function migrate(db: Database.Database): void {
  console.log('[Migration 014] Adding source column to sync_configurations...');

  // Add source column (defaults to 'browser' for backwards compatibility)
  db.exec(`
    ALTER TABLE sync_configurations
    ADD COLUMN source TEXT DEFAULT 'browser' CHECK(source IN ('browser', 'desktop'));
  `);

  console.log('[Migration 014] Source column added successfully');
}

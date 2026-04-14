import Database from 'better-sqlite3';

export function ensureMigrationStateTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migration_state (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function hasMigrationRun(db: Database.Database, name: string): boolean {
  const row = db
    .prepare('SELECT name FROM _migration_state WHERE name = ?')
    .get(name) as { name?: string } | undefined;
  return Boolean(row?.name);
}

export function markMigrationRun(db: Database.Database, name: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO _migration_state (name, applied_at)
    VALUES (?, datetime('now'))
  `).run(name);
}

export async function runOnceMigration(
  db: Database.Database,
  migrationName: string,
  runner: () => Promise<void> | void
): Promise<void> {
  ensureMigrationStateTable(db);
  if (hasMigrationRun(db, migrationName)) {
    return;
  }

  await runner();
  markMigrationRun(db, migrationName);
}

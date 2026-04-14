// ============================================
// Migration 021: Strip embedded account numbers from accounts.account_name
// ============================================
// Fixes rows where sync stored full dropdown text, e.g.
// "213-890060-03204 기업자유예금" -> "기업자유예금"
// Uses the same dashed pattern as financehub/utils/accountOptionLabel.js

import Database from 'better-sqlite3';

/** Leading hyphenated account token + whitespace (middle segment up to 6 digits). */
const LEADING_DASHED_ACCOUNT = /^(\d{3}-\d{2,6}-\d{4,7})\s+(.*)$/s;

function stripLeadingDashedAccountFromStoredName(name: string): string {
  const t = String(name || '').trim();
  const m = t.match(LEADING_DASHED_ACCOUNT);
  if (!m) return t;
  const rest = m[2].trim();
  return rest.length > 0 ? rest : t;
}

export function migrate021NormalizeAccountDisplayNames(db: Database.Database): void {
  console.log('🔄 Migration 021: Normalizing accounts.account_name (strip leading account# from labels)...');

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'`)
    .all() as { name: string }[];
  if (tables.length === 0) {
    console.log('  ℹ️ accounts table missing — skipping');
    return;
  }

  const rows = db.prepare(`SELECT id, account_name FROM accounts`).all() as { id: string; account_name: string }[];
  const update = db.prepare(`UPDATE accounts SET account_name = ?, updated_at = datetime('now') WHERE id = ?`);

  let updated = 0;
  for (const row of rows) {
    const cleaned = stripLeadingDashedAccountFromStoredName(row.account_name);
    if (cleaned !== row.account_name) {
      update.run(cleaned, row.id);
      updated++;
    }
  }

  console.log(`  ✅ Migration 021 complete — ${updated} account row(s) updated`);
}

// ============================================
// Migration 022: Re-apply account display name rules (IBK colon format, etc.)
// ============================================
// Uses financehub/utils/accountOptionLabel.accountDisplayNameFromOptionText so DB rows
// match runtime parsing (e.g. "922-001568-15-119:주거래기업부금(...)" -> "주거래기업부금(...)").

import Database from 'better-sqlite3';

export function migrate022ReapplyAccountDisplayNameRules(db: Database.Database): void {
  console.log('🔄 Migration 022: Re-normalizing accounts.account_name (includes IBK :colon labels)...');

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'`)
    .all() as { name: string }[];
  if (tables.length === 0) {
    console.log('  ℹ️ accounts table missing — skipping');
    return;
  }

  const { accountDisplayNameFromOptionText } = require('../../financehub/utils/accountOptionLabel');

  const rows = db.prepare(`SELECT id, account_name FROM accounts`).all() as { id: string; account_name: string }[];
  const update = db.prepare(`UPDATE accounts SET account_name = ?, updated_at = datetime('now') WHERE id = ?`);

  let updated = 0;
  for (const row of rows) {
    const cleaned = accountDisplayNameFromOptionText(row.account_name, row.account_name);
    if (cleaned !== row.account_name) {
      update.run(cleaned, row.id);
      updated++;
    }
  }

  console.log(`  ✅ Migration 022 complete — ${updated} account row(s) updated`);
}

#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const TARGET_TABLE_ID = process.argv[2] || '7ea4471f-9706-43f7-8dd8-3c71f9bb6a89';
const TARGET_DATE = process.argv[3] || '2026-04-02';
const APP_SUPPORT_DIR = path.join(os.homedir(), 'Library', 'Application Support');

function walkForDb(startDir, matcher, maxResults = 20) {
  const results = [];
  const stack = [startDir];

  while (stack.length > 0 && results.length < maxResults) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && matcher(fullPath)) {
        results.push(fullPath);
        if (results.length >= maxResults) break;
      }
    }
  }

  return results;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function main() {
  const dbCandidates = walkForDb(
    APP_SUPPORT_DIR,
    (p) => p.endsWith(path.join('database', 'user_data.db'))
  );

  if (dbCandidates.length === 0) {
    console.error('No user_data.db found under Application Support');
    process.exit(1);
  }

  console.log(`Found ${dbCandidates.length} candidate DB(s).`);

  let selectedDbPath = null;
  let selectedDb = null;
  let tableMeta = null;

  for (const candidate of dbCandidates) {
    try {
      const db = new Database(candidate, { readonly: true });
      const row = db
        .prepare('SELECT id, table_name, display_name, unique_key_columns, duplicate_action FROM user_tables WHERE id = ?')
        .get(TARGET_TABLE_ID);
      if (row) {
        selectedDbPath = candidate;
        selectedDb = db;
        tableMeta = row;
        break;
      }
      db.close();
    } catch {
      // Ignore unreadable/non-compatible DBs
    }
  }

  if (!selectedDb || !tableMeta) {
    console.error(`Table ID not found in candidate DBs: ${TARGET_TABLE_ID}`);
    process.exit(2);
  }

  console.log(`Using DB: ${selectedDbPath}`);
  console.log(`Table: ${tableMeta.table_name} (${tableMeta.display_name})`);
  console.log(`duplicate_action: ${tableMeta.duplicate_action || 'null'}`);
  console.log(`unique_key_columns: ${tableMeta.unique_key_columns || 'null'}`);

  const tableName = tableMeta.table_name;
  const tableInfo = selectedDb.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all();
  const columnNames = tableInfo.map((c) => c.name);

  const hasDateCol = columnNames.includes('일자');
  if (!hasDateCol) {
    console.error(`Table does not have '일자' column: ${tableName}`);
    selectedDb.close();
    process.exit(3);
  }

  // How many rows for target date?
  const totalForDate = selectedDb
    .prepare(`SELECT COUNT(*) AS cnt FROM ${quoteIdent(tableName)} WHERE DATE(${quoteIdent('일자')}) = ?`)
    .get(TARGET_DATE).cnt;

  // Date-range context count
  const rangeCount = selectedDb
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM ${quoteIdent(tableName)}
       WHERE DATE(${quoteIdent('일자')}) BETWEEN ? AND ?`
    )
    .get('2026-04-02', '2026-04-09').cnt;

  // Duplicate check using business columns (exclude id, imported_at)
  const businessCols = columnNames.filter((c) => c !== 'id' && c !== 'imported_at');
  if (businessCols.length === 0) {
    console.log('No business columns to check duplicates.');
    selectedDb.close();
    process.exit(0);
  }

  const groupExpr = businessCols
    .map((c) => `COALESCE(CAST(${quoteIdent(c)} AS TEXT), '__NULL__')`)
    .join(` || '|' || `);

  const dupRows = selectedDb
    .prepare(
      `SELECT ${groupExpr} AS row_key, COUNT(*) AS cnt
       FROM ${quoteIdent(tableName)}
       WHERE DATE(${quoteIdent('일자')}) = ?
       GROUP BY row_key
       HAVING COUNT(*) > 1
       ORDER BY cnt DESC
       LIMIT 20`
    )
    .all(TARGET_DATE);

  const dupInstances = dupRows.reduce((acc, r) => acc + Number(r.cnt), 0);
  const dupExtraRows = dupRows.reduce((acc, r) => acc + (Number(r.cnt) - 1), 0);

  console.log('\n=== April 2 Duplicate Check ===');
  console.log(`Rows on ${TARGET_DATE}: ${totalForDate}`);
  console.log(`Rows in 2026-04-02..2026-04-09: ${rangeCount}`);
  console.log(`Duplicate groups on ${TARGET_DATE}: ${dupRows.length}`);
  console.log(`Duplicate instances on ${TARGET_DATE}: ${dupInstances}`);
  console.log(`Extra duplicate rows on ${TARGET_DATE}: ${dupExtraRows}`);

  if (dupRows.length > 0) {
    console.log('\nTop duplicate groups (count):');
    dupRows.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.cnt}`);
    });
  }

  selectedDb.close();
}

main();

#!/usr/bin/env node
/* eslint-disable no-console */

const API_URL = process.env.EGDESK_API_URL || 'http://localhost:8080';
const API_KEY = process.env.EGDESK_API_KEY || '';

async function callUserDataTool(tool, args = {}) {
  const res = await fetch(`${API_URL}/user-data/tools/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
    },
    body: JSON.stringify({ tool, arguments: args }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Tool call failed');
  }

  const contentText = json.result?.content?.[0]?.text;
  return contentText ? JSON.parse(contentText) : null;
}

async function run() {
  const tableName = process.argv[2] || 'sales';

  // Raw-format checks first (exactly what user sees in UI)
  const sql = `
SELECT
  (SELECT COUNT(*) FROM "${tableName}" WHERE "일자" LIKE '2026/04/02%') AS slash_fmt,
  (SELECT COUNT(*) FROM "${tableName}" WHERE "일자" LIKE '2026-04-02%') AS dash_fmt,
  (SELECT COUNT(*) FROM "${tableName}" WHERE "일자" LIKE '%2026/04/02%') AS slash_contains,
  (SELECT COUNT(*) FROM "${tableName}" WHERE "일자" LIKE '%2026-04-02%') AS dash_contains,
  (SELECT COUNT(*) FROM "${tableName}" WHERE DATE("일자") = '2026-04-02') AS date_fn
`;

  const counts = await callUserDataTool('user_data_sql_query', { query: sql });

  // Duplicate groups for April 2 using raw string match
  const dupSql = `
SELECT COUNT(*) AS duplicate_groups
FROM (
  SELECT
    COALESCE(CAST("일자" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("최초작성일자" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("최종수정일시" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("작성자" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("최종수정자" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("거래처코드" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("담당자코드" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("품목코드" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("수량" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("중량" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("단가" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("합계" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("출하창고코드" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("신규일" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("적요" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("적요2" AS TEXT), '__NULL__') || '|' ||
    COALESCE(CAST("실납업체" AS TEXT), '__NULL__') AS row_key,
    COUNT(*) AS cnt
  FROM "${tableName}"
  WHERE "일자" LIKE '2026/04/02%' OR "일자" LIKE '2026-04-02%'
  GROUP BY row_key
  HAVING COUNT(*) > 1
)
`;
  const dupGroups = await callUserDataTool('user_data_sql_query', { query: dupSql });

  console.log(JSON.stringify({ tableName, counts, dupGroups }, null, 2));
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});


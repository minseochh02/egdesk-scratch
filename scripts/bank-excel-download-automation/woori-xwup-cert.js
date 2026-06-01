/**
 * Woori xwup cert list helpers.
 * Cert UI is .xwup-tableview-cell divs (4 cols: 구분 | 사용자 | 만료일 | 발급자).
 * Do NOT use <table tbody tr> — that structure is stale / non-clickable.
 */

const WOORI_CERT_COLS = 4;
const WOORI_CERT_HEADER = new Set(['구분', '사용자', '만료일', '발급자', '']);

/** Self-contained for page.evaluate (must not call other module exports). */
function resolveWooriCertCellInBrowser({ index = 1, expiry = '', name = '', month = 0 } = {}) {
  const COLS = 4;
  const HEADER = new Set(['구분', '사용자', '만료일', '발급자', '']);
  const allCells = Array.from(document.querySelectorAll('.xwup-tableview-cell'));
  const rows = [];

  for (let i = 0; i < allCells.length; i += COLS) {
    const chunk = allCells.slice(i, i + COLS);
    if (chunk.length < COLS) break;
    const texts = chunk.map((c) => c.innerText.trim().replace(/\s+/g, ' '));
    if (HEADER.has(texts[0]) || HEADER.has(texts[2])) continue;
    if (!/\d{4}/.test(texts[2])) continue;
    rows.push({ texts, expiryIndex: i + 2 });
  }

  if (rows.length === 0) {
    return { ok: false, reason: 'no cert rows in .xwup-tableview-cell' };
  }

  const expiryMatchesMonth = (text, m) => {
    const mm = String(m).padStart(2, '0');
    return (
      text.includes(`-${mm}-`) ||
      text.includes(`.${mm}.`) ||
      text.includes(`/${mm}/`) ||
      new RegExp(`\\d{4}[.\\-/]${mm}[.\\-/]`).test(text)
    );
  };

  let rowIdx = -1;
  if (expiry) {
    const norm = expiry.replace(/-/g, '.');
    rowIdx = rows.findIndex(
      (r) => r.texts[2].includes(expiry) || r.texts[2].includes(norm)
    );
  }
  if (rowIdx < 0 && month >= 1 && month <= 12) {
    rowIdx = rows.findIndex((r) => expiryMatchesMonth(r.texts[2], month));
  }
  if (rowIdx < 0 && name) {
    rowIdx = rows.findIndex(
      (r) => r.texts[1].includes(name) || r.texts.some((t) => t.includes(name))
    );
  }
  if (rowIdx < 0 && index >= 1) {
    rowIdx = Math.min(index - 1, rows.length - 1);
  }
  if (rowIdx < 0) rowIdx = 0;

  const row = rows[rowIdx];
  return {
    ok: true,
    cellIndex: row.expiryIndex,
    rowIdx,
    texts: row.texts,
    expiryText: row.texts[2],
    nameText: row.texts[1],
  };
}

/** Self-contained for page.evaluate — dump rows with xpaths. */
function dumpWooriCertRowsInBrowser() {
  const COLS = 4;
  const HEADER = new Set(['구분', '사용자', '만료일', '발급자', '']);

  const xpathFor = (el) => {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 16; depth++) {
      let seg = node.tagName.toLowerCase();
      if (node.id) {
        seg += `[@id="${node.id}"]`;
        parts.unshift(seg);
        break;
      }
      const parent = node.parentElement;
      if (!parent) break;
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      seg += `[${sameTag.indexOf(node) + 1}]`;
      parts.unshift(seg);
      node = parent;
    }
    return parts.length ? `/${parts.join('/')}` : '';
  };

  const allCells = Array.from(document.querySelectorAll('.xwup-tableview-cell'));
  const rows = [];

  for (let i = 0; i < allCells.length; i += COLS) {
    const chunk = allCells.slice(i, i + COLS);
    if (chunk.length < COLS) break;
    const texts = chunk.map((c) => c.innerText.trim().replace(/\s+/g, ' '));
    if (HEADER.has(texts[0]) || HEADER.has(texts[2])) continue;
    if (!/\d{4}/.test(texts[2])) continue;
    rows.push({
      index: rows.length,
      texts,
      cellIndex: i + 2,
      expiryXpath: xpathFor(chunk[2]),
      nameXpath: xpathFor(chunk[1]),
    });
  }

  return {
    allCellCount: allCells.length,
    rows,
    staleTableRowCount: document.querySelectorAll('table tbody tr').length,
    hasCertTable: !!document.querySelector('#xwup_cert_table'),
  };
}

module.exports = {
  WOORI_CERT_COLS,
  WOORI_CERT_HEADER,
  resolveWooriCertCellInBrowser,
  dumpWooriCertRowsInBrowser,
};

/**
 * Woori xwup cert list helpers.
 *
 * DOM layout (from woori-cert-debug dumps): each cert row has a hidden template cell
 * "선택 정상 인증서" (display:none) followed by 4 visible cells:
 *   구분 | 사용자 | 만료일 | 발급자
 *
 * Each function passed to page.evaluate MUST be fully self-contained — Playwright
 * only serializes that one function, not other exports in this module.
 */

const WOORI_CERT_DATA_COLS = 4;

/** Self-contained for page.evaluate. */
function resolveWooriCertCellInBrowser({ index = 1, expiry = '', name = '', month = 0 } = {}) {
  const DATA_COLS = 4;

  function parseRows() {
    const allCells = Array.from(document.querySelectorAll('.xwup-tableview-cell'));
    const dataCells = [];
    for (let i = 0; i < allCells.length; i++) {
      const el = allCells[i];
      const text = el.innerText.trim().replace(/\s+/g, ' ');
      if (!text || text === '선택 정상 인증서') continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      dataCells.push({ text, globalIndex: i });
    }
    const rows = [];
    for (let i = 0; i < dataCells.length; i += DATA_COLS) {
      const chunk = dataCells.slice(i, i + DATA_COLS);
      if (chunk.length < DATA_COLS) break;
      const texts = chunk.map((c) => c.text);
      if (!/\d{4}/.test(texts[2])) continue;
      rows.push({
        texts,
        nameText: texts[1],
        expiryText: texts[2],
        typeText: texts[0],
        expiryIndex: chunk[2].globalIndex,
      });
    }
    return rows;
  }

  const rows = parseRows();
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
      (r) => r.expiryText.includes(expiry) || r.expiryText.includes(norm)
    );
  }
  if (rowIdx < 0 && month >= 1 && month <= 12) {
    rowIdx = rows.findIndex((r) => expiryMatchesMonth(r.expiryText, month));
    if (rowIdx < 0) {
      return {
        ok: false,
        reason: `no cert with expiry month ${month} (available: ${rows.map((r) => r.expiryText).join(', ')})`,
        rows: rows.map((r) => ({ name: r.nameText, expiry: r.expiryText })),
      };
    }
  }
  if (rowIdx < 0 && name) {
    rowIdx = rows.findIndex(
      (r) => r.nameText.includes(name) || r.texts.some((t) => t.includes(name))
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
    expiryText: row.expiryText,
    nameText: row.nameText,
    typeText: row.typeText,
  };
}

/** Self-contained for page.evaluate. */
function dumpWooriCertRowsInBrowser() {
  const DATA_COLS = 4;

  function xpathFor(el) {
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
  }

  const allCells = Array.from(document.querySelectorAll('.xwup-tableview-cell'));
  const dataCells = [];
  for (let i = 0; i < allCells.length; i++) {
    const el = allCells[i];
    const text = el.innerText.trim().replace(/\s+/g, ' ');
    if (!text || text === '선택 정상 인증서') continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    dataCells.push({ el, text, globalIndex: i });
  }

  const parsedRows = [];
  for (let i = 0; i < dataCells.length; i += DATA_COLS) {
    const chunk = dataCells.slice(i, i + DATA_COLS);
    if (chunk.length < DATA_COLS) break;
    const texts = chunk.map((c) => c.text);
    if (!/\d{4}/.test(texts[2])) continue;
    parsedRows.push({ texts, chunk });
  }

  return {
    allCellCount: allCells.length,
    visibleDataCellCount: dataCells.length,
    rows: parsedRows.map((row, index) => ({
      index,
      texts: row.texts,
      cellIndex: row.chunk[2].globalIndex,
      expiryXpath: xpathFor(row.chunk[2].el),
      nameXpath: xpathFor(row.chunk[1].el),
    })),
    staleTableRowCount: document.querySelectorAll('table tbody tr').length,
    hasCertTable: !!document.querySelector('#xwup_cert_table'),
  };
}

module.exports = {
  WOORI_CERT_DATA_COLS,
  resolveWooriCertCellInBrowser,
  dumpWooriCertRowsInBrowser,
};

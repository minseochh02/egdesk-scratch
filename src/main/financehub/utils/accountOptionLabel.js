/**
 * Parse human-readable labels from bank dropdown/button text.
 * Examples:
 *   "213-890060-03104 기업자유예금"
 *   "243-890022-31204 기업자유예금 [거래중지]"
 *   IBK (기업은행): "922-001568-15-119:주거래기업부금(정기적립식)" — digits/hyphens, then ":", then product name
 * Middle segment is often 6 digits; older patterns used only \d{2,4} and failed to match.
 */

/** First dashed account token in a label (flexible middle segment). */
const DASHED_ACCOUNT_IN_LABEL_RE = /(\d{3}-\d{2,6}-\d{4,7})/;

function firstDashedAccountInText(text) {
  const m = String(text || '').match(DASHED_ACCOUNT_IN_LABEL_RE);
  return m ? m[1] : null;
}

/**
 * Returns the display name after the account number (nickname, product, [거래중지], etc.).
 * @param {string} text - Full option or button label
 * @param {string} [fallback]
 */
function accountDisplayNameFromOptionText(text, fallback = '계좌') {
  const t = String(text || '').trim();
  if (!t) return fallback;

  // IBK corporate banking: account segments then ":" then nickname / product (not space-separated)
  const ibkColon = t.match(/^\d{3}-[\d\-]+:(.+)$/);
  if (ibkColon) {
    const rest = ibkColon[1].trim();
    if (rest) return rest;
  }

  const dashed = firstDashedAccountInText(t);
  if (dashed) {
    const idx = t.indexOf(dashed);
    const rest = (idx >= 0 ? t.slice(idx + dashed.length) : t).trim();
    return rest || fallback;
  }

  const compact = t.match(/^(\d{10,16})(?:\s+|$)/);
  if (compact) {
    const rest = t.slice(compact[0].length).trim();
    return rest || fallback;
  }

  // Already a clean nickname / no leading account token
  return t;
}

module.exports = {
  DASHED_ACCOUNT_IN_LABEL_RE,
  firstDashedAccountInText,
  accountDisplayNameFromOptionText,
};

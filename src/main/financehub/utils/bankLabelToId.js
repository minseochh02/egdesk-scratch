/**
 * Map free-text Korean bank labels (e.g. SERP Excel "은행" column) to `banks.id`.
 * Only returns IDs that exist in the Finance Hub banks seed.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function resolveKoreanBankLabelToId(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/\s/g, '').toLowerCase();
  if (!s) return null;

  // Longer / specific patterns first
  if (s.includes('카카오')) return 'kakao';
  if (s.includes('토스')) return 'toss';
  // IBK: SERP/aggregators often use "기업" alone (기업은행)
  if (s.includes('ibk') || s.includes('기업은행') || s === '기업') return 'ibk';
  if (s.includes('농협') || s.includes('nh') || s === 'nhbank') return 'nh';
  if (s.includes('국민') || s.includes('kookmin') || (s.includes('kb') && !s.includes('카드'))) return 'kookmin';
  if (s.includes('신한')) return 'shinhan';
  if (s.includes('우리')) return 'woori';
  if (s.includes('하나') || s.includes('hana') || s.includes('keb')) return 'hana';

  return null;
}

module.exports = { resolveKoreanBankLabelToId };

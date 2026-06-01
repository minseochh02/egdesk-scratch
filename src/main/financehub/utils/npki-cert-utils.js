/**
 * NPKI 공동인증서 HDD store enumeration and parsing.
 *
 * Reads certificates directly from disk — no browser, no shelling out.
 * Preserves NTFS/readdir enumeration order (never sorts), which is exactly
 * the order Delfino QWidget shows them when lastUsedCertFirst = false.
 * The 1-based `certificateIndex` of each entry = the number of DOWN presses
 * needed to reach that cert in the native cert window.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/** Search order per spec §Step 1 */
const NPKI_ROOTS = [
  path.join(os.homedir(), 'AppData', 'LocalLow', 'NPKI'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'NPKI'),
  path.join(os.homedir(), 'AppData', 'Local', 'NPKI'),
];

/**
 * Find the first NPKI root that exists on disk.
 * @returns {string | null}
 */
function findNpkiRoot() {
  for (const root of NPKI_ROOTS) {
    if (fs.existsSync(root)) return root;
  }
  return null;
}

/**
 * Enumerate all signCert.der entries under `root` in readdir order (never sorted).
 * Traverses: root/<CA>/USER/<certFolder>/signCert.der
 *
 * @param {string} root - NPKI root path
 * @returns {{ index: number, folder: string, signCert: string, dir: string }[]}
 */
function listNpkiCerts(root) {
  const certs = [];
  let caEntries;
  try {
    caEntries = fs.readdirSync(root); // NO sort — NTFS order = Delfino order
  } catch {
    return certs;
  }
  for (const ca of caEntries) {
    const userDir = path.join(root, ca, 'USER');
    if (!fs.existsSync(userDir)) continue;
    let folders;
    try {
      folders = fs.readdirSync(userDir); // NO sort
    } catch {
      continue;
    }
    for (const folder of folders) {
      const dir = path.join(userDir, folder);
      const signCert = path.join(dir, 'signCert.der');
      if (fs.existsSync(signCert)) {
        certs.push({ index: certs.length + 1, folder, signCert, dir });
      }
    }
  }
  return certs;
}

/**
 * Parse a single DN string (multi-line, e.g. "CN=홍길동\nO=KICA\nC=KR") for a named field.
 * @param {string} dn
 * @param {string} field - e.g. 'CN', 'O'
 * @returns {string}
 */
function parseDnField(dn, field) {
  for (const line of dn.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key === field) return line.slice(eq + 1).trim();
  }
  return '';
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/**
 * Parse name, issuer, and expiry from a signCert.der file.
 * Uses Node.js built-in crypto.X509Certificate (no external deps).
 *
 * @param {string} signCertPath
 * @param {string} folderName - fallback display name if CN parse fails
 * @returns {{ name: string, issuer: string, notAfter: Date | null, parseError?: string }}
 */
function parseCert(signCertPath, folderName) {
  try {
    const der = fs.readFileSync(signCertPath);
    const cert = new crypto.X509Certificate(der);
    const cn = parseDnField(cert.subject, 'CN') || safeDecode(folderName);
    const issuer = parseDnField(cert.issuer, 'O') || '';
    const notAfter = cert.validTo ? new Date(cert.validTo) : null;
    return { name: cn, issuer, notAfter };
  } catch (e) {
    return { name: safeDecode(folderName), issuer: '', notAfter: null, parseError: e.message };
  }
}

/**
 * Full pipeline: find NPKI root → enumerate → parse → return display-ready list.
 *
 * @param {{ sortByExpiry?: boolean }} [opts]
 *   sortByExpiry: if true, sort by notAfter ascending (nearest expiry = index 1).
 *   Used for INICertManUI (Shinhan), which renders the list in expiry order.
 *   Delfino QWidget banks use NTFS readdir order — leave this false (default).
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   certificates: Array<{
 *     certificateIndex: number,
 *     folder: string,
 *     name: string,
 *     issuer: string,
 *     notAfter: string | null,
 *     expired: boolean,
 *     소유자명: string,
 *     발급기관: string,
 *     만료일: string | null,
 *   }>
 * }}
 */
function listAllNpkiCerts(opts = {}) {
  const { sortByExpiry = false } = opts;
  const root = findNpkiRoot();
  if (!root) {
    return { ok: false, error: 'NPKI 폴더를 찾을 수 없습니다.', certificates: [] };
  }

  const raw = listNpkiCerts(root);
  if (raw.length === 0) {
    return { ok: false, error: 'NPKI 폴더에 인증서가 없습니다.', certificates: [] };
  }

  const now = new Date();
  let certificates = raw.map((entry) => {
    const parsed = parseCert(entry.signCert, entry.folder);
    const expired = parsed.notAfter ? parsed.notAfter < now : false;
    const notAfterStr = parsed.notAfter
      ? parsed.notAfter.toISOString().slice(0, 10)
      : null;
    return {
      certificateIndex: entry.index,
      folder: entry.folder,
      name: parsed.name,
      issuer: parsed.issuer,
      notAfter: notAfterStr,
      expired,
      // Legacy field names for existing UI
      소유자명: parsed.name,
      발급기관: parsed.issuer,
      만료일: notAfterStr,
    };
  });

  if (sortByExpiry) {
    // INICertManUI sort: nearest expiry first; null expiry goes last
    certificates.sort((a, b) => {
      if (a.notAfter === null && b.notAfter === null) return 0;
      if (a.notAfter === null) return 1;
      if (b.notAfter === null) return -1;
      return a.notAfter < b.notAfter ? -1 : a.notAfter > b.notAfter ? 1 : 0;
    });
    // Reassign 1-based index to match the sorted visual row order
    certificates = certificates.map((c, i) => ({ ...c, certificateIndex: i + 1 }));
  }

  return { ok: true, certificates };
}

/**
 * Resolve the current 1-based index of a certificate based on its metadata.
 *
 * @param {Object} metadata - Saved certificate metadata
 * @param {string} metadata.name - Certificate owner name (CN)
 * @param {string} metadata.issuer - Certificate issuer (O)
 * @param {string} [metadata.notAfter] - Expiry date string (YYYY-MM-DD)
 * @param {string} [metadata.folder] - Folder name (optional fallback)
 * @param {{ sortByExpiry?: boolean }} [opts] - Pass { sortByExpiry: true } for Shinhan (INICertManUI)
 * @returns {number | null} Current 1-based index, or null if not found
 */
function resolveCertificateIndex(metadata, opts = {}) {
  const { ok, certificates } = listAllNpkiCerts(opts);
  if (!ok || !certificates.length) return null;

  // Try to find an exact match by name, issuer, and expiry
  let match = certificates.find((c) => 
    c.name === metadata.name && 
    c.issuer === metadata.issuer && 
    (metadata.notAfter ? c.notAfter === metadata.notAfter : true)
  );

  // Fallback: match by name and issuer only (if expiry changed or not provided)
  if (!match) {
    match = certificates.find((c) => 
      c.name === metadata.name && 
      c.issuer === metadata.issuer
    );
  }

  // Last resort: match by folder name if provided
  if (!match && metadata.folder) {
    match = certificates.find((c) => c.folder === metadata.folder);
  }

  return match ? match.certificateIndex : null;
}

module.exports = { listAllNpkiCerts, findNpkiRoot, listNpkiCerts, parseCert, resolveCertificateIndex };

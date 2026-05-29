# Task: NPKI 공동인증서 Enumeration & Selection (Corporate Cert Login)

## Objective
Build the certificate-discovery and selection step for the native corporate cert login (Delfino QWidget window). Read the user's NPKI 공동인증서 from disk, show a human-readable list (name + 발급기관 + expiry), let the user pick one and enter its password, then hand the **selection index (1-based)** and **password** to the existing `completeCorporateCertificateLogin(certificateIndex, certificatePassword)` flow. That flow already navigates the native cert window by pressing DOWN `(certificateIndex - 1)` times and typing the password.

## Background you must know
- A Korean 공동인증서 = **one folder** containing **four** files: `signCert.der` + `signPri.key` (signing pair) and `kmCert.der` + `kmPri.key` (encryption / key-management pair). The four files together are a **single** certificate — not two. Seeing four files in a folder is normal and = one cert.
- `signCert.der` is the **identity** certificate. Parse this one. Ignore `kmCert.der` entirely.
- The security program lists certs grouped **by storage type**: hard-disk certs are one list, USB/보안토큰 certs are a *separate* list. Each list is an independent index space. **This task only handles the hard-disk (HDD) NPKI store.**

## Critical ordering rule (do not get this wrong)
The native window lists certs in **directory enumeration order** — the raw order the OS returns folders, which on NTFS is folder-name order. This has been verified to match `Get-ChildItem -Recurse` output and the program's on-screen order.

- Enumerate folders in natural `readdir` order. **Never sort.** `fs.readdirSync` on Windows already returns NTFS enumeration order, which is what the program uses.
- Traverse exactly like `Get-ChildItem -Recurse`: iterate each CA folder in enumeration order, then within each CA's `USER/` dir iterate cert folders in enumeration order, then flatten into one list.
- The flattened **1-based position = `certificateIndex`**. The native code presses DOWN `index - 1` times from the top. Re-sorting the list silently breaks selection.

## Step 1 — Locate the NPKI HDD store
Check these roots in order; use the first that exists and contains certs:
1. `%USERPROFILE%\AppData\LocalLow\NPKI`  (modern default)
2. `%APPDATA%\NPKI`
3. `%LOCALAPPDATA%\NPKI`

Folder structure: `<root>/<CA>/USER/<certFolder>/signCert.der`

## Step 2 — Enumerate certs (preserve order, no sort)
```js
const fs = require('fs');
const path = require('path');

function listNpkiCerts(root) {
  const certs = [];
  for (const ca of fs.readdirSync(root)) {              // NO sort
    const userDir = path.join(root, ca, 'USER');
    if (!fs.existsSync(userDir)) continue;
    for (const folder of fs.readdirSync(userDir)) {     // NO sort
      const dir = path.join(userDir, folder);
      const signCert = path.join(dir, 'signCert.der');
      if (fs.existsSync(signCert)) {
        certs.push({ index: certs.length + 1, folder, signCert });
      }
    }
  }
  return certs; // index field is the 1-based certificateIndex
}
```

## Step 3 — Parse name + expiry from signCert.der
Use `node-forge` (pure JS, no shelling out). Display name: prefer the cert's Subject CN, fall back to the URL-decoded folder name. Expiry = `validity.notAfter` (a JS `Date`).

```js
const forge = require('node-forge');

function parseCert(signCertPath, folderName) {
  const der = fs.readFileSync(signCertPath, 'latin1');  // binary string
  const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
  const cn = (cert.subject.getField('CN') || {}).value || safeDecode(folderName);
  const issuer = (cert.issuer.getField('O') || {}).value || '';
  return { name: cn, issuer, notAfter: cert.validity.notAfter };
}

function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }
```
Alternative if `node-forge` is unavailable: shell to `certutil -dump signCert.der` and read the `Subject:` and `NotAfter:` lines (built into Windows).

## Step 4 — Show list, get selection + password
- Render each cert in list order as: `name — 발급기관: {issuer} — 만료일: {YYYY-MM-DD}`.
- Flag any cert where `notAfter < now` as 만료됨 (expired).
- User selects one → you now have its `index`.
- Then prompt for the password **for that cert** (인증서 비밀번호). Treat it as a secret: never log it, never write it to disk.

## Step 5 — Hand off to existing flow
```js
completeCorporateCertificateLogin(selectedCert.index, password);
```
- `index` is 1-based; the existing code presses DOWN `index - 1` times before typing the password.
- `password` is the selected cert's 인증서 비밀번호.

## Rules / do-nots
- **Never sort** the folder lists. Order = index = DOWN-count.
- **HDD store only.** USB/보안토큰 and 금융인증서 are separate lists with separate index spaces — out of scope.
- Parse `signCert.der` only. Never read the `.key` files.
- Password is secret: no logging, no persistence.
- **Recommended safeguard:** before typing the password in the native window, verify the currently-highlighted row matches the selected cert (e.g. `PrintWindow` capture of the cert window + OCR of the highlighted row's CN/expiry). A wrong index burns an attempt against the password-lockout counter, so confirm before committing.

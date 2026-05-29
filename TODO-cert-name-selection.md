# TODO: Cert Selection by Name (Hana)

## Problem
`certificateIndex` is fragile — Delfino's cert list ordering is not stable (changes after cert renewal, Delfino reinstall, etc.), so a hardcoded positional index can select the wrong cert.

## Planned Fix
Add `selectCertByName(windowClass, nameSubstring)` to `windows-uia-native.js` that:
1. Finds the cert window by class name (already have `_hanaCertWindowClass`)
2. Enumerates `ListItem` UIA elements within the cert list
3. Finds the item whose Name contains the target substring
4. Selects it via `SelectionItemPattern.Select()` directly (no DOWN key counting)
5. Returns `{ ok, index, name }` — index can be used as fallback for DOWN key navigation if SelectionItemPattern fails

## Changes Needed
- `windows-uia-native.js`: add `selectCertByName(windowClass, nameSubstring)` and export it
- `HanaBankAutomator.js` `completeCorporateCertificateLogin`: accept `certificateName` in `creds`; when set, call `selectCertByName` before the ENTER+TAB steps; fall back to `certificateIndex` DOWN presses only if name selection fails
- Same pattern should apply to IBK, KB, other banks using `delfinoQwidgetSteps`

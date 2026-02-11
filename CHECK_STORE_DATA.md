# Check Electron Store Data

## Issue
- Shinhan bank is connected but not showing in scheduler credentials
- Tax certificate has empty string as business name key

## Debug Script

Run this in your **DevTools Console** (Ctrl+Shift+I / Cmd+Option+I):

```javascript
// Check all Finance Hub credentials
(async () => {
  const fhConfig = await window.electron.invoke('execute-js', `
    const store = require('electron-store');
    const st = new store();
    const financeHub = st.get('financeHub');
    JSON.stringify(financeHub, null, 2);
  `);
  
  console.log('=== Finance Hub Config ===');
  console.log(JSON.parse(fhConfig));
})();

// Check Hometax certificates
(async () => {
  const hometaxConfig = await window.electron.invoke('execute-js', `
    const store = require('electron-store');
    const st = new store();
    const hometax = st.get('hometax');
    JSON.stringify(hometax, null, 2);
  `);
  
  console.log('=== Hometax Config ===');
  console.log(JSON.parse(hometaxConfig));
})();
```

## What to Look For

### 1. Finance Hub - Bank Credentials
Check `financeHub.savedCredentials`:
```json
{
  "savedCredentials": {
    "bc-card": { "userId": "...", "password": "..." },
    "shinhan": { "userId": "...", "password": "..." }  // <-- Should this be here?
  }
}
```

**Questions:**
- Is `shinhan` present in `savedCredentials`?
- Or is it stored under a different key like `shinhan-bank`?
- Did you check "Save credentials" when connecting?

### 2. Hometax - Business Names
Check `hometax.selectedCertificates`:
```json
{
  "selectedCertificates": {
    "회사명": { // <-- Should be company name, not empty string!
      "xpath": "...",
      "소유자명": "...",
      "businessName": "...",
      "certificatePassword": "..."
    }
  }
}
```

**Questions:**
- What is the key for the certificate? (Should be business name)
- Is `businessName` field present and not empty?
- If the key is empty string `""`, that's the bug!

## Likely Issues

### Bank Credentials Missing
**Cause:** Credentials weren't saved when connecting to Shinhan bank
**Fix Options:**
1. Re-connect to Shinhan bank and ensure "Save credentials" checkbox is checked
2. Or manually add to scheduler (won't auto-sync but can sync manually)

### Tax Certificate Empty Key
**Cause:** Business name wasn't captured during Hometax connection
**Fix:** The `connectToHometax` function needs to properly extract and return the business name, and the frontend needs to use it as the key when saving the certificate.

## Next Steps

After running the debug script, share the output so I can:
1. Confirm bank credential key format
2. See the actual tax certificate structure
3. Identify why business name is empty
4. Fix the root cause

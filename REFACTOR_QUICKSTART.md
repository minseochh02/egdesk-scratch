# Quick Start: Credential Refactor

## What Just Happened?

Your app now stores credentials in the **database** (encrypted) instead of Electron Store. This fixes all the sync issues.

## 🎉 Automatic Migration (No Action Required!)

**Migrations run automatically on app startup for ALL users:**

1. ✅ **Credential Migration** - Moves credentials from Electron Store → Database
2. ✅ **Tax Certificate Migration** - Fixes empty key issue

Check the logs on first startup after update:
```
🔄 Starting automatic credential migration...
✅ Successfully migrated X credential(s) to database

🔄 Starting automatic tax certificate migration...
✅ Fixed X tax certificate(s) with empty keys
```

## Action Required (Only for Shinhan Bank)

### Re-Connect Shinhan Bank

1. Go to FinanceHub UI
2. Find Shinhan bank
3. Click "Connect" (or disconnect first if shown as connected)
4. Enter credentials
5. **✅ CHECK "Save credentials" checkbox**
6. Complete connection

### 4. Restart App

Close and reopen the app. Check the logs:

**Good logs:**
```
[FinanceHubScheduler] Found 2 banks with credentials (DATABASE): ['bc-card', 'shinhan']
[FinanceHubScheduler] ✅ Retrieved credentials from DATABASE for bc-card
[FinanceHubScheduler] ✅ Retrieved credentials from DATABASE for shinhan
```

**Bad logs (if you forgot to save credentials):**
```
[FinanceHubScheduler] ⚠️ Skipping shinhan bank - no credentials in DATABASE
```

## Verification

Run this in DevTools Console to check everything:
```javascript
// Check what's in the database
const result = await window.electron.financeHubDb.getBanksWithCredentials();
console.log('Banks with credentials:', result.data);

// Should show: ['bc-card', 'shinhan'] (or whatever you connected)
```

## Done! 🎉

Your app now has:
- ✅ Encrypted credential storage
- ✅ Single source of truth (database)
- ✅ No more sync mismatches
- ✅ Proper connect/disconnect operations

---

## Troubleshooting

**Problem**: "BC Card still not syncing"
- Run migration script (Step 1 above)
- Restart app

**Problem**: "Shinhan bank still skipped"
- Re-connect with "Save credentials" ✅ checked
- Restart app

**Problem**: "Tax sync still failing"
- Run tax migration script (Step 2 above)
- Restart app

**Still stuck?**
- Run `SHOW_ALL_STORAGE.js` in DevTools to see current state
- Check logs for specific error messages

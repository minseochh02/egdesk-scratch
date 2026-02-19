# Disconnect Credentials Cleanup Fix

## Problem
When users clicked "Disconnect" in the UI for banks or cards, the credentials were **NOT being removed** from storage. This caused:

1. ❌ **Scheduler still sees credentials** → continues scheduling syncs
2. ❌ **"Connected" but actually disconnected** → confusing state
3. ❌ **Zombie syncs** → scheduler tries to sync disconnected entities every day
4. ❌ **Inconsistent with Tax behavior** → only tax properly removed credentials on disconnect

## Root Cause Analysis

### What "Disconnect" Was Doing (Incomplete):
```javascript
// Bank disconnect
ipcMain.handle('finance-hub:disconnect', async (_event, bankId) => {
  // 1. Close browser ✅
  await automator.cleanup(false);
  
  // 2. Delete from active automators ✅
  activeAutomators.delete(bankId);
  
  // 3. Delete accounts from database ✅
  financeHubManager.deleteAccount(account.accountNumber);
  
  // 4. Remove credentials ❌ NOT DONE!
});
```

### What Should Have Happened:
```javascript
// Tax disconnect (correct behavior)
ipcMain.handle('hometax:remove-credentials', async (event, businessNumber) => {
  // Removes credentials from storage ✅
  delete hometaxConfig.selectedCertificates[businessNumber];
  store.set('hometax', hometaxConfig);
});
```

## The Disconnect Flow Bug

### Before Fix:
```
User clicks "Disconnect" 
  → Browser closes ✅
  → DB accounts deleted ✅
  → Active automator removed ✅
  → Credentials STILL IN STORAGE ❌
  → Scheduler sees credentials → schedules sync tomorrow ❌
  → Sync attempts to run on "disconnected" entity ❌
```

### After Fix:
```
User clicks "Disconnect"
  → Browser closes ✅
  → DB accounts deleted ✅
  → Active automator removed ✅
  → Credentials REMOVED FROM STORAGE ✅
  → Scheduler checks → no credentials → skips scheduling ✅
  → No more zombie syncs ✅
```

## Solution

Added credential removal to both bank and card disconnect handlers:

### Bank Disconnect Fix
```javascript
ipcMain.handle('finance-hub:disconnect', async (_event, bankId) => {
  // ... existing cleanup code ...

  // CRITICAL: Remove saved credentials so scheduler doesn't try to sync
  const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
  if (fhConfig.savedCredentials) {
    delete fhConfig.savedCredentials[bankId];
    store.set('financeHub', fhConfig);
    console.log(`[FINANCE-HUB] Removed saved credentials for ${bankId}`);
  }

  return { success: true };
});
```

**Location:** `/src/main/main.ts` ~line 669

### Card Disconnect Fix
```javascript
ipcMain.handle('finance-hub:card:disconnect', async (_event, cardCompanyId) => {
  // ... existing cleanup code ...

  // CRITICAL: Remove saved credentials so scheduler doesn't try to sync
  // Card credentials are stored by cardId (e.g., "nh") not full cardCompanyId (e.g., "nh-card")
  const cardId = cardCompanyId.replace('-card', '');
  const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
  if (fhConfig.savedCredentials) {
    delete fhConfig.savedCredentials[cardId];
    store.set('financeHub', fhConfig);
    console.log(`[FINANCE-HUB] Removed saved credentials for ${cardId}`);
  }

  return { success: true };
});
```

**Location:** `/src/main/main.ts` ~line 868

**Note**: Cards use shortened ID (e.g., `"nh"`) for credentials but full ID (e.g., `"nh-card"`) for UI, so we strip `-card` suffix.

## Why This Bug Existed

### Tax Was Correct (Reference Implementation):
```javascript
// UI calls removeCredentials on disconnect
await window.electron.hometax.removeCredentials(businessNumber);

// Handler removes credentials
delete hometaxConfig.selectedCertificates[businessNumber];
```

### Banks/Cards Were Wrong:
```javascript
// UI only calls disconnect
await window.electron.financeHub.disconnect(bankId);

// Handler didn't remove credentials (BUG)
// User thought it was disconnected, but scheduler still had creds
```

## Impact of Bug

### User Experience:
1. User disconnects NH Card in UI
2. Card disappears from UI → **Looks disconnected** ✅
3. Next day at 4:00 AM → **Scheduler tries to sync NH Card** ❌
4. Sync fails (browser closed) → wastes resources
5. User confused: "I disconnected it, why is it still syncing?"

### Resource Waste:
- User disconnects 3 cards
- Scheduler still tries to sync them every day
- 3 entities × 4 attempts (1 initial + 3 retries) × 2 minutes = **24 minutes wasted daily**

## Testing

### Before Fix:
```bash
# Disconnect card in UI
# Check storage
$ cat ~/Library/Application\ Support/egdesk/config.json | jq '.financeHub.savedCredentials'
{
  "nh": { "userId": "user123", "password": "..." },  # ❌ Still there!
  "shinhan": { "userId": "user456", "password": "..." }
}

# Scheduler still sees it
[FinanceHubScheduler] Scheduled 2 entities  # ❌ Both scheduled
```

### After Fix:
```bash
# Disconnect card in UI
[FINANCE-HUB] Removed saved credentials for nh  # ✅ Logs removal

# Check storage
$ cat ~/Library/Application\ Support/egdesk/config.json | jq '.financeHub.savedCredentials'
{
  "shinhan": { "userId": "user456", "password": "..." }  # ✅ Only shinhan left
}

# Scheduler skips it
[FinanceHubScheduler] ⚠️ Skipping nh card - no credentials configured  # ✅ Properly skipped
[FinanceHubScheduler] Scheduled 1 entity (skipped entities without credentials)
```

## Logs to Watch For

### On Disconnect:
```
[FINANCE-HUB] Deleted account 1234567890 for nh
[FINANCE-HUB] Removed saved credentials for nh  # ← NEW LOG
```

### On Scheduler Start:
```
[FinanceHubScheduler] ⚠️ Skipping nh card - no credentials configured  # ← Entity properly skipped
[FinanceHubScheduler] Scheduled 2 entities (skipped entities without credentials)
```

## Edge Cases Handled

### 1. Credential Object Doesn't Exist
```javascript
const fhConfig = store.get('financeHub') || { savedCredentials: {}, connectedBanks: [] };
if (fhConfig.savedCredentials) {  // ← Safe check
  delete fhConfig.savedCredentials[bankId];
}
```

### 2. Card ID vs Card Company ID
```javascript
// Card disconnect receives "nh-card" but credentials stored as "nh"
const cardId = cardCompanyId.replace('-card', '');  // ← Convert to storage format
delete fhConfig.savedCredentials[cardId];
```

### 3. Already Disconnected
```javascript
// Delete is safe even if key doesn't exist
delete fhConfig.savedCredentials[bankId];  // No error if already deleted
```

## Consistency Across Entity Types

Now all three entity types properly remove credentials on disconnect:

| Entity Type | Disconnect Handler | Removes Credentials? |
|-------------|-------------------|---------------------|
| **Tax** | `hometax:remove-credentials` | ✅ Yes (always did) |
| **Bank** | `finance-hub:disconnect` | ✅ **Yes (now fixed)** |
| **Card** | `finance-hub:card:disconnect` | ✅ **Yes (now fixed)** |

## Related Issues Fixed

1. **Zombie Syncs**: Disconnected entities no longer sync
2. **Scheduler Bloat**: Only configured entities are scheduled
3. **Credential Leaks**: Disconnecting properly clears sensitive data
4. **User Confusion**: Disconnect now means "fully disconnected"
5. **Resource Waste**: No more failed sync attempts for disconnected entities

## Security Benefit

Before fix: Credentials persisted even after user thought they disconnected
After fix: Credentials properly removed when user clicks disconnect

This is important for:
- Shared computers
- Demo/testing environments
- Security audits

## Related Files Modified
1. `/src/main/main.ts` - Added credential removal to disconnect handlers

## Works Together With
- `SCHEDULER_CREDENTIAL_PRECHECK_FIX.md` - Scheduler now checks credentials before scheduling
- Both fixes combined ensure disconnected entities are truly disconnected

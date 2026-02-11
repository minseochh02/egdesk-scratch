# Card Credentials Key Mismatch Fix

## Problem
The scheduler was showing `⚠️ Skipping bc card - no credentials configured` even though BC card credentials were saved and the card was connected.

## Root Cause
There was a **key naming mismatch** between how card credentials are stored and how the scheduler checks for them:

### Credentials Storage (Frontend/IPC)
- Card credentials are saved with **full card IDs** that include the `-card` suffix
- Examples: `"bc-card"`, `"nh-card"`, `"kb-card"`, `"shinhan-card"`
- Saved via: `window.electron.financeHub.saveCredentials(selectedCard.id, cardCredentials)`

### Scheduler Settings
- Scheduler settings use **short card keys** without the `-card` suffix
- Examples: `"bc"`, `"nh"`, `"kb"`, `"shinhan"`
- Defined in: `settings.cards = { bc: {...}, nh: {...}, kb: {...}, ... }`

### The Mismatch
When the scheduler tried to check if credentials exist:
```typescript
// cardKey = "bc" (from settings.cards)
if (savedCredentials[cardKey]) { // Checks savedCredentials["bc"] - doesn't exist!
  this.scheduleEntity('card', cardKey, schedule.time, now);
}
```

But credentials were stored as:
```typescript
savedCredentials["bc-card"] = { userId: "...", password: "...", ... }
```

So the scheduler couldn't find the credentials!

## Solution

### 1. Fixed Credential Lookup in scheduleNextSync() ✅
Added `-card` suffix when checking for card credentials:

```typescript
// Schedule cards
for (const [cardKey, schedule] of Object.entries(this.settings.cards)) {
  if (schedule && schedule.enabled) {
    // CRITICAL: Card credentials are saved with "-card" suffix (e.g., "bc-card")
    // but scheduler settings use short keys (e.g., "bc")
    const credentialKey = `${cardKey}-card`;
    
    if (savedCredentials[credentialKey]) {  // Now checks "bc-card"
      this.scheduleEntity('card', cardKey, schedule.time, now);
    } else {
      console.log(`[FinanceHubScheduler] ⚠️  Skipping ${cardKey} card - no credentials configured`);
    }
  }
}
```

### 2. Fixed Credential Lookup in syncCard() ✅
Added `-card` suffix when fetching credentials during sync:

```typescript
const syncPromise = (async () => {
  try {
    const store = getStore();
    const financeHub = store.get('financeHub') as any || { savedCredentials: {} };
    
    // CRITICAL: Card credentials are saved with "-card" suffix
    const credentialKey = `${cardId}-card`;
    const savedCredentials = financeHub.savedCredentials?.[credentialKey];

    if (!savedCredentials) {
      this.debugLog(`❌ No saved credentials for card:${cardId} (checked key: ${credentialKey})`);
      return {
        success: false,
        error: 'No saved credentials found for this card'
      };
    }
    // ... rest of sync logic
```

### 3. Fixed Card Disconnect Handler ✅
The disconnect handler was incorrectly trying to delete with the short key. Fixed to use full `cardCompanyId`:

**Before:**
```typescript
// Wrong: Tried to delete savedCredentials["bc"]
const cardId = cardCompanyId.replace('-card', '');
delete fhConfig.savedCredentials[cardId];
```

**After:**
```typescript
// Correct: Delete savedCredentials["bc-card"]
delete fhConfig.savedCredentials[cardCompanyId];
```

## Files Modified

1. **`src/main/financehub/scheduler/FinanceHubScheduler.ts`**
   - `scheduleNextSync()`: Added `-card` suffix when checking credentials
   - `syncCard()`: Added `-card` suffix when fetching credentials

2. **`src/main/main.ts`**
   - `finance-hub:card:disconnect` handler: Fixed to delete with full cardCompanyId

## Impact

### Immediate Benefits
- ✅ Scheduler now correctly finds saved card credentials
- ✅ Cards with saved credentials will be scheduled for automatic sync
- ✅ Card disconnect properly removes credentials from storage
- ✅ No more false "no credentials configured" warnings for connected cards

### Data Consistency
- Existing credentials are **already stored correctly** with `-card` suffix
- No data migration needed
- Just restart the app to apply the fix

## Testing
1. **Restart the app**
2. **Check logs** - Should see cards scheduled instead of "no credentials configured"
3. **Wait for scheduled sync time** - Cards should sync automatically
4. **Test manual sync** - Should work without errors
5. **Test disconnect** - Credentials should be properly removed

## Why This Happened

The mismatch occurred because:
1. Card objects in the frontend use full IDs like `"bc-card"` (from `types.ts`)
2. Scheduler settings use shorter keys like `"bc"` (for cleaner config)
3. The scheduler didn't account for this naming difference when looking up credentials

## Prevention
- Document the key naming conventions clearly
- Consider using constants/enums for card IDs to ensure consistency
- Add unit tests that verify credential storage and retrieval

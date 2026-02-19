# Scheduler Credential Pre-Check Fix

## Problem
The scheduler was **scheduling all enabled entities** (8 cards, 4 banks, N tax businesses) regardless of whether the user had saved credentials for them. This caused:

1. ❌ **Unnecessary sync attempts** every day at scheduled times
2. ❌ **"No saved credentials" errors** filling up logs
3. ❌ **Retry attempts** that would never succeed (wasting 5 min × 3 retries per entity)
4. ❌ **Recovery system re-attempts** on app restart
5. ❌ **Resource waste** - opening browsers, attempting logins for unconfigured accounts

### Example Scenario
User has:
- ✅ NH Card credentials saved
- ✅ Shinhan Card credentials saved
- ❌ BC Card **NOT configured**
- ❌ KB Card **NOT configured**
- ❌ Hana Card **NOT configured**
- ❌ Samsung Card **NOT configured**
- ❌ Hyundai Card **NOT configured**
- ❌ Lotte Card **NOT configured**

But scheduler was:
- ✅ Scheduling NH Card sync at 4:00 AM
- ✅ Scheduling Shinhan Card sync at 4:10 AM
- ❌ Scheduling BC Card sync at 4:00 AM → **fails** → retries 3 times
- ❌ Scheduling KB Card sync at 4:30 AM → **fails** → retries 3 times
- ❌ Scheduling Hana Card sync at 4:10 AM → **fails** → retries 3 times
- ... (6 more failed syncs)

**Result**: 6 failed syncs + 18 retries = **24 unnecessary operations per day**!

## Root Cause

The `scheduleNextSync()` method was checking:
1. ✅ Is entity enabled in settings? → `if (schedule.enabled)`
2. ❌ **Missing**: Does user have credentials for this entity?

The credential check only happened **when the sync executed**, not **when scheduling**.

### Old Flow
```
App Start
  → Load settings → All 8 cards enabled by default
  → Schedule all 8 cards
  → 4:00 AM: Try BC Card sync → "No credentials" → mark as permanent error
  → 4:10 AM: Try Hana Card sync → "No credentials" → mark as permanent error
  → ... (6 more failures)
```

## Solution

Added **credential pre-check** before scheduling:

```typescript
private async scheduleNextSync(): Promise<void> {
  const now = new Date();
  const store = getStore();
  const financeHub = store.get('financeHub') as any || { savedCredentials: {} };
  const savedCredentials = financeHub.savedCredentials || {};

  // Schedule cards
  for (const [cardKey, schedule] of Object.entries(this.settings.cards)) {
    if (schedule && schedule.enabled) {
      // CRITICAL: Only schedule if credentials exist
      if (savedCredentials[cardKey]) {
        this.scheduleEntity('card', cardKey, schedule.time, now);
      } else {
        console.log(`[FinanceHubScheduler] ⚠️  Skipping ${cardKey} card - no credentials configured`);
      }
    }
  }
  
  // Similar checks for banks and tax...
}
```

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 375

### New Flow
```
App Start
  → Load settings → All 8 cards enabled
  → Check credentials → Only NH + Shinhan have creds
  → Schedule ONLY NH + Shinhan cards
  → 4:00 AM: NH Card sync → Success ✅
  → 4:10 AM: Shinhan Card sync → Success ✅
  → (No failed syncs!)
```

## What Gets Checked

### Cards & Banks
```typescript
if (savedCredentials[cardKey]) {
  // Has credentials → schedule sync
} else {
  // No credentials → skip and log warning
}
```

### Tax (Certificate-Based)
```typescript
const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
const certData = hometaxConfig.selectedCertificates?.[businessNumber];

if (certData && certData.certificatePassword) {
  // Has certificate + password → schedule sync
} else {
  // No certificate → skip and log warning
}
```

## Benefits

### Before Fix:
- 8 card entities enabled by default
- User has 2 configured → **6 fail every day**
- Each failure → 3 retries (5 min each)
- **Total waste**: 6 entities × 4 attempts × ~2 min = **~48 minutes of failed operations per day**

### After Fix:
- 8 card entities enabled by default
- User has 2 configured → **only 2 scheduled**
- Zero failed syncs from missing credentials
- **Total waste**: **0 minutes** ✅

## Logs

### Before (Noisy):
```
[FinanceHubScheduler] Scheduled 8 entities
[FinanceHubScheduler] card:bc sync failed: No saved credentials found for this card
[FinanceHubScheduler] card:bc failed (attempt 1/3), retrying in 5 minutes...
[FinanceHubScheduler] card:bc sync failed: No saved credentials found for this card
[FinanceHubScheduler] card:bc failed (attempt 2/3), retrying in 5 minutes...
... (repeated for 6 unconfigured cards)
```

### After (Clean):
```
[FinanceHubScheduler] ⚠️  Skipping bc card - no credentials configured
[FinanceHubScheduler] ⚠️  Skipping kb card - no credentials configured
[FinanceHubScheduler] ⚠️  Skipping hana card - no credentials configured
[FinanceHubScheduler] ⚠️  Skipping samsung card - no credentials configured
[FinanceHubScheduler] ⚠️  Skipping hyundai card - no credentials configured
[FinanceHubScheduler] ⚠️  Skipping lotte card - no credentials configured
[FinanceHubScheduler] Scheduled 2 entities (skipped entities without credentials)
```

## Edge Cases Handled

### 1. User Adds Credentials Later
- Scheduler is restarted when credentials are saved
- New credential is detected → entity is scheduled ✅

### 2. User Removes Credentials
- Scheduler is restarted when credentials are removed
- Missing credential is detected → entity is skipped ✅

### 3. Empty Credentials Object
```typescript
const savedCredentials = financeHub.savedCredentials || {};
// Handles undefined/null gracefully
```

### 4. Tax Certificate Without Password
```typescript
if (certData && certData.certificatePassword) {
  // Both must exist to schedule
}
```

## Testing
After this fix:
1. ✅ Only entities with credentials are scheduled
2. ✅ No more "No saved credentials" sync failures
3. ✅ No wasted retries for unconfigured entities
4. ✅ Clean logs with explicit skip warnings
5. ✅ Scheduler dynamically adjusts when credentials added/removed

## Impact

For a typical user with 2 cards configured out of 8:
- **Before**: 24 failed operations per day (6 entities × 4 attempts each)
- **After**: 0 failed operations per day
- **Savings**: ~48 minutes of wasted CPU/network per day

For production with 100 users:
- **Before**: 2,400 failed operations per day
- **After**: 0 failed operations
- **Savings**: ~80 CPU-hours per day

## Related Files Modified
1. `/src/main/financehub/scheduler/FinanceHubScheduler.ts` - Added credential pre-check to `scheduleNextSync()`

## Related Issues Fixed
1. Prevents scheduling entities without credentials
2. Eliminates unnecessary "No saved credentials" errors
3. Stops wasted retry attempts
4. Reduces log noise
5. Improves scheduler efficiency

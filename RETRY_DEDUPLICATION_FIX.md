# Retry Deduplication Fix

## Problem
When a card/bank sync fails and schedules a retry, then the app is closed and reopened, the retry system attempts to execute the task **twice**:
1. **Scheduled retry timer** (if app stays open long enough)
2. **Recovery system** (when app reopens and detects failed task)

This causes duplicate sync attempts and wastes resources.

## Root Cause
1. **In-memory retry timers** are stored in `syncTimers` Map but lost when app closes
2. **Recovery system** doesn't check if a retry timer is already scheduled
3. **No deduplication** between scheduled retries and recovery retries
4. **Retry timers aren't cleared** when they execute (so check always returns true)

## Solution
Added multiple layers of protection against duplicate retries:

### 1. Check for Existing Retry Timer (`FinanceHubScheduler.ts`)
Before executing any sync, check if a retry timer is already scheduled:

```typescript
// CRITICAL: Check if retry timer already scheduled (prevents duplicate retries)
if (this.syncTimers.has(entityKey)) {
  console.log(`[FinanceHubScheduler] ❌ EXIT POINT 1.5: ${entityKey} already has a retry timer scheduled - skipping to prevent duplicate`);
  return;
}
```

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 505

### 2. Clear Timer When Retry Executes
When a retry timer fires and the sync starts, remove it from tracking:

```typescript
// CRITICAL: Clear retry timer if this is a retry execution
// The timer already fired, so remove it from tracking
if (retryCount > 0 && this.syncTimers.has(entityKey)) {
  this.debugLog(`Clearing fired retry timer for ${entityKey}`);
  this.syncTimers.delete(entityKey);
}
```

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 494

### 3. Expose Retry Timer Check Methods
Added public methods to check if retries are scheduled:

```typescript
public hasRetryScheduled(entityKey: string): boolean {
  return this.syncTimers.has(entityKey);
}

public getScheduledRetries(): string[] {
  return Array.from(this.syncTimers.keys());
}
```

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 1560

### 4. Recovery System Checks (`recovery-service.ts`)
Before recovery system attempts to re-execute a failed task, check if:
- Entity is currently syncing
- Retry timer is already scheduled

```typescript
// CRITICAL: Check if scheduler is already syncing this entity or has retry scheduled
const syncingEntities = scheduler.getSyncingEntities();
const hasRetry = scheduler.hasRetryScheduled(missed.taskId);

if (syncingEntities.includes(missed.taskId)) {
  console.log(`[RecoveryService] ⚠️  ${missed.taskId} is already syncing - skipping recovery to prevent duplicate`);
  return;
}

if (hasRetry) {
  console.log(`[RecoveryService] ⚠️  ${missed.taskId} already has a retry scheduled - skipping recovery to prevent duplicate`);
  return;
}
```

**Location:** `/src/main/scheduler/recovery-service.ts` ~line 648

## Protection Layers

### Layer 1: In-Progress Check
✅ Already existed - prevents sync if entity is currently syncing

### Layer 2: Retry Timer Check (NEW)
✅ Prevents sync if retry timer is already scheduled

### Layer 3: Timer Cleanup (NEW)
✅ Removes timer from tracking when it fires

### Layer 4: Recovery Deduplication (NEW)
✅ Recovery system checks both in-progress and retry timers before executing

## Scenarios Covered

### Scenario 1: Normal Retry (App Stays Open)
1. Sync fails
2. Retry timer scheduled (5 minutes)
3. Timer fires → clears from `syncTimers` → executes
4. ✅ Works correctly

### Scenario 2: App Close During Retry Wait
1. Sync fails
2. Retry timer scheduled (5 minutes)
3. **App closes** (timer lost from memory)
4. App reopens → Recovery system checks `syncTimers` (empty)
5. Recovery system proceeds with retry
6. ✅ Works correctly, no duplicate

### Scenario 3: Quick Close/Reopen
1. Sync fails
2. Retry timer scheduled (5 minutes)
3. **App closes immediately and reopens**
4. Retry timer lost but entity is marked as failed
5. Recovery system attempts to retry
6. Recovery system checks if retry scheduled (no, timer was lost)
7. Recovery system proceeds
8. ✅ Works correctly, no duplicate

### Scenario 4: Recovery + Existing Timer (Edge Case)
1. Sync fails at 4:00 AM
2. Retry timer scheduled for 4:05 AM
3. User manually triggers recovery at 4:02 AM
4. Recovery system checks `hasRetryScheduled()` → returns true
5. Recovery system skips to avoid duplicate
6. ✅ Timer fires at 4:05 AM as originally scheduled

### Scenario 5: Double Recovery Attempt
1. Sync fails
2. Retry timer scheduled
3. User triggers recovery (starts executing)
4. User triggers recovery again immediately
5. Second recovery checks `syncingEntities` → entity is already syncing
6. ✅ Second attempt is blocked

## Testing
After this fix:
1. ✅ Single retry executes when sync fails
2. ✅ App close/reopen doesn't cause duplicate retries
3. ✅ Manual recovery respects scheduled retries
4. ✅ Multiple recovery attempts are blocked
5. ✅ Retry timers are properly cleaned up after execution

## Logs to Watch For
- `❌ EXIT POINT 1.5: ${entityKey} already has a retry timer scheduled`
- `⚠️  ${taskId} already has a retry scheduled - skipping recovery to prevent duplicate`
- `⚠️  ${taskId} is already syncing - skipping recovery to prevent duplicate`
- `Clearing fired retry timer for ${entityKey}`

## Related Files Modified
1. `/src/main/financehub/scheduler/FinanceHubScheduler.ts` - Added retry deduplication checks
2. `/src/main/scheduler/recovery-service.ts` - Added retry timer check before recovery

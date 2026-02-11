# Scheduler Recovery Service - Dev Mode Enabled

## Problem
The scheduler recovery service was disabled in development mode, showing:
```
ℹ️ Development mode detected - skipping scheduler recovery
ℹ️ To test recovery, set NODE_ENV=production or package the app
```

This prevented testing of the recovery system during development, making it difficult to verify that missed executions are properly detected and retried.

## Root Cause
In `main.ts`, the scheduler recovery service initialization had a production-only check:

```typescript
setTimeout(async () => {
  const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

  if (!isProduction) {
    console.log('ℹ️ Development mode detected - skipping scheduler recovery');
    console.log('ℹ️ To test recovery, set NODE_ENV=production or package the app');
    return;
  }

  // Recovery service initialization...
});
```

This meant the recovery service would never run in development mode.

## Solution

### Removed Production-Only Check ✅

**Before:**
```typescript
// Initialize Scheduler Recovery Service (5 seconds after startup)
// ONLY in production - skip in dev mode for faster testing
setTimeout(async () => {
  const isProduction = process.env.NODE_ENV === 'production' || !process.env.NODE_ENV;

  if (!isProduction) {
    console.log('ℹ️ Development mode detected - skipping scheduler recovery');
    console.log('ℹ️ To test recovery, set NODE_ENV=production or package the app');
    return;
  }

  try {
    console.log('🔄 Checking for missed scheduler executions...');
    const { getSchedulerRecoveryService } = await import('./scheduler/recovery-service');
    const recoveryService = getSchedulerRecoveryService();
    // ...
```

**After:**
```typescript
// Initialize Scheduler Recovery Service (5 seconds after startup)
setTimeout(async () => {
  try {
    console.log('🔄 Checking for missed scheduler executions...');
    const { getSchedulerRecoveryService } = await import('./scheduler/recovery-service');
    const recoveryService = getSchedulerRecoveryService();
    // ...
```

## Files Modified

1. **`src/main/main.ts`**
   - Line ~3326-3334: Removed the `isProduction` check and early return
   - Recovery service now initializes in all environments

## Impact

### Immediate Benefits
- ✅ **Recovery Testing**: Can now test the recovery system during development
- ✅ **Missed Execution Detection**: Detects and retries missed scheduled tasks in dev mode
- ✅ **Better Debugging**: Can verify recovery logic works correctly before deployment
- ✅ **Consistent Behavior**: Recovery service runs the same way in all environments

### What the Recovery Service Does
The recovery service checks for:
1. **Missed Executions**: Tasks that were scheduled but never ran (e.g., PC was off)
2. **Failed Tasks**: Tasks that failed but have retries remaining
3. **Stuck Tasks**: Tasks stuck in "running" state for too long (>1 hour)
4. **Window-Based Recovery**: Executes missed tasks if still within their execution window

### Startup Behavior
After app starts, you'll see:
```
🔄 Checking for missed scheduler executions...
✅ Recovery check complete - found X missed/failed tasks
```

Instead of:
```
ℹ️ Development mode detected - skipping scheduler recovery
```

## Testing
1. **Restart the app** in dev mode
2. **Check logs** - Should see: `🔄 Checking for missed scheduler executions...`
3. **Create a missed task**:
   - Set a scheduler task for a past time today
   - Manually mark it as "pending" in the database
   - Restart the app - recovery should detect and execute it
4. **Verify recovery** by checking execution intents in database

## Dev Mode Scheduler Settings

Note: Even though recovery is enabled, other dev mode settings remain:

### Still Disabled in Dev
- ❌ **Retry Logic**: `retryCount: 0` in dev mode (no retries)
- ❌ **hasRunToday Check**: Skipped (allows multiple runs per day for testing)
- ❌ **Historical Backfill**: Skipped (faster startup)

### Now Enabled in Dev
- ✅ **Recovery Service**: Checks for missed/failed executions
- ✅ **Execution Window Check**: Validates if tasks are within their time window
- ✅ **Stuck Task Detection**: Finds tasks stuck in "running" state

## Why This is Useful

### Development Testing
- Test the recovery logic without packaging the app
- Verify that missed executions are properly detected
- Debug recovery issues before they reach production
- Ensure execution windows work correctly

### Real-World Scenarios
Even in dev, you might encounter scenarios that need recovery:
- App crashes during a scheduled sync
- Kill the app in the middle of execution
- Schedule a task and close the app before it runs
- Test what happens when PC is "off" during scheduled time

## Performance Impact
- Recovery check runs 5 seconds after startup
- Minimal overhead: ~100-500ms to scan execution intents
- Runs once at startup, then waits for periodic checks (every 5 minutes)
- No impact on normal dev workflow

## Future Improvements
Consider adding environment-specific recovery settings:
- Dev: More frequent checks (every 1 minute) for faster testing
- Dev: Lower retry delays (10 seconds vs 5 minutes)
- Dev: More verbose logging for debugging
- Add a "test recovery" button in the UI to manually trigger recovery

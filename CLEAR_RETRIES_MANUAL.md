# Clear Retry Timers - Quick Fix

## How to Clear Stuck Retries

### Option 1: Via Dev Console (Immediate)

Open the app and press **Cmd+Option+I** to open DevTools, then run:

```javascript
// Clear all retry timers and reset sync state
const result = await window.electron.financeHubScheduler.clearRetries();
console.log('Cleared retries:', result);
```

Expected output:
```javascript
{
  success: true,
  cleared: 3,  // Number of retry timers cleared
  entities: ['card:nh', 'card:kb', 'card:bc']  // Which entities had retries
}
```

### Option 2: Via Scheduler UI (If Available)

If there's a scheduler UI panel, add a "Clear Retries" button that calls:
```javascript
await window.electron.financeHubScheduler.clearRetries();
```

### Option 3: Stop & Restart Scheduler

This also clears everything:
```javascript
// Stop clears all timers (schedule + retry)
await window.electron.financeHubScheduler.stop();

// Start rebuilds fresh schedule (only entities with credentials)
await window.electron.financeHubScheduler.start();
```

## What `clearRetries()` Does

1. **Clears all retry timers** → Cancels pending retries
2. **Clears syncingEntities** → Removes "in-progress" flags
3. **Kills active browsers** → Forces cleanup of any stuck browser processes
4. **Returns report** → Shows what was cleared

## When to Use

Use `clearRetries()` when:
- ❌ You see duplicate retry attempts
- ❌ Scheduler seems stuck
- ❌ Old retry timers from disconnected entities still active
- ❌ After testing/debugging to reset state
- ❌ Recovery system keeps attempting old tasks

## What It Does NOT Do

- ❌ Does NOT stop the main scheduler
- ❌ Does NOT clear scheduled syncs (only retries)
- ❌ Does NOT remove credentials
- ❌ Does NOT clear recovery database

If you want a full reset:
```javascript
// Full reset: stop everything and start fresh
await window.electron.financeHubScheduler.stop();
await window.electron.financeHubScheduler.start();
```

## API Reference

### Method Signature
```typescript
clearRetries(): Promise<{
  success: boolean;
  cleared: number;      // Number of retry timers cleared
  entities: string[];   // Entity keys that had retries
  error?: string;       // Error message if failed
}>
```

### Example Response
```javascript
{
  success: true,
  cleared: 3,
  entities: [
    'card:nh',
    'card:kb', 
    'card:bc'
  ]
}
```

## Logs to Watch For

```
[FinanceHubScheduler] 🧹 Clearing all retry timers and sync state...
[FinanceHubScheduler] Cleared retry timer for: card:nh
[FinanceHubScheduler] Cleared retry timer for: card:kb
[FinanceHubScheduler] Clearing 1 entities marked as in-progress: ['card:bc']
[FinanceHubScheduler] Killing 2 active browsers...
[FinanceHubScheduler] ✅ Cleanup complete: Cleared 3 retry timer(s)
```

## Recovery Database Cleanup

If you also want to clear the recovery database (failed intents):

```javascript
// Open DevTools console
const result = await window.electron.schedulerRecovery.execute({ 
  lookbackDays: 3,
  autoExecute: false  // Don't run them, just show what's missed
});

console.log('Missed executions:', result);

// Then manually clear old failed intents (optional)
// This would need a separate handler - for now, restart app to reset recovery
```

## Quick Fix Script

Copy and paste this into DevTools console to clean everything:

```javascript
(async () => {
  console.log('🧹 Starting scheduler cleanup...');
  
  // 1. Clear retries
  const clearResult = await window.electron.financeHubScheduler.clearRetries();
  console.log('✅ Cleared retries:', clearResult);
  
  // 2. Stop scheduler
  await window.electron.financeHubScheduler.stop();
  console.log('✅ Scheduler stopped');
  
  // 3. Start scheduler (rebuilds fresh)
  await window.electron.financeHubScheduler.start();
  console.log('✅ Scheduler started fresh');
  
  // 4. Check status
  const info = await window.electron.financeHubScheduler.getLastSyncInfo();
  console.log('📊 Current status:', info);
  
  console.log('🎉 Cleanup complete!');
})();
```

## Technical Details

### What Gets Cleared

```javascript
// 1. Retry timers
this.syncTimers.clear();  // Map<string, NodeJS.Timeout>

// 2. In-progress flags
this.syncingEntities.clear();  // Set<string>

// 3. Active browsers
await this.killAllBrowsers();  // Closes all browser instances
this.activeBrowsers.clear();  // Map<string, Automator>
```

### What Stays Active

```javascript
// These are NOT cleared:
this.scheduleTimers  // Main schedule (e.g., 4:00 AM daily)
this.settings       // Scheduler settings
// Stored credentials (use disconnect to remove those)
```

## Related Files Modified
1. `/src/main/financehub/scheduler/FinanceHubScheduler.ts` - Added `clearRetries()` method
2. `/src/main/financehub/scheduler/scheduler-ipc-handler.ts` - Added IPC handler
3. `/src/main/preload.ts` - Exposed to renderer

## Use Cases

### Use Case 1: After Testing
```javascript
// You've been testing card syncs manually
// Now want to clear all retry attempts before going to production
await window.electron.financeHubScheduler.clearRetries();
```

### Use Case 2: Stuck State
```javascript
// Scheduler seems stuck with old retries
// Quick fix without restarting app
await window.electron.financeHubScheduler.clearRetries();
```

### Use Case 3: After Disconnect
```javascript
// Disconnected multiple cards
// Want to ensure no lingering retries
await window.electron.financeHubScheduler.clearRetries();
```

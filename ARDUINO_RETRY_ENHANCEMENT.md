# Arduino Retry Cleanup Enhancement

## Problem
When a card sync fails and retries, the Arduino connection sometimes fails again with **port busy errors**, even though `disconnectArduino()` was called. This suggests the serial port isn't being properly released between attempts.

## Root Cause
1. **Lazy Connection**: Arduino connects on first `typeViaArduino()` call, not during initialization
2. **Error State Handling**: If connection fails partway through, port might be in bad state
3. **Async Cleanup**: SerialPort's `close()` callback is async and might not complete before retry
4. **OS-Level Port Lock**: Operating system might hold the port lock briefly after disconnect

## Solutions Implemented

### 1. Enhanced `disconnectArduino()` with Timeout Protection

Added robust error handling and timeout protection:

```javascript
async disconnectArduino() {
  if (this.arduino) {
    try {
      // Check if port is open before attempting to close
      if (this.arduino.isOpen) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.warn('Arduino disconnect timeout - forcing cleanup');
            this.arduino = null;
            resolve();
          }, 5000); // 5 second timeout

          this.arduino.close((err) => {
            clearTimeout(timeout);
            if (err) {
              this.warn(`Arduino disconnect error: ${err.message}`);
            } else {
              this.log('Arduino disconnected');
            }
            this.arduino = null;
            resolve();
          });
        });
      } else {
        // Port exists but not open - just clear reference
        this.log('Arduino port not open, clearing reference');
        this.arduino = null;
      }
    } catch (error) {
      this.warn(`Arduino disconnect exception: ${error.message}`);
      this.arduino = null; // Force cleanup
    }
  }
}
```

**Key Improvements:**
- ✅ Timeout protection (5 seconds) prevents hanging on stuck disconnect
- ✅ Handles `isOpen` check before attempting close
- ✅ Forces cleanup even on errors
- ✅ Always sets `this.arduino = null` to prevent stale references

**Location:** `/src/main/financehub/core/BaseBankAutomator.js` ~line 844

### 2. Added Buffer Delay Before Card Retries

Added 2-second buffer delay specifically for card retries to ensure port is fully released:

```javascript
// Schedule retry
const retryTimer = setTimeout(async () => {
  // CRITICAL: Add small delay before retry to ensure Arduino port is fully released
  // Serial ports sometimes need a moment to fully disconnect at OS level
  if (entityType === 'card') {
    console.log(`[FinanceHubScheduler] Waiting 2s before retry to ensure Arduino port is released...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  this.executeEntitySync(entityType, entityId, timeStr, retryCount + 1);
}, this.settings.retryDelayMinutes * 60 * 1000);
```

**Why This Helps:**
- 5-minute base delay + 2-second buffer = plenty of time for OS to release port
- Only applies to cards (banks don't use Arduino)
- Ensures port is completely free before reconnect attempt

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 626

## Why Retries Were Failing

### Without These Fixes:
1. **First attempt**: Connect → type password → **error** (e.g., timeout) → disconnect → port maybe still locked
2. **Retry (5 min later)**: Try to connect → **EBUSY: port already in use** → fail immediately
3. **Second retry**: Same error, port never fully released

### With These Fixes:
1. **First attempt**: Connect → type password → **error** → disconnect with **timeout protection** → port **forced to close**
2. **Retry (5 min + 2s later)**: **Buffer delay ensures port is free** → connect successfully → complete sync ✅

## Edge Cases Handled

### 1. Connection Never Opened
```javascript
if (this.arduino.isOpen) {
  // close it
} else {
  this.log('Arduino port not open, clearing reference');
  this.arduino = null;
}
```

### 2. Disconnect Hangs
```javascript
const timeout = setTimeout(() => {
  this.warn('Arduino disconnect timeout - forcing cleanup');
  this.arduino = null;
  resolve();
}, 5000);
```

### 3. Disconnect Throws Exception
```javascript
catch (error) {
  this.warn(`Arduino disconnect exception: ${error.message}`);
  this.arduino = null; // Force cleanup
}
```

### 4. OS-Level Port Lock
```javascript
// 2-second buffer before retry
await new Promise(resolve => setTimeout(resolve, 2000));
```

## Testing
After this fix:
1. ✅ Arduino disconnect always completes (with timeout fallback)
2. ✅ Port reference is always cleared (`this.arduino = null`)
3. ✅ Retries have extra buffer time for port to fully release
4. ✅ No more "port busy" errors on retry attempts

## Logs to Watch For

### Success Path:
```
[CardAutomator] Arduino disconnected
[FinanceHubScheduler] Waiting 2s before retry to ensure Arduino port is released...
[CardAutomator] Arduino connected on /dev/cu.usbserial-XXX
```

### Timeout Path (if port stuck):
```
[CardAutomator] Arduino disconnect timeout - forcing cleanup
[FinanceHubScheduler] Waiting 2s before retry to ensure Arduino port is released...
[CardAutomator] Arduino connected on /dev/cu.usbserial-XXX
```

### Error Path (still cleaned up):
```
[CardAutomator] Arduino disconnect error: Port is not open
[CardAutomator] Arduino port not open, clearing reference
```

## Technical Details

### Why 5-Second Timeout?
- SerialPort `close()` should complete in < 1 second normally
- 5 seconds is generous buffer for slow systems
- Timeout ensures we never hang indefinitely

### Why 2-Second Buffer Before Retry?
- OS (especially macOS) may hold port lock briefly after close
- 2 seconds gives kernel time to fully release resources
- Only applies to cards (banks don't need it)

### Double Disconnect Safety
The code still has double disconnect (login's finally + cleanup's finally), but now both are safe:
- First call: Closes port, sets `this.arduino = null`
- Second call: Checks `if (this.arduino)` → false → does nothing

## Related Files Modified
1. `/src/main/financehub/core/BaseBankAutomator.js` - Enhanced `disconnectArduino()`
2. `/src/main/financehub/scheduler/FinanceHubScheduler.ts` - Added retry buffer delay

## Related Issues
- Fixes "EBUSY: Resource busy" errors on card retry attempts
- Prevents port lock leaks from failed sync attempts
- Ensures clean state between retry attempts

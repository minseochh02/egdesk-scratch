# Arduino Serial Port Cleanup Fix

## Problem
The Arduino serial port was **not being disconnected** after scheduler syncs, causing:
1. **Port busy errors** on subsequent runs
2. **Resource leaks** (serial port held open indefinitely)
3. **Inconsistent behavior** between manual and scheduler flows

## Root Cause Analysis

### Manual Flow ✅ (Working Correctly)
```javascript
async login(credentials) {
  try {
    // ... login logic ...
  } finally {
    await this.disconnectArduino(); // ✅ Closes Arduino port
  }
}
```

### Scheduler Flow ❌ (Was Broken)
```javascript
async syncCard(cardId) {
  try {
    const automator = cards.createCardAutomator(cardCompanyId, {
      arduinoPort: '/dev/cu.usbserial-XXX'
    });
    await automator.login(credentials);
    // ... get transactions ...
  } finally {
    await automator.cleanup(false); // ❌ Only closes browser, NOT Arduino!
  }
}
```

### The Problem
The `cleanup()` method in `BaseBankAutomator.js` only closed the browser:

```javascript
async cleanup(keepOpen = true) {
  this.stopSessionKeepAlive();
  
  if (keepOpen) {
    this.log('Keeping browser open for debugging...');
    return;
  }
  
  if (this.browser) {
    await this.browser.close(); // ✅ Browser closed
    this.log('Browser closed');
  }
  // ❌ Arduino never disconnected!
}
```

## Solution
Updated `cleanup()` to **always disconnect Arduino**, regardless of `keepOpen` setting:

```javascript
async cleanup(keepOpen = true) {
  this.stopSessionKeepAlive();

  // CRITICAL: Always disconnect Arduino (even if keeping browser open)
  // Arduino connections must be closed to free the serial port
  if (this.arduino) {
    try {
      await this.disconnectArduino();
    } catch (error) {
      this.warn('Failed to disconnect Arduino:', error.message);
    }
  }

  if (keepOpen) {
    this.log('Keeping browser open for debugging...');
    return;
  }

  if (this.browser) {
    try {
      await this.browser.close();
      this.log('Browser closed');
    } catch (error) {
      this.warn('Failed to close browser:', error.message);
    }
  }
}

// Added base method for consistency
async disconnectArduino() {
  if (this.arduino && this.arduino.isOpen) {
    return new Promise((resolve) => {
      this.arduino.close(() => {
        this.log('Arduino disconnected');
        this.arduino = null;
        resolve();
      });
    });
  }
}
```

## Why This Matters

### Serial Port Lifecycle
1. **Connect**: `new SerialPort({ path: '/dev/cu.usbserial-XXX' })`
2. **Use**: Type password via Arduino HID keyboard emulation
3. **Disconnect**: `arduino.close()` ⚠️ **MUST happen or port stays locked**

### Without Proper Cleanup
- First sync: ✅ Works (port available)
- Second sync: ❌ **EBUSY error** (port still held by previous process)
- Third sync: ❌ Still fails
- Manual UI: ❌ Can't connect to Arduino either

### With Proper Cleanup
- Every sync: ✅ Port properly released after use
- Next sync: ✅ Port available again
- Manual UI: ✅ Can always connect

## Testing
After this fix:
1. ✅ Arduino port is disconnected after every scheduler sync
2. ✅ Serial port is freed and available for next use
3. ✅ No more "port busy" errors on repeated syncs
4. ✅ Consistent behavior between manual and scheduler flows

## Technical Details

### SerialPort Disconnect
```javascript
if (this.arduino && this.arduino.isOpen) {
  this.arduino.close(() => {
    this.log('Arduino disconnected');
    this.arduino = null; // ← Important: Clear reference
  });
}
```

### Why Arduino Disconnect Happens Before keepOpen Check
```javascript
// ALWAYS disconnect Arduino first
await this.disconnectArduino();

// THEN check if we should keep browser open
if (keepOpen) {
  return; // ← Exit early but Arduino already disconnected
}
```

**Reasoning**: 
- Browser can stay open for debugging without issues
- Arduino port MUST be freed (otherwise it blocks other processes)
- Serial port is a shared OS resource, browser windows are not

## Affected Automators
All card automators inherit from `BaseBankAutomator`, so this fix applies to:
- ✅ NH Card
- ✅ KB Card  
- ✅ Shinhan Card
- ✅ Hana Card
- ✅ BC Card
- ✅ Samsung Card
- ✅ Hyundai Card
- ✅ Lotte Card

## Logs to Watch For
After syncs, you should now see:
```
[CardAutomator] Arduino disconnected
[CardAutomator] Browser closed
```

Previously you would only see:
```
[CardAutomator] Browser closed
```

## Related Files Modified
1. `/src/main/financehub/core/BaseBankAutomator.js` - Added Arduino disconnect to cleanup()

## Related Issues Fixed
1. **EBUSY errors** when scheduler runs multiple card syncs
2. **Port locked** messages preventing manual Arduino use
3. **Resource leaks** from unclosed serial port connections

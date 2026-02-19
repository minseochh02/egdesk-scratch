# Arduino Port Auto-Detection Fix

## Problem
The FinanceHub card automator scheduler was failing on macOS because it was using a hardcoded Windows port name (`COM3`) by default. This caused all card syncs to fail because the Arduino board couldn't be found.

## Root Cause
1. **Scheduler** was directly reading `financeHub.arduinoPort` from storage with a default of `COM3`
2. **No auto-detection** was performed before attempting to connect to the Arduino
3. **macOS uses different port naming** (e.g., `/dev/cu.usbserial-*`, `/dev/tty.usbmodem-*`) instead of Windows-style `COM` ports

## Solution
Added Arduino auto-detection in two places:

### 1. App Startup (main.ts)
- Auto-detects Arduino port 2 seconds after app launch
- Checks for common Arduino vendor IDs and USB-Serial chips:
  - `2341` - Official Arduino
  - `0403` - FTDI chips
  - `1a86` - CH340 chips (common in clones)
  - `10c4` - CP210x chips (Silicon Labs)
- Also checks for macOS path patterns (`usbserial`, `usbmodem`)
- Saves detected port to storage for future use
- Only updates storage if the detected port differs from current setting

**Location:** `/src/main/main.ts` ~line 4795

### 2. Scheduler Card Sync (FinanceHubScheduler.ts)
- Before creating card automator, performs Arduino auto-detection
- Specifically checks if running on macOS with a Windows-style port configured
- Falls back to stored port if auto-detection fails
- Logs warnings if no Arduino is detected but continues anyway

**Location:** `/src/main/financehub/scheduler/FinanceHubScheduler.ts` ~line 836-885

## Detection Logic
The auto-detection looks for Arduino boards by checking:

1. **Vendor IDs:**
   - `2341` - Arduino official VID
   - `0403` - FTDI USB-Serial chips
   - `1a86` - CH340 chips (common in Chinese clones)
   - `10c4` - CP210x chips (Silicon Labs)

2. **Path Patterns (macOS):**
   - Contains `usbserial`
   - Contains `usbmodem`

3. **Manufacturer String:**
   - Contains "arduino" (case-insensitive)

## Testing
After this fix:
1. ✅ Arduino port is auto-detected on app startup
2. ✅ Scheduler verifies Arduino port before each card sync
3. ✅ macOS port names are properly detected and used
4. ✅ Windows compatibility is maintained (no breaking changes)

## Manual Override
Users can still manually set the Arduino port through:
- FinanceHub UI → Arduino Settings
- The saved port in storage will be respected unless auto-detection finds a different port

## Logs
Look for these log messages:
- `✅ Auto-detected and saved Arduino on port: /dev/cu.usbserial-XXXXX`
- `⚠️  Detected macOS with Windows port (COM3), attempting auto-detection...`
- `⚠️  No Arduino detected. Available ports: ...`

## Related Files Modified
1. `/src/main/main.ts` - App startup auto-detection
2. `/src/main/financehub/scheduler/FinanceHubScheduler.ts` - Scheduler sync auto-detection

## Date Range Configuration (Bonus Finding)
While investigating, confirmed that:
- **Cards:** Fetch last 7 days of transactions (line 870-885)
- **Banks:** Fetch last 7 days of transactions (line 1044-1059)
- Originally was set to 1 day (yesterday only), updated to 7 days for better coverage

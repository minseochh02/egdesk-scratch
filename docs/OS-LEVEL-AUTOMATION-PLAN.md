# OS-Level Automation Plan for Playwright Recorder

**Document Version:** 1.0
**Date:** 2026-01-20
**Purpose:** Design and implementation plan for adding OS-level keyboard/mouse automation to handle native dialogs

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Use Cases](#use-cases)
4. [Library Options](#library-options)
5. [Recommended Solution](#recommended-solution)
6. [Implementation Plan](#implementation-plan)
7. [Platform-Specific Considerations](#platform-specific-considerations)
8. [Code Generation Strategy](#code-generation-strategy)
9. [Security & Safety](#security--safety)
10. [Limitations](#limitations)
11. [Testing Strategy](#testing-strategy)

---

## Overview

OS-level automation allows controlling the computer's keyboard and mouse at the operating system level, enabling interaction with native dialogs that are outside the browser's control (e.g., print dialogs, save-as dialogs).

### What Playwright CAN'T Do

Playwright operates **inside the browser context**. It cannot interact with:

- ❌ Native OS print dialogs
- ❌ Native OS save-as file dialogs
- ❌ Native OS authentication prompts
- ❌ System notifications
- ❌ Other applications' windows

### What OS-Level Automation CAN Do

By controlling the OS directly, we can:

- ✅ Press keys on native dialogs (Enter, Escape, Tab, etc.)
- ✅ Type text in native file pickers
- ✅ Click buttons in system dialogs
- ✅ Navigate between dialog elements

---

## Problem Statement

### Current Limitation

When recording automation scripts, users encounter native OS dialogs that cannot be automated:

**Example Scenario:**
```javascript
// User clicks a button that triggers print
await page.click('.print-button');

// Native print dialog opens (Playwright loses control)
// ⚠️ User must manually click "OK" - cannot be automated!

// Script hangs waiting for dialog to close
```

### Desired Behavior

```javascript
// User clicks a button that triggers print
await page.click('.print-button');

// Native print dialog opens
// ✅ OS-level automation detects dialog and presses Enter automatically

// Script continues execution
```

---

## Use Cases

### 1. Print Dialog Automation

**Scenario:** NH Card transaction history - user wants to print receipt

**Workflow:**
1. Click "Print Receipt" button on webpage
2. Native print dialog opens
3. **OS-level automation:** Press Enter to confirm print
4. Dialog closes, script continues

**Value:** Fully automated transaction receipt collection

### 2. Save As Dialog Automation

**Scenario:** Downloading exported data with custom filename

**Workflow:**
1. Click "Export CSV" button
2. Native "Save As" dialog opens
3. **OS-level automation:**
   - Type custom filename: `transactions-2026-01-20.csv`
   - Press Enter to save
4. File saved, script continues

**Value:** Automated file downloads with naming conventions

### 3. Certificate/Authentication Dialogs

**Scenario:** Accessing secured banking sites with client certificates

**Workflow:**
1. Navigate to secure banking site
2. Certificate selection dialog appears
3. **OS-level automation:** Press Enter to select default certificate
4. Page loads, script continues

**Value:** Automated login to certificate-protected sites

---

## Library Options

### Option 1: RobotJS

**Repository:** https://github.com/octalmage/robotjs

**Pros:**
- ✅ Mature and widely used
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Simple API
- ✅ Keyboard and mouse control
- ✅ Screen capture capabilities

**Cons:**
- ❌ Native dependencies (requires compilation)
- ❌ Installation can fail on some systems
- ❌ Not actively maintained (last update 2021)
- ❌ Can have issues with newer Node.js versions

**Example:**
```javascript
const robot = require('robotjs');

// Press Enter
robot.keyTap('enter');

// Type text
robot.typeString('filename.pdf');

// Click at coordinates
robot.moveMouse(100, 200);
robot.mouseClick();
```

### Option 2: nut.js

**Repository:** https://github.com/nut-tree/nut.js

**Pros:**
- ✅ Modern and actively maintained
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ TypeScript support
- ✅ Promise-based API (async/await friendly)
- ✅ Image recognition for finding elements
- ✅ Better prebuilt binaries support

**Cons:**
- ❌ Still requires native dependencies
- ❌ Larger package size
- ❌ Slightly more complex API

**Example:**
```javascript
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

// Press Enter
await keyboard.type(Key.Enter);

// Type text
await keyboard.type('filename.pdf');
```

### Option 3: Platform-Specific Solutions

#### Windows: node-win32-api
```javascript
const { user32 } = require('win32-api');
// Direct Windows API access
```

#### macOS: AppleScript via child_process
```javascript
const { exec } = require('child_process');
exec(`osascript -e 'tell application "System Events" to keystroke return'`);
```

#### Linux: xdotool via child_process
```javascript
const { exec } = require('child_process');
exec('xdotool key Return');
```

**Pros:**
- ✅ No native compilation needed
- ✅ More reliable on specific platforms
- ✅ Lighter weight

**Cons:**
- ❌ Not cross-platform
- ❌ Requires maintaining separate code for each OS
- ❌ External dependencies (xdotool, osascript)

---

## Recommended Solution

### Hybrid Approach: nut.js (Fork) + Platform Fallbacks

**Primary:** Use **@nut-tree-fork/nut-js** for cross-platform support
**Fallback:** Platform-specific solutions if nut.js fails to install

**Important Note:** The original `@nut-tree/nut-js` package is no longer maintained. We're using the community-maintained fork `@nut-tree-fork/nut-js` which is actively developed.

### Why nut.js (Fork)?

1. **Modern & Maintained** - Active development, regular updates (forked from original)
2. **TypeScript Support** - Better integration with our TypeScript codebase
3. **Async/Await** - Fits naturally with Playwright's async patterns
4. **Better Error Handling** - More robust than RobotJS
5. **Prebuilt Binaries** - Easier installation on most systems
6. **Community Support** - Active fork with bug fixes and improvements

### Installation Strategy

```json
{
  "dependencies": {
    "@nut-tree-fork/nut-js": "^3.1.1"
  },
  "optionalDependencies": {
    "@nut-tree-fork/nut-js": "^3.1.1"
  }
}
```

Making it optional prevents installation failures from breaking the entire app.

---

## Implementation Plan

### Phase 1: Detection & Recording

**Goal:** Detect when native dialogs appear and record the actions

#### Step 1.1: Detect Print Dialog
```typescript
// In setupInitScripts()
await this.context.addInitScript(() => {
  // Intercept window.print()
  const originalPrint = window.print.bind(window);
  window.print = function() {
    if ((window as any).__playwrightRecorderOnPrintDialogOpened) {
      (window as any).__playwrightRecorderOnPrintDialogOpened();
    }
    return originalPrint();
  };
});

// In injectKeyboardListener()
await this.page.exposeFunction('__playwrightRecorderOnPrintDialogOpened', async () => {
  this.actions.push({
    type: 'printDialog',
    action: 'opened',
    timestamp: Date.now() - this.startTime
  });
  this.updateGeneratedCode();
});
```

#### Step 1.2: Record Dialog Actions
```typescript
// Add new action types to RecordedAction interface
interface RecordedAction {
  type: '...' | 'printDialog' | 'saveDialog' | 'osKeypress';
  dialogType?: 'print' | 'save' | 'auth';
  action?: 'opened' | 'closed' | 'confirmed' | 'cancelled';
  osKey?: string; // e.g., 'Enter', 'Escape'
  filename?: string; // For save dialogs
  // ...
}
```

### Phase 2: OS-Level Automation Module

**File:** `src/main/utils/osAutomation.ts`

```typescript
import { keyboard, Key } from '@nut-tree-fork/nut-js';

export class OSAutomation {
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  /**
   * Check if OS automation is available
   */
  private async checkAvailability(): Promise<void> {
    try {
      await keyboard.type(Key.Null); // Test if library works
      this.isAvailable = true;
      console.log('✅ OS-level automation available');
    } catch (error) {
      this.isAvailable = false;
      console.warn('⚠️ OS-level automation not available:', error.message);
    }
  }

  /**
   * Press a key on the OS level
   */
  async pressKey(key: string, delayMs: number = 500): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('OS automation not available, skipping key press:', key);
      return false;
    }

    try {
      // Wait for dialog to fully appear
      await this.sleep(delayMs);

      // Map common keys
      const keyMap: Record<string, any> = {
        'Enter': Key.Enter,
        'Escape': Key.Escape,
        'Tab': Key.Tab,
        'Space': Key.Space,
        'Left': Key.Left,
        'Right': Key.Right,
        'Up': Key.Up,
        'Down': Key.Down,
      };

      const nutKey = keyMap[key] || Key[key];
      if (!nutKey) {
        throw new Error(`Unknown key: ${key}`);
      }

      await keyboard.type(nutKey);
      console.log(`✅ OS key pressed: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to press OS key:', error.message);
      return false;
    }
  }

  /**
   * Type text on the OS level
   */
  async typeText(text: string, delayMs: number = 500): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn('OS automation not available, skipping text input:', text);
      return false;
    }

    try {
      await this.sleep(delayMs);
      await keyboard.type(text);
      console.log(`✅ OS text typed: ${text}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to type text:', error.message);
      return false;
    }
  }

  /**
   * Handle print dialog
   * Default action: Press Enter to confirm print
   */
  async handlePrintDialog(action: 'confirm' | 'cancel' = 'confirm'): Promise<boolean> {
    console.log(`🖨️ Handling print dialog: ${action}`);
    const key = action === 'confirm' ? 'Enter' : 'Escape';
    return await this.pressKey(key, 1000); // Wait 1s for dialog to appear
  }

  /**
   * Handle save dialog
   */
  async handleSaveDialog(filename?: string): Promise<boolean> {
    console.log(`💾 Handling save dialog${filename ? ` with filename: ${filename}` : ''}`);

    if (filename) {
      // Type filename
      await this.typeText(filename, 1000);
      await this.sleep(200);
    }

    // Press Enter to save
    return await this.pressKey('Enter', 500);
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Phase 3: Integration with Recorder

**File:** `src/main/playwright-recorder.ts`

```typescript
import { OSAutomation } from './utils/osAutomation';

export class PlaywrightRecorder {
  private osAutomation: OSAutomation | null = null;

  async start(url: string, onBrowserClosed?: () => void): Promise<void> {
    // Initialize OS automation
    this.osAutomation = new OSAutomation();

    // ... existing code ...
  }

  // Expose function for print dialog
  await this.page.exposeFunction('__playwrightRecorderOnPrint', async () => {
    console.log('🖨️ Print action recorded');

    this.actions.push({
      type: 'print',
      timestamp: Date.now() - this.startTime
    });

    // Automatically handle print dialog if enabled
    if (this.osAutomation) {
      // Wait a bit for dialog to appear, then press Enter
      setTimeout(async () => {
        await this.osAutomation.handlePrintDialog('confirm');
      }, 1000);
    }

    this.updateGeneratedCode();
  });
}
```

### Phase 4: Code Generation

**Update:** `generateTestCode()` method

```typescript
case 'print':
  lines.push(`    // Print dialog triggered`);
  lines.push(`    await page.waitForTimeout(1000); // Wait for print dialog to appear`);
  lines.push(``);
  lines.push(`    // Handle native print dialog with OS-level automation`);
  lines.push(`    const { keyboard, Key } = require('@nut-tree-fork/nut-js');`);
  lines.push(`    await keyboard.type(Key.Enter); // Press Enter to confirm print`);
  lines.push(``);
  lines.push(`    // Alternative: Generate PDF without print dialog`);
  lines.push(`    // await page.pdf({ path: 'output.pdf', format: 'A4' });`);
  break;

case 'saveDialog':
  lines.push(`    // Save As dialog triggered`);
  if (action.filename) {
    lines.push(`    await page.waitForTimeout(1000); // Wait for dialog`);
    lines.push(`    const { keyboard, Key } = require('@nut-tree-fork/nut-js');`);
    lines.push(`    await keyboard.type('${action.filename}'); // Type filename`);
    lines.push(`    await keyboard.type(Key.Enter); // Confirm save`);
  } else {
    lines.push(`    await page.waitForTimeout(1000);`);
    lines.push(`    const { keyboard, Key } = require('@nut-tree-fork/nut-js');`);
    lines.push(`    await keyboard.type(Key.Enter); // Accept default filename`);
  }
  break;
```

---

## Platform-Specific Considerations

### Windows

**Challenges:**
- Multiple print dialog types (legacy vs. modern)
- Dialog focus timing can vary
- Windows Defender may flag OS automation as suspicious

**Solutions:**
- Increase wait time before key press (1-2 seconds)
- Add retry logic if first attempt fails
- Provide clear documentation about Windows Defender

### macOS

**Challenges:**
- Requires Accessibility permissions
- Gatekeeper may block nut.js
- Print dialog has complex layout (expand/collapse)

**Solutions:**
- Prompt user to grant Accessibility permissions on first run
- Sign the app to avoid Gatekeeper issues
- Use Tab navigation to reach Print button reliably

**Permission Check:**
```typescript
async checkMacAccessibility(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  try {
    const { exec } = require('child_process');
    const result = await exec('osascript -e "tell application \\"System Events\\" to keystroke \\"\\""');
    return true;
  } catch (error) {
    console.warn('⚠️ macOS Accessibility permission required');
    console.warn('Please grant permission in System Preferences > Security & Privacy > Accessibility');
    return false;
  }
}
```

### Linux

**Challenges:**
- Many different window managers (GNOME, KDE, XFCE, etc.)
- Different print dialog implementations
- May require xdotool installation

**Solutions:**
- Detect window manager and adjust timing
- Fallback to xdotool if nut.js fails
- Provide installation instructions for dependencies

---

## Code Generation Strategy

### Smart Code Generation

Generate code that:

1. **Checks for nut.js availability**
2. **Falls back gracefully if not available**
3. **Includes comments explaining the automation**
4. **Provides alternatives (like `page.pdf()` for print)**

**Example Generated Test:**

```javascript
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Try to load OS automation library
let osAutomation = null;
try {
  const nutjs = require('@nut-tree-fork/nut-js');
  osAutomation = {
    keyboard: nutjs.keyboard,
    Key: nutjs.Key
  };
  console.log('✅ OS-level automation available');
} catch (error) {
  console.warn('⚠️ OS-level automation not available. Native dialogs must be handled manually.');
}

(async () => {
  // ... browser setup ...

  // Click print button
  await page.click('[id="print-button"]');

  // Handle print dialog with OS automation
  if (osAutomation) {
    console.log('🖨️ Waiting for print dialog...');
    await page.waitForTimeout(1500); // Wait for dialog to appear
    await osAutomation.keyboard.type(osAutomation.Key.Enter); // Confirm print
    console.log('✅ Print dialog handled automatically');
  } else {
    console.log('⚠️ Please manually click OK on the print dialog');
    // Wait for user to manually handle dialog
    await page.waitForTimeout(10000);
  }

  // Alternative: Generate PDF without dialog
  // await page.pdf({ path: 'receipt.pdf', format: 'A4', printBackground: true });

  // ... rest of script ...
})().catch(console.error);
```

### Configuration Option

Add user preference for OS automation:

```typescript
interface RecorderSettings {
  enableOSAutomation: boolean; // Default: true
  osAutomationDelay: number; // Default: 1000ms
  printDialogAction: 'confirm' | 'cancel' | 'manual'; // Default: 'confirm'
}
```

---

## Security & Safety

### Security Concerns

**Risk:** OS-level automation can control the entire computer, not just the browser

**Mitigations:**

1. **Explicit User Consent**
   - Show warning on first use
   - Require opt-in for OS automation
   - Explain what permissions are needed

2. **Scope Limitation**
   - Only activate during recording session
   - Only respond to specific dialog events
   - Never run arbitrary commands

3. **Code Review**
   - All OS automation code is visible in generated scripts
   - Users can review before running
   - No hidden automation

### Safety Features

```typescript
class OSAutomation {
  private safetyChecks = {
    maxActionsPerMinute: 20, // Prevent runaway automation
    requireDialogContext: true, // Only act when dialog is expected
    confirmDestructiveActions: true, // Ask before dangerous operations
  };

  async pressKey(key: string): Promise<boolean> {
    // Safety check: Only allow whitelisted keys
    const safeKeys = ['Enter', 'Escape', 'Tab', 'Space', 'Left', 'Right', 'Up', 'Down'];
    if (!safeKeys.includes(key)) {
      console.warn('⚠️ Blocked unsafe key:', key);
      return false;
    }

    // Rate limiting
    if (this.actionsThisMinute > this.safetyChecks.maxActionsPerMinute) {
      console.warn('⚠️ Rate limit exceeded, pausing OS automation');
      return false;
    }

    // Proceed with key press
    // ...
  }
}
```

---

## Limitations

### What OS Automation CANNOT Do

1. **Cannot reliably find dialog buttons**
   - We can only press keys, not click specific buttons
   - Must rely on keyboard navigation (Tab, Enter, Escape)
   - Different dialogs have different layouts

2. **Platform-specific behavior**
   - Print dialog differs on Windows/Mac/Linux
   - Timing varies by system performance
   - May fail on VM or remote desktop

3. **User interruption**
   - If user moves mouse or presses key during automation, it may fail
   - Dialog might not have focus when key is pressed

4. **Complex dialogs**
   - Cannot handle multi-step dialogs reliably
   - Cannot select from dropdown menus in dialogs
   - Cannot handle conditional UI in dialogs

### When to Use vs. Not Use

**✅ Good Use Cases:**
- Confirming simple print dialogs (just press Enter)
- Accepting default save filename (just press Enter)
- Dismissing dialogs (press Escape)

**❌ Poor Use Cases:**
- Selecting specific printer from dropdown
- Navigating complex save dialog folder structures
- Configuring print settings (pages, copies, etc.)

---

## Testing Strategy

### Unit Tests

```typescript
describe('OSAutomation', () => {
  it('should detect if nut.js is available', async () => {
    const osAuto = new OSAutomation();
    expect(osAuto.isAvailable).toBeDefined();
  });

  it('should press Enter key', async () => {
    const osAuto = new OSAutomation();
    const result = await osAuto.pressKey('Enter', 100);
    expect(result).toBe(true);
  });

  it('should handle print dialog', async () => {
    const osAuto = new OSAutomation();
    const result = await osAuto.handlePrintDialog('confirm');
    expect(result).toBe(true);
  });
});
```

### Integration Tests

**Test Scenario 1: Print Dialog**
```typescript
test('should handle print dialog automatically', async () => {
  const recorder = new PlaywrightRecorder();
  await recorder.start('https://example.com');

  // Trigger print
  await recorder.page.evaluate(() => window.print());

  // OS automation should press Enter automatically
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify print action was recorded
  const actions = recorder.getActions();
  expect(actions.some(a => a.type === 'print')).toBe(true);
});
```

**Test Scenario 2: Cross-Platform**
```typescript
test('should work on current platform', async () => {
  const osAuto = new OSAutomation();

  if (process.platform === 'win32') {
    // Test Windows-specific behavior
    expect(await osAuto.pressKey('Enter', 1500)).toBe(true);
  } else if (process.platform === 'darwin') {
    // Test macOS-specific behavior
    const hasPermission = await osAuto.checkMacAccessibility();
    expect(hasPermission).toBe(true);
  } else {
    // Test Linux-specific behavior
    expect(await osAuto.pressKey('Enter', 1000)).toBe(true);
  }
});
```

### Manual Testing Checklist

- [ ] Windows: Print dialog with Chrome
- [ ] Windows: Print dialog with Edge
- [ ] macOS: Print dialog with Chrome
- [ ] macOS: Print dialog with Safari
- [ ] Linux: Print dialog with Chrome
- [ ] Linux: Print dialog with Firefox
- [ ] Save As dialog (all platforms)
- [ ] Certificate selection dialog
- [ ] Error handling when nut.js not installed
- [ ] Graceful fallback when dialog doesn't appear

---

## Next Steps

### Phase 1: Foundation (Week 1)
- [ ] Install and test nut.js on all platforms
- [ ] Create `osAutomation.ts` module
- [ ] Add unit tests
- [ ] Document platform-specific issues

### Phase 2: Recorder Integration (Week 2)
- [ ] Add OS automation to PlaywrightRecorder class
- [ ] Update action types and interfaces
- [ ] Implement print dialog detection
- [ ] Test print dialog automation

### Phase 3: Code Generation (Week 3)
- [ ] Update `generateTestCode()` for print/save dialogs
- [ ] Add smart fallback code generation
- [ ] Create example generated scripts
- [ ] Test generated scripts on all platforms

### Phase 4: UI & Settings (Week 4)
- [ ] Add OS automation toggle in settings
- [ ] Create permission request UI (macOS)
- [ ] Add installation instructions for missing dependencies
- [ ] User documentation

### Phase 5: Testing & Refinement (Week 5)
- [ ] Cross-platform testing
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User feedback collection

---

## Success Criteria

✅ **Must Have:**
- Print dialog automation works on Windows/Mac/Linux
- Graceful fallback when nut.js not available
- Generated code is readable and maintainable
- No security vulnerabilities introduced

✅ **Should Have:**
- Save dialog automation works
- Clear user feedback about automation status
- Settings to enable/disable OS automation
- Documentation for troubleshooting

✅ **Nice to Have:**
- Visual indicator when OS automation is active
- Retry logic for failed automations
- Platform-specific optimizations
- Advanced dialog handling (custom filenames, printer selection)

---

## Conclusion

OS-level automation will significantly enhance the Playwright recorder's capabilities by enabling full automation of workflows that include native dialogs. By using nut.js with platform-specific fallbacks, we can provide a robust cross-platform solution while maintaining security and user control.

The hybrid approach (nut.js + fallbacks + optional installation) ensures maximum compatibility while keeping the feature accessible to all users.

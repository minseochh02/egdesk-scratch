# Enhanced Popup Detection System

## Overview

The Enhanced Popup Detection System provides automatic detection and handling of common Korean banking/card website popups. This system is built into `BaseCardAutomator` and available to all card company automators.

## Features

✅ **Automatic Detection**: Identifies common popup patterns across Korean financial sites
✅ **Frame-Aware**: Checks both main page and iframes for popups
✅ **Background Monitoring**: Continuous popup checking during long operations
✅ **Priority Handling**: Session extension popups are handled with high priority
✅ **Non-Blocking**: Failures in popup detection don't crash the automation
✅ **Extensible**: Easy to add new popup patterns as discovered

## Supported Popup Types

### 1. Session Extension Popups (HIGH PRIORITY)
- "연장" (Extend)
- "세션연장" (Session Extension)
- "계속" (Continue)
- "예" (Yes)

### 2. Security/Certificate Notices
- "확인" (Confirm)
- "닫기" (Close)
- Close buttons with classes like `.close`, `.btn-close`

### 3. Terms/Agreement Popups
- "동의" (Agree)
- "동의하고 계속" (Agree and Continue)
- Automatically checks required checkboxes

### 4. Event/Promotion Popups
- "오늘 하루 보지 않기" (Don't show today)
- "오늘 하루 열지 않기" (Don't open today)
- "다시 보지 않기" (Don't show again)

### 5. Alert Dialogs
- JavaScript `alert()`, `confirm()` dialogs
- Modal alerts with "확인" buttons

## Usage

### Basic Usage (Shinhan Card Example)

The Shinhan Card automator now uses enhanced popup detection:

```javascript
// After page navigation
await this.detectAndHandlePopups(this.page);

// During login flow
await this.page.goto(url);
await this.detectAndHandlePopups(this.page);

// Start monitoring for long operations
await this.startPopupMonitoring(this.page);

// Stop monitoring when done
await this.stopPopupMonitoring();
```

### Integration Points in Shinhan Card

1. **After page load** (line ~145): Check for initial popups
2. **After login** (line ~200): Handle post-login popups
3. **During login** (line ~207): Start background monitoring
4. **Before navigation** (line ~277, ~408): Pre-check for blocking popups
5. **After navigation** (line ~421): Post-navigation popup check
6. **During cleanup** (line ~238): Stop monitoring properly

## Extending to Other Card Automators

### Step 1: Add Popup Detection After Page Loads

```javascript
async login(credentials, proxyUrl) {
  await this.page.goto(loginUrl);

  // Add this line
  await this.detectAndHandlePopups(this.page);

  // Continue with login...
}
```

### Step 2: Add Popup Detection After Login

```javascript
// After clicking login button
await this.clickElement(loginButton);
await this.page.waitForTimeout(2000);

// Add this line
await this.detectAndHandlePopups(this.page);
```

### Step 3: Start Background Monitoring

```javascript
// After successful login
await this.startPopupMonitoring(this.page);

// The monitoring will continue until stopped or browser closes
```

### Step 4: Override Cleanup Method

```javascript
/**
 * Override cleanup to stop popup monitoring
 */
async cleanup() {
  await this.stopPopupMonitoring();
  await super.cleanup();
}
```

### Step 5: Add Detection During Navigation

```javascript
async navigateToTransactions() {
  // Before navigation
  await this.detectAndHandlePopups(this.page);

  await this.page.goto(transactionUrl);

  // After navigation
  await this.detectAndHandlePopups(this.page);
}
```

## API Reference

### `detectAndHandlePopups(page, options)`

Detects and handles popups on the current page and frames.

**Parameters:**
- `page` (Object): Playwright page object
- `options` (Object): Optional configuration
  - `timeout` (number): Timeout for each selector check (default: 2000ms)
  - `continueOnFail` (boolean): Continue if error occurs (default: true)
  - `logDetection` (boolean): Log detected popups (default: true)

**Returns:** `Promise<{detected: boolean, handled: boolean, popups: Array}>`

**Example:**
```javascript
const result = await this.detectAndHandlePopups(this.page, {
  timeout: 3000,
  logDetection: true
});

console.log(`Detected: ${result.detected}`);
console.log(`Handled: ${result.handled}`);
console.log(`Popups: ${result.popups.length}`);
```

### `startPopupMonitoring(page, intervalMs)`

Starts continuous background popup monitoring.

**Parameters:**
- `page` (Object): Playwright page object
- `intervalMs` (number): Check interval in milliseconds (default: 3000)

**Example:**
```javascript
// Check every 5 seconds
await this.startPopupMonitoring(this.page, 5000);
```

### `stopPopupMonitoring()`

Stops continuous popup monitoring.

**Example:**
```javascript
await this.stopPopupMonitoring();
```

### `tryHandlePopup(pageOrFrame, pattern, timeout)`

Low-level method to handle a specific popup pattern.

**Parameters:**
- `pageOrFrame` (Object): Playwright page or frame
- `pattern` (Object): Popup pattern with type and selectors
- `timeout` (number): Timeout for operations

**Returns:** `Promise<{handled: boolean, type?: string, selector?: string}>`

## Adding Custom Popup Patterns

If you encounter new popup types, add them to the `POPUP_PATTERNS` array in `BaseCardAutomator.js`:

```javascript
const POPUP_PATTERNS = [
  // ... existing patterns ...

  // Your custom pattern
  {
    type: 'custom-popup',
    selectors: [
      '//button[contains(text(), "커스텀버튼")]',
      '//a[@id="custom-close"]',
    ],
    priority: 'high', // Optional
    requiresCheckbox: false, // Optional
  }
];
```

## Testing

Test the popup detection system:

```bash
# Full automation test
node src/main/financehub/cards/shinhan-card/tests/test-popup-detection.js 1

# Manual detection test
node src/main/financehub/cards/shinhan-card/tests/test-popup-detection.js 2
```

Set environment variables for testing:
```bash
export SHINHAN_CARD_USER_ID="your-user-id"
export SHINHAN_CARD_PASSWORD="your-password"
```

## Rollout Plan for Other Card Companies

### Immediate Rollout (High Priority)
1. ✅ **Shinhan Card** - COMPLETED
2. **Hana Card** - Similar structure to Shinhan
3. **KB Card** - High usage, benefits from monitoring

### Phase 2 (Medium Priority)
4. **Samsung Card**
5. **Hyundai Card**
6. **NH Card**

### Phase 3 (Lower Priority)
7. **Lotte Card**
8. **BC Card**

## Benefits

### Before Enhanced Popup Detection
- Popups would block automation silently
- Session timeouts went unnoticed
- Manual intervention required frequently
- Inconsistent success rates

### After Enhanced Popup Detection
- ✅ Automatic handling of common popups
- ✅ Session extension popups handled immediately
- ✅ Reduced automation failures
- ✅ Better logging for debugging
- ✅ Higher success rates across all card companies

## Debugging

Enable detailed logging:

```javascript
const automator = new ShinhanCardAutomator({
  headless: false, // Keep browser visible
  manualPassword: true, // For manual testing
});

// Popup detection will log all detected popups
await automator.detectAndHandlePopups(automator.page, {
  logDetection: true
});
```

Look for log messages like:
```
✓ Handled security-notice popup
✓ Handled session-extension popup in frame: popupFrame
```

## Troubleshooting

### Problem: Popup not detected

**Solution 1:** Add the popup's XPath to the pattern list
```javascript
// Find the XPath in browser DevTools
// Right-click element → Copy → Copy XPath
'//button[@id="your-button-id"]'
```

**Solution 2:** Increase timeout
```javascript
await this.detectAndHandlePopups(this.page, { timeout: 5000 });
```

### Problem: Monitoring causing performance issues

**Solution:** Increase monitoring interval
```javascript
// Check every 10 seconds instead of 3
await this.startPopupMonitoring(this.page, 10000);
```

### Problem: Popup in iframe not detected

**Solution:** Check if iframe is in the frames list
```javascript
const frames = this.page.frames();
frames.forEach(f => console.log('Frame:', f.name(), f.url()));
```

## Performance Considerations

- Popup detection adds ~2-3 seconds to automation flow
- Background monitoring uses minimal resources (1 check per 3 seconds)
- Non-blocking design ensures failures don't crash automation
- Frame checking is optimized (skips main frame when checking iframes)

## Future Improvements

1. **Machine Learning**: Auto-detect popup patterns using ML
2. **Screenshot Analysis**: Use Gemini Vision for unknown popups
3. **Pattern Learning**: Auto-add new patterns based on failures
4. **Telemetry**: Track which popup types are most common
5. **A/B Testing**: Compare success rates with/without monitoring

## Questions?

Contact the FinanceHub team or refer to:
- `BaseCardAutomator.js:169-378` - Implementation
- `ShinhanCardAutomator.js` - Integration example
- `test-popup-detection.js` - Test examples

# Virtual Keyboard Click Comparison: Test Script vs NH Bank vs Shinhan Bank

## Overview
This document compares how the test script, NH Bank automator, and Shinhan Bank automator (✅ working) handle virtual keyboard clicking, specifically focusing on the SHIFT key issue.

## Key Differences

### 1. Page Navigation and Setup

| Aspect | Test Script | NH Bank Automator | Shinhan Bank (✅ Working) |
|--------|-------------|-------------------|---------------------------|
| URL | NH Bank URL | Same | Shinhan Bank URL |
| Login Flow | Direct - clicks fields directly | Through `performLogin()` method | Through `performLogin()` method |
| Password Field Click | `await passwordField.click()` | `await passwordField.click()` | `await this.clickButton('passwordInput')` |
| Wait After Click | 2000ms | 1000ms | Uses config delays |

### 2. Finding Keyboard Element

**Test Script (lines 45-59):**
```javascript
for (const selector of keyboardSelectors) {
  const element = page.locator(`xpath=${selector}`);
  if (await element.isVisible({ timeout: 1000 })) {
    console.log(`[TEST] Found keyboard with selector: ${selector}`);
    keyboardFound = true;
    
    // Get keyboard bounds
    const bounds = await element.boundingBox();
    console.log('[TEST] Keyboard bounds:', bounds);
    break;
  }
}
```

**NH Bank Automator (lines 118-137):**
```javascript
for (const selector of lowerKeyboardSelectors) {
  try {
    const element = page.locator(`xpath=${selector}`);
    if (await element.isVisible({ timeout: 1000 })) {
      lowerKeyboardElement = element;
      lowerKeyboard = { locator: element, selector };
      this.log(`Found LOWER keyboard with selector: ${selector}`);
      break;
    }
  } catch (e) {
    // Try next selector
  }
}
// ...
const lowerKeyboardBox = await lowerKeyboardElement.boundingBox();
```

**Shinhan Bank Automator (✅ WORKING - lines 101-113):**
```javascript
// Uses utility function
const lowerKeyboard = await findVisibleKeyboard(
  page,
  getLowerKeyboardSelectors(),
  'LOWER',
  this.log.bind(this)
);

// findVisibleKeyboard implementation:
for (const selector of selectors) {
  const locator = page.locator(`xpath=${selector}`);
  const count = await locator.count();
  
  if (count > 0) {
    const isVisible = await locator.first().isVisible().catch(() => false);
    if (isVisible) {
      return { locator: locator.first(), selector: selector };
    }
  }
}

// CRITICAL DIFFERENCE: Uses getElementBox instead of boundingBox
const lowerKeyboardBox = await this.getElementBox(page, `xpath=${lowerKeyboard.selector}`);
```

**Key Observations:**
- Test Script & NH Bank: Use `element.isVisible({ timeout: 1000 })`
- Shinhan Bank: Uses `locator.count()` first, then `isVisible()` without timeout
- Test Script & NH Bank: Use `boundingBox()` directly
- **Shinhan Bank: Uses `getElementBox()` which includes `scrollIntoViewIfNeeded()`**

### 2.1 Keyboard Bounds Retrieval

| Aspect | Test Script | NH Bank Automator | Shinhan Bank (✅ Working) |
|--------|-------------|-------------------|---------------------------|
| Method | `await element.boundingBox()` | `await lowerKeyboardElement.boundingBox()` | `await this.getElementBox()` |
| Element Variable | `element` (local to loop) | `lowerKeyboardElement` (stored outside loop) | `lowerKeyboard` (object with locator & selector) |
| When Called | Inside the selector loop | After the selector loop | After the selector loop |
| Scrolling | **NO scrolling** | **NO explicit scrolling** | **YES - scrollIntoViewIfNeeded()** |
| Additional Wait | None | None | 500ms after scroll |

### 3. SHIFT Key Detection

| Aspect | Test Script | NH Bank Automator | Shinhan Bank (✅ Working) |
|--------|-------------|-------------------|---------------------------|
| SHIFT Detection | Hard-coded position (1394, 764) | AI-detected via Gemini Vision API | AI-detected via Gemini Vision API |
| Coordinate System | Absolute page coordinates | Absolute page coordinates (bounds.x + centroidX) | Absolute page coordinates (bounds.x + centroidX) |
| Coordinate Calculation | N/A - hardcoded | After `boundingBox()` | After `getElementBox()` with scroll |

### 4. SHIFT Click Implementation

**Test Script:**
```javascript
const shiftX = 1394;
const shiftY = 764;
await page.mouse.move(shiftX, shiftY);
await page.waitForTimeout(300);
await page.mouse.click(shiftX, shiftY);
```

**NH Bank Automator:**
```javascript
await page.mouse.move(shiftData.position.x, shiftData.position.y);
await page.waitForTimeout(this.config.delays.mouseMove || 300);
await page.mouse.click(shiftData.position.x, shiftData.position.y);
await page.waitForTimeout(this.config.delays.keyboardUpdate || 1000);
```

**Shinhan Bank Automator (✅ WORKING):**
```javascript
await page.mouse.move(shiftData.position.x, shiftData.position.y);
await page.waitForTimeout(this.config.delays.mouseMove);  // 100ms
await page.mouse.click(shiftData.position.x, shiftData.position.y);
await page.waitForTimeout(this.config.delays.keyboardUpdate);  // 500ms
```

### 5. Critical Difference: Scrolling Behavior

**The Issue:** Even though both use `boundingBox()`, scrolling still happens:

1. **Test Script Flow:**
   - Click password field → Virtual keyboard appears → Browser auto-scrolls to show keyboard
   - Get keyboard bounds AFTER scroll completed
   - Click SHIFT with coordinates relative to scrolled position
   - ✅ **Works because coordinates match the scrolled viewport**

2. **NH Bank Automator Flow:**
   - Click password field → Virtual keyboard appears → Browser auto-scrolls to show keyboard
   - Get keyboard bounds
   - Take screenshot for AI analysis
   - AI analyzes screenshot and returns coordinates
   - Time passes during AI analysis...
   - Click SHIFT with coordinates that might be stale
   - ❌ **Fails if any additional scrolling or viewport changes occurred**

### 6. Timing Differences

| Step | Test Script | NH Bank Automator |
|------|-------------|-------------------|
| After password field click | 2000ms wait | 1000ms wait |
| Finding keyboard | Immediate check | Loop with 1000ms timeout per selector |
| Before SHIFT click | 300ms | 300ms |
| After SHIFT click | 1000ms | 1000ms |

## Root Cause Analysis

### Why Each Implementation Works/Fails:

1. **Test Script (✅ Works)**
   - No scrolling during keyboard finding
   - Uses hardcoded coordinates that match the non-scrolled viewport
   - Clicks immediately without delay

2. **Shinhan Bank (✅ Works)**
   - Uses `getElementBox()` which **explicitly scrolls the keyboard into view**
   - Waits 500ms after scroll for stability
   - AI analyzes keyboard **after** scrolling is complete
   - Coordinates are calculated relative to the **scrolled position**
   - All subsequent clicks use coordinates relative to this stable, scrolled position

3. **NH Bank (❌ Fails)**
   - Uses `boundingBox()` without explicit scrolling
   - Browser auto-scrolls when password field is clicked
   - Gets bounds in one viewport position
   - AI analyzes and calculates coordinates
   - By the time of SHIFT click, viewport may have changed
   - Coordinates become stale/incorrect

### The Key Insight:

**Shinhan Bank works because it controls the scrolling**:
1. It explicitly scrolls the keyboard into view with `scrollIntoViewIfNeeded()`
2. Waits for scroll to complete (500ms)
3. Then gets bounds and calculates all coordinates relative to this stable position

**NH Bank fails because scrolling happens unpredictably**:
1. Browser auto-scrolls when needed
2. No explicit control over when/how scrolling happens
3. Coordinates calculated at one point may be invalid later

## Potential Solutions for NH Bank

1. **Use `getElementBox()` like Shinhan** - This ensures consistent scrolling behavior
2. **Re-get bounds before clicking** - Get fresh keyboard bounds right before clicking SHIFT
3. **Add viewport stabilization** - Wait longer after password click for auto-scroll to complete
4. **Force scroll position** - Explicitly scroll keyboard to a known position before analysis

## Conclusion

The fundamental difference is that Shinhan Bank **controls and waits for scrolling**, while NH Bank relies on unpredictable browser auto-scrolling. The test script works because it uses pre-calculated coordinates that happen to match the final viewport position.
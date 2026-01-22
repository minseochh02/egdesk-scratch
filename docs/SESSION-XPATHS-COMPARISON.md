# Session Management XPaths - All Banks Comparison

**Generated**: 2026-01-19

---

## 📋 Overview

All banks use session management to keep users logged in by periodically clicking an "Extend" (연장) button. The XPaths differ per bank based on their website structure.

---

## 🏦 Bank-by-Bank XPath Configuration

### 1. Shinhan Bank (신한은행)

**Location**: `banks/shinhan/config.js`

```javascript
xpaths: {
  // Session management
  timerGroup: '//div[@id="grp_timer" and contains(@class, "time")]',
  extendSessionButton: '//div[@id="grp_timer"]//a[contains(text(), "연장")]',
}
```

**Analysis**:
- **Timer Display**: Specific ID `grp_timer` with class `time`
- **Extend Button**: Link (`<a>`) inside timer group with text "연장"
- **Specificity**: High (uses specific IDs)
- **Fallback**: None (single XPath)

---

### 2. Kookmin Bank (KB국민은행)

**Location**: `banks/kookmin/config.js`

```javascript
xpaths: {
  // Session management
  timerGroup: '//div[contains(@class, "timer")] | //div[contains(@class, "session")]',
  extendSessionButton: '//button[contains(text(), "연장")] | //a[contains(text(), "연장")]',
}
```

**Analysis**:
- **Timer Display**: Class-based search for "timer" or "session"
- **Extend Button**: Accepts both `<button>` and `<a>` elements with "연장" text
- **Specificity**: Medium (uses class names)
- **Fallback**: Multiple selectors with `|` (OR operator)

---

### 3. NH Bank Personal (NH농협은행)

**Location**: `banks/nh/config.js`

```javascript
xpaths: {
  // Session management
  extendSessionButton: '//a[contains(@href, "continueLogin") and .//span[contains(text(), "연장")]] | //button[contains(text(), "연장")]',
}
```

**Analysis**:
- **Timer Display**: Not explicitly defined
- **Extend Button**:
  - Primary: `<a>` with href containing "continueLogin" AND nested `<span>` with "연장"
  - Fallback: Any `<button>` with "연장" text
- **Specificity**: High for primary, medium for fallback
- **Fallback**: 2 selectors with `|` (OR operator)
- **Note**: Most complex selector (checks href AND nested span)

---

### 4. NH Business Bank (NH농협은행 법인)

**Location**: `banks/nh-business/config.js`

```javascript
xpaths: {
  // ⚠️ NO SESSION MANAGEMENT XPATHS DEFINED
}
```

**Analysis**:
- **Status**: ❌ Not configured
- **Reason**: NH Business uses certificate-based auth with different session handling
- **Impact**: Cannot use inherited `extendSession()` without adding XPath
- **Recommendation**: Add if NH Business has session extension feature

---

## 📊 XPath Comparison Table

| Bank | Timer Group XPath | Extend Button XPath | Element Type | Fallback |
|------|------------------|-------------------|--------------|----------|
| **Shinhan** | `//div[@id="grp_timer" and contains(@class, "time")]` | `//div[@id="grp_timer"]//a[contains(text(), "연장")]` | `<a>` link | ❌ None |
| **Kookmin** | `//div[contains(@class, "timer")] \| //div[contains(@class, "session")]` | `//button[contains(text(), "연장")] \| //a[contains(text(), "연장")]` | `<button>` or `<a>` | ✅ Yes |
| **NH** | Not defined | `//a[contains(@href, "continueLogin") and .//span[contains(text(), "연장")]] \| //button[contains(text(), "연장")]` | `<a>` or `<button>` | ✅ Yes |
| **NH Business** | Not defined | ❌ Not defined | - | - |

---

## 🔍 XPath Analysis

### Selector Strategies

#### Shinhan: ID-Based (Most Specific)
```xpath
//div[@id="grp_timer"]//a[contains(text(), "연장")]
```
- ✅ **Pro**: Very specific, unlikely to break
- ✅ **Pro**: Fast (ID lookup)
- ❌ **Con**: No fallback (fails if ID changes)

**HTML Structure**:
```html
<div id="grp_timer" class="time">
  <a href="#" onclick="extend()">연장</a>
</div>
```

---

#### Kookmin: Class-Based with OR Fallback (Flexible)
```xpath
//button[contains(text(), "연장")] | //a[contains(text(), "연장")]
```
- ✅ **Pro**: Multiple fallbacks
- ✅ **Pro**: Works with both button and link
- ⚠️ **Con**: Less specific (might match wrong elements)

**HTML Structure**:
```html
<div class="timer">
  <button onclick="extend()">연장</button>
</div>
<!-- OR -->
<div class="session">
  <a href="#" onclick="extend()">연장</a>
</div>
```

---

#### NH: Complex Condition with Fallback (Most Robust)
```xpath
//a[contains(@href, "continueLogin") and .//span[contains(text(), "연장")]] | //button[contains(text(), "연장")]
```
- ✅ **Pro**: Very specific primary selector
- ✅ **Pro**: Checks both href and nested span
- ✅ **Pro**: Has simple fallback
- ⚠️ **Con**: Complex to maintain

**HTML Structure**:
```html
<a href="javascript:continueLogin()">
  <span>연장</span>
</a>
<!-- OR fallback -->
<button>연장</button>
```

---

## 🎯 Best Practices Observed

### Common Patterns

1. **Text-based matching**: All use `contains(text(), "연장")`
   - Reliable across Korean banking sites
   - "연장" means "Extend" in Korean

2. **Multiple element types**: Most support both `<button>` and `<a>`
   - Flexible across different HTML structures
   - Uses XPath `|` (OR) operator

3. **Progressive specificity**:
   - Primary selector: Very specific (ID, href, nested elements)
   - Fallback selector: Simple text match

### Reliability Ranking

| Bank | Reliability | Reason |
|------|-------------|--------|
| **Shinhan** | ⭐⭐⭐⭐ | ID-based, very stable |
| **NH** | ⭐⭐⭐⭐⭐ | Complex primary + simple fallback |
| **Kookmin** | ⭐⭐⭐ | Class-based, might be fragile |

---

## 🔧 Session Management Flow

### How It Works (Shared Implementation)

All banks use the same code in `BaseBankAutomator`:

```javascript
async extendSession() {
  if (!this.page) return false;

  this.log('Attempting to extend session...');
  try {
    // Use bank-specific XPath from config
    const extendButtonXPath = `xpath=${this.config.xpaths.extendSessionButton}`;

    // Check if button is visible
    const isVisible = await this.page.locator(extendButtonXPath)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      // Click using robust clickButton method (has force/JS fallbacks)
      await this.clickButton(this.page, this.config.xpaths.extendSessionButton, 'Session extension (연장)');
      this.log('Session extension button clicked successfully');
      return true;
    }

    this.warn('Session extension button not visible');
    return false;
  } catch (error) {
    this.error('Error during session extension:', error.message);
    return false;
  }
}
```

**Key Points**:
- ✅ XPath loaded from bank config (bank-specific)
- ✅ Checks visibility before clicking
- ✅ Uses `clickButton()` with fallbacks (force click, JS click)
- ✅ Handles errors gracefully
- ✅ Returns success status

---

## 🚀 Adding Session Management to NH Business

NH Business currently doesn't have session XPaths configured. To add:

### Option 1: If NH Business Has Extend Button

```javascript
// Add to banks/nh-business/config.js
xpaths: {
  // ... existing xpaths

  // Session management
  extendSessionButton: '//button[contains(text(), "연장")] | //a[contains(text(), "연장")]',
}
```

Then use:
```javascript
// In NHBusinessBankAutomator.login()
if (loginResult.success) {
  this.startSessionKeepAlive();  // Now works!
}
```

### Option 2: If NH Business Uses Certificate Timeout

Some certificate-based systems don't have session extension. In that case:
- Leave XPath undefined
- Don't call `startSessionKeepAlive()`
- Session will timeout based on certificate validity period

---

## 📝 Configuration Template

For adding session management to any new bank:

```javascript
// In banks/[bank-name]/config.js
const BANK_CONFIG = {
  xpaths: {
    // ... other xpaths

    // Session management (optional but recommended)
    timerGroup: '//div[contains(@class, "timer")]',  // Optional: Timer display element
    extendSessionButton: '//button[contains(text(), "연장")] | //a[contains(text(), "연장")]',  // Required
  }
};
```

**Finding the XPath**:
1. Log into bank website
2. Wait for session timer to appear
3. Right-click "연장" (Extend) button
4. Inspect element
5. Copy XPath or create custom selector
6. Test with `$x("your-xpath")` in browser console

---

## 🧪 Testing XPaths

### Browser Console Test

```javascript
// In bank's website (while logged in):

// Test timer group visibility
$x('//div[@id="grp_timer"]').length > 0  // Should return true

// Test extend button visibility
$x('//div[@id="grp_timer"]//a[contains(text(), "연장")]').length > 0  // Should return true

// Click test (don't actually run, just verify selector works)
$x('//div[@id="grp_timer"]//a[contains(text(), "연장")]')[0]  // Should return element
```

### Playwright Test

```javascript
// In automation code
const extendButton = page.locator(`xpath=${config.xpaths.extendSessionButton}`);
const isVisible = await extendButton.isVisible({ timeout: 5000 });
console.log('Extend button visible:', isVisible);  // Should be true
```

---

## 🎯 Recommendations

### For Existing Banks

**Shinhan**: ✅ Well configured
- ID-based selectors are stable
- No changes needed

**Kookmin**: ⚠️ Consider improving
- Current: Class-based selectors (might be fragile)
- Recommendation: Add ID-based selector if available:
  ```javascript
  extendSessionButton: '//button[@id="extend_session"] | //button[contains(text(), "연장")] | //a[contains(text(), "연장")]'
  ```

**NH**: ✅ Well configured
- Complex primary selector with strong fallback
- No changes needed

**NH Business**: ❌ Missing
- **Action needed**: Determine if session extension exists
- If yes: Add `extendSessionButton` XPath
- If no: Document that sessions are certificate-based

---

### For New Banks

**Recommended XPath pattern**:

```javascript
extendSessionButton:
  '//button[@id="extend_btn"] | ' +           // Try ID first (most specific)
  '//a[@id="session_extend"] | ' +            // Try ID for link
  '//button[contains(text(), "연장")] | ' +   // Fallback: button with text
  '//a[contains(text(), "연장")]'              // Fallback: link with text
```

**Priority**:
1. ID selectors (most stable)
2. Text-based selectors (reliable fallback)
3. Class selectors (use carefully)

---

## 📊 Summary Table

| Bank | Has Timer Group | Has Extend Button | Selector Type | Fallback Strategy | Status |
|------|----------------|-------------------|---------------|------------------|--------|
| **Shinhan** | ✅ Yes | ✅ Yes | ID-based | ❌ None | ✅ Working |
| **Kookmin** | ✅ Yes | ✅ Yes | Class-based | ✅ Multiple | ✅ Working |
| **NH** | ❌ No | ✅ Yes | Href + nested span | ✅ Simple | ✅ Working |
| **NH Business** | ❌ No | ❌ Not defined | - | - | ⚠️ Missing |

---

## 🔍 XPath Syntax Reference

### Common XPath Patterns Used

```xpath
// ID selector (exact match)
//div[@id="grp_timer"]

// ID with class condition
//div[@id="grp_timer" and contains(@class, "time")]

// Class contains (partial match)
//div[contains(@class, "timer")]

// Text contains
//a[contains(text(), "연장")]

// Href contains
//a[contains(@href, "continueLogin")]

// Nested element (.// means relative to current node)
//a[.//span[contains(text(), "연장")]]

// Multiple conditions (AND)
//a[contains(@href, "continueLogin") and .//span[contains(text(), "연장")]]

// Multiple selectors (OR)
//button[contains(text(), "연장")] | //a[contains(text(), "연장")]
```

---

## 🎯 Key Takeaways

### What's Consistent

✅ All banks use **"연장" (Extend)** as button text
✅ All accept either `<button>` or `<a>` elements
✅ All check visibility before clicking (in base implementation)

### What's Different

⚠️ **HTML structure** varies by bank:
- Shinhan: Link inside timer div
- Kookmin: Button OR link with class-based container
- NH: Link with href + nested span

⚠️ **Selector specificity**:
- Shinhan: Very specific (ID-based)
- Kookmin: Flexible (class + text)
- NH: Complex (multiple conditions)

### Best Practice

Use **progressive specificity** with fallbacks:
```javascript
extendSessionButton:
  '//button[@id="specific_id"] | ' +           // Try specific ID first
  '//button[contains(text(), "연장")] | ' +    // Fallback to text
  '//a[contains(text(), "연장")]'              // Fallback to link
```

This ensures:
1. ✅ Fast lookup (ID first)
2. ✅ Reliability (fallbacks if structure changes)
3. ✅ Maintainability (clear priority order)

---

## 💡 How to Find Session XPaths

### Step-by-Step Guide

1. **Log into bank website manually**
2. **Wait for session timer to appear** (usually 3-10 minutes after login)
3. **Locate the extend button**:
   - Look for "연장" (Extend) or "시간연장" (Extend Time)
   - Usually near a countdown timer
   - Might be in header, footer, or popup

4. **Inspect the element**:
   - Right-click → Inspect
   - Note the element type (`<button>`, `<a>`, etc.)
   - Note any IDs or classes
   - Check for parent containers

5. **Test XPath in console**:
   ```javascript
   $x('//button[contains(text(), "연장")]')  // Should return [element]
   ```

6. **Create progressive selector**:
   ```javascript
   extendSessionButton: '//button[@id="..."] | //button[contains(text(), "연장")]'
   ```

7. **Test in automation**:
   ```javascript
   const btn = page.locator(`xpath=${config.xpaths.extendSessionButton}`);
   await btn.click();  // Should click successfully
   ```

---

## 🎓 Example: Adding Woori Bank Session XPaths

### Research Phase

```javascript
// In browser console on Woori Bank website:

// Find timer group
$x('//div[contains(@class, "session")]')
// → [<div class="session_info">...</div>]

// Find extend button
$x('//button[contains(text(), "연장")]')
// → [<button id="btn_extend" class="btn_session">연장</button>]

// Verify specific ID
$x('//button[@id="btn_extend"]')
// → [<button id="btn_extend">...</button>]  ✅ Good!
```

### Configuration

```javascript
// banks/woori/config.js
const WOORI_CONFIG = {
  xpaths: {
    // ... other xpaths

    // Session management
    timerGroup: '//div[contains(@class, "session_info")]',
    extendSessionButton: '//button[@id="btn_extend"] | //button[contains(text(), "연장")] | //a[contains(text(), "연장")]',
  }
};
```

### Usage

```javascript
// banks/woori/WooriBankAutomator.js
class WooriBankAutomator extends BaseBankAutomator {
  async login(credentials) {
    // ... perform login

    if (loginResult.success) {
      this.startSessionKeepAlive();  // Uses config.xpaths.extendSessionButton
    }
  }
}

// Automatically works!
// - Checks button every 5 minutes
// - Clicks using robust clickButton method
// - Handles errors gracefully
```

---

## 📋 Quick Reference

### Copy-Paste Templates

**Conservative (ID-based)**:
```javascript
extendSessionButton: '//button[@id="extend_btn"] | //a[@id="extend_link"]'
```

**Moderate (ID + text fallback)**:
```javascript
extendSessionButton: '//button[@id="extend_btn"] | //button[contains(text(), "연장")] | //a[contains(text(), "연장")]'
```

**Aggressive (text-only)**:
```javascript
extendSessionButton: '//button[contains(text(), "연장")] | //a[contains(text(), "연장")]'
```

**Complex (NH-style)**:
```javascript
extendSessionButton: '//a[contains(@href, "extend") and .//span[contains(text(), "연장")]] | //button[contains(text(), "연장")]'
```

---

## 🎯 Final Recommendations

### For Current Banks

1. **Shinhan**: ✅ Keep as-is (stable)
2. **Kookmin**: ✅ Keep as-is (flexible, working)
3. **NH**: ✅ Keep as-is (robust with fallback)
4. **NH Business**: ⚠️ **Add session XPaths if applicable**

### For New Banks

1. Always try **ID selectors first** (fastest, most stable)
2. Add **text-based fallbacks** (for resilience)
3. Support both **`<button>` and `<a>`** elements
4. **Test thoroughly** before deploying
5. Use **progressive specificity** (specific → general)

---

## 📞 Support

**Need help finding XPaths?**
1. Check bank's HTML source (Inspect Element)
2. Test in browser console with `$x()`
3. Verify with Playwright: `page.locator('xpath=...')`
4. Add fallbacks for reliability

**XPath not working?**
1. Check if element is in iframe
2. Verify element is visible (not `display: none`)
3. Try simpler selector
4. Add multiple fallbacks with `|`

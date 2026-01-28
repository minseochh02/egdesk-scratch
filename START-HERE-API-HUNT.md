# 🚀 START HERE: Veraport API Hunt

**Goal:** Find Veraport's JavaScript API to bypass keyboard security WITHOUT hardware.

**Timeline:** 1-2 weeks

**Success Probability:** 40% (but worth trying first!)

---

## 🎯 Why This Might Work

Veraport is a **browser-based** security keyboard. It MUST:
1. Have JavaScript code running in the page
2. Communicate with the password field somehow
3. Have an API to receive/send password data

**We just need to find that API!**

---

## 📋 Step-by-Step Hunt

### **Step 1: Run API Extraction Script**

```javascript
// In your test script or Playwright:
const fs = require('fs');

// Navigate to Shinhan Card
await page.goto('https://www.shinhancard.com/cconts/html/main.html');

// Wait for page load
await page.waitForTimeout(3000);

// Click password field to activate Veraport
await page.locator('[id="pwd"]').click();
await page.waitForTimeout(2000);

// Inject and run API hunter
const apiHunter = fs.readFileSync('extract-veraport-api.js', 'utf8');
const findings = await page.evaluate(apiHunter);

// Print findings
console.log('FINDINGS:', JSON.stringify(findings, null, 2));
```

### **Step 2: Analyze Findings**

Look for these in the console output:

#### **A) Global Objects** ⭐ **MOST IMPORTANT**
```
✅ Found: window.Veraport
✅ Found: window.VeraportKeyboard
✅ Found: window.SecureInput
```

**If found, try:**
```javascript
// Test in browser console or Playwright
await page.evaluate(() => {
  window.Veraport.sendPassword('test123');
  // or
  window.VeraportKeyboard.typeText('test123');
  // or
  window.SecureInput.setValue('test123');
});
```

#### **B) Iframes**
```
Iframe #1: veraport-keyboard - https://secure.wizvera.com/...
```

**If found, the keyboard is in an iframe:**
```javascript
// Try postMessage communication
await page.evaluate(() => {
  const iframe = document.querySelector('iframe[id*="veraport"]');
  iframe.contentWindow.postMessage({
    type: 'setPassword',
    value: 'test123'
  }, '*');
});
```

#### **C) Suspicious Functions**
```
✅ Found function: window.setSecurePassword()
```

**If found, try calling them:**
```javascript
await page.evaluate(() => {
  window.setSecurePassword('test123');
});
```

---

### **Step 3: Extract Extension Files**

**Location on Windows:**
```
%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\
```

**How to find Veraport extension:**
```cmd
cd %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions
dir /s manifest.json | findstr /I "veraport wizvera"
```

**Or manually:**
1. Open: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions`
2. Each folder is an extension (random ID)
3. Open each folder → Open latest version folder
4. Read `manifest.json` to find Veraport
5. Copy entire extension folder

---

### **Step 4: Analyze Extension JavaScript**

**Key files to check:**
- `content_script.js` - Runs in page context
- `background.js` - Background service
- `popup.js` - Extension popup
- `inject.js` - Injected scripts

**What to search for:**
```javascript
// API definitions
window.Veraport = { ... }
window.VeraportAPI = { ... }

// Event listeners
document.addEventListener('veraport-ready', ...)
window.addEventListener('message', ...)

// Password handling
function setPassword(value) { ... }
function encryptPassword(pwd) { ... }

// Form submission
form.addEventListener('submit', ...)

// postMessage communication
window.parent.postMessage(...)
iframe.contentWindow.postMessage(...)
```

**Tools to help:**
- **Beautify:** https://beautifier.io/ (for minified code)
- **VS Code:** Open folder, search across files
- **Grep:** Search for keywords like "password", "keyboard", "encrypt"

---

### **Step 5: Monitor Network Traffic**

Even if DevTools is blocked, use external tools:

#### **A) Fiddler** (Windows)
1. Download: https://www.telerik.com/fiddler
2. Install and run
3. Type password manually on Shinhan Card
4. Check Fiddler for:
   - POST requests with password
   - WebSocket connections
   - API endpoints

#### **B) Wireshark** (Advanced)
1. Download: https://www.wireshark.org/
2. Capture traffic while typing password
3. Filter: `http || websocket`

#### **C) Chrome Network Log** (if you can open it briefly)
Sometimes DevTools is blocked AFTER opening, so:
1. Open DevTools BEFORE navigating to Shinhan Card
2. Go to Network tab
3. Navigate to Shinhan Card
4. Type password manually
5. Export HAR file before DevTools closes

---

### **Step 6: Test Discovered APIs**

Once you find an API, test it:

```javascript
// Example test script
await page.goto('https://www.shinhancard.com/cconts/html/main.html');
await page.locator('[id="pwd"]').click();
await page.waitForTimeout(2000);

// Try discovered API
const success = await page.evaluate((password) => {
  try {
    // Replace with actual API you found
    if (window.Veraport && window.Veraport.setPassword) {
      window.Veraport.setPassword(password);
      return true;
    }

    if (window.SecureInput) {
      window.SecureInput.value = password;
      return true;
    }

    // Check if password was set
    const field = document.getElementById('pwd');
    return field.value.length > 0;
  } catch (e) {
    console.error(e);
    return false;
  }
}, 'test123');

console.log('API test result:', success);
```

---

## 🎯 Most Likely Scenarios

### **Scenario A: Exposed Global API** (40% chance)
```javascript
window.Veraport = {
  sendPassword: function(pwd) { ... },
  encryptAndSend: function(pwd) { ... }
}
```

**Solution:** Call it directly from Playwright ✅

---

### **Scenario B: Iframe Communication** (30% chance)
```javascript
// Keyboard is in iframe
iframe.contentWindow.postMessage({
  action: 'setPassword',
  value: encrypted_password
}, 'https://secure.wizvera.com');
```

**Solution:** Send postMessage from Playwright ✅

---

### **Scenario C: Event-Based** (20% chance)
```javascript
document.dispatchEvent(new CustomEvent('veraport-input', {
  detail: { password: 'test123' }
}));
```

**Solution:** Dispatch events from Playwright ✅

---

### **Scenario D: No Exposed API** (10% chance)
Everything is locked down and obfuscated.

**Solution:** Move to kernel driver approach ⏭️

---

## 🔍 Common API Patterns

Based on similar security software, look for:

```javascript
// Pattern 1: Direct global object
window.VeraportAPI.setSecureValue('password', 'test123')

// Pattern 2: jQuery-style
$('#pwd').secureInput('test123')

// Pattern 3: Data attributes
$('#pwd').data('secure-value', 'test123')

// Pattern 4: Custom events
$('#pwd').trigger('secure-input', {value: 'test123'})

// Pattern 5: Form data injection
$('form').data('secure-pwd', 'test123')

// Pattern 6: Hidden field
$('input[name="encrypted_pwd"]').val(encrypted_value)

// Pattern 7: postMessage to parent
window.parent.postMessage({
  type: 'VERAPORT_INPUT',
  field: 'pwd',
  value: 'test123'
}, '*')
```

---

## 📊 Success Indicators

**You're on the right track if you see:**
- ✅ Global objects with "veraport", "secure", or "keyboard" in name
- ✅ Iframes from wizvera.com or similar domain
- ✅ postMessage communication
- ✅ Custom events being dispatched
- ✅ Hidden form fields that get populated

**You're stuck if:**
- ❌ No global objects found
- ❌ Code is heavily obfuscated and unreadable
- ❌ All communication is encrypted end-to-end
- ❌ No iframes, no events, nothing exposed

---

## 🚀 If You Find the API

**Integrate into your automation:**

```javascript
// In ShinhanCardAutomator.js
async login(credentials, proxyUrl) {
  // ... existing code ...

  // Instead of pynput, use discovered API:
  await this.page.locator('#pwd').click();
  await this.page.waitForTimeout(1000);

  const success = await this.page.evaluate((password) => {
    // Use discovered API
    window.Veraport.setPassword(password);
    return true;
  }, password);

  if (!success) {
    throw new Error('Veraport API failed');
  }

  // Continue with login...
}
```

---

## 🎯 Timeline

| Day | Task | Status |
|-----|------|--------|
| Day 1 | Run API extraction script | ⏳ |
| Day 2 | Extract extension files | ⏳ |
| Day 3-4 | Analyze JavaScript | ⏳ |
| Day 5 | Monitor network traffic | ⏳ |
| Day 6-7 | Test discovered APIs | ⏳ |
| Week 2 | Refine and integrate | ⏳ |

---

## 💡 Pro Tips

1. **Work in incognito mode** - Fresh extension state
2. **Clear cache between tests** - Avoid cached behavior
3. **Try different timing** - API might only exist at certain times
4. **Check console errors** - They might reveal function names
5. **Search for "veraport"** - Literally grep through extension files
6. **Check for encrypted communication** - May need to decrypt first

---

## 🆘 If This Doesn't Work

**After 1-2 weeks of trying, if no API found:**

Move to **Plan B: Virtual USB Kernel Driver**
- See: `SOFTWARE-ONLY-BYPASS-PLAN.md` - Tier 1, Option 1
- Timeline: 6-8 weeks
- Success: 70%
- Cost: $500 (code signing)

---

## 🎯 Ready to Start?

**Run this NOW:**

```bash
# 1. Copy extract-veraport-api.js to your project
# 2. Run your test with the injection:

node test-pynput-only.js  # But inject API hunter first
```

**Or create a new quick test:**

```javascript
// quick-api-test.js
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.locator('[id="pwd"]').click();
  await page.waitForTimeout(2000);

  const apiHunter = fs.readFileSync('extract-veraport-api.js', 'utf8');
  const findings = await page.evaluate(apiHunter);

  console.log('\n=== FINDINGS ===');
  console.log(JSON.stringify(findings, null, 2));

  await page.waitForTimeout(60000); // Keep open for inspection
  await browser.close();
})();
```

**Let's find that API!** 🕵️‍♂️

---

**Next steps after running:** Share the findings and I'll help analyze! 🚀

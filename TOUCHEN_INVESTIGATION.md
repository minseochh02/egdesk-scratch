# TouchEn nxKey Detection Investigation

This guide helps you discover exactly what TouchEn nxKey is checking to detect automation.

---

## Method 1: Browser DevTools Investigation

### Step 1: Open Bank Website Manually

1. Open the banking website in Chrome
2. Press **F12** to open DevTools
3. Go to **Console** tab

### Step 2: Inspect Event Listeners

In the console, run this to check what the password field is monitoring:

```javascript
// Find the password input field
const passwordField = document.querySelector('input[type="password"]');

// Get all event listeners
getEventListeners(passwordField);
```

This shows you EXACTLY what events TouchEn is listening to.

**Look for:**
- `keydown` listeners
- `keyup` listeners
- `input` listeners
- Custom event listeners

---

### Step 3: Check Event Properties Being Validated

Add your own listener BEFORE TouchEn's:

```javascript
const passwordField = document.querySelector('input[type="password"]');

passwordField.addEventListener('keydown', (e) => {
  console.log('🔍 Event Properties:', {
    isTrusted: e.isTrusted,
    type: e.type,
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    which: e.which,
    bubbles: e.bubbles,
    composed: e.composed,
    // TouchEn might add custom properties
    nxKey: e.nxKey,
    encrypted: e.encrypted,
    _encrypted: e._encrypted,
    // Check all properties
    allProperties: Object.keys(e)
  });
}, true); // Use capture phase to run BEFORE TouchEn
```

**Then:**
1. Type with REAL keyboard → Log the event properties
2. Run automation → Log the event properties
3. **Compare the differences!**

---

### Step 4: Find TouchEn JavaScript Code

Search for TouchEn's JavaScript:

```javascript
// In DevTools Console
// Find all scripts
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('touchen') || r.name.includes('nxkey'))
  .forEach(r => console.log(r.name));
```

**Or check Sources tab:**
- Look for scripts with "touchen", "nxkey", "raon" in the name
- These contain the validation logic!

---

### Step 5: Deobfuscate and Read the Code

Once you find TouchEn's JavaScript:

1. Click on the script in Sources tab
2. Click **{ }** (Pretty print) button at bottom
3. Search for keywords:
   - `isTrusted`
   - `keyCode`
   - `webdriver`
   - `automation`
   - `detect`
   - `validate`
   - `block`

**This will show you exactly what they're checking!**

---

## Method 2: Network Monitoring

Check if TouchEn sends data to a server for validation:

### Step 1: Monitor Network Requests

1. Open DevTools → **Network** tab
2. Type in the password field with REAL keyboard
3. **Look for requests** to:
   - TouchEn domains
   - RaonSecure domains
   - Any POST requests with encrypted data

### Step 2: Compare with Automation

1. Run your automation
2. Check if **different requests** are sent
3. Compare request payloads

**TouchEn might send:**
- Keyboard timing data
- Input method fingerprint
- Driver status checks
- Device information

---

## Method 3: Process Monitor (Advanced)

Use Microsoft's **Process Monitor** to see kernel-level activity:

### Step 1: Download Process Monitor

- Download from: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon
- Free Microsoft tool

### Step 2: Set Up Filters

1. Run Process Monitor as Administrator
2. Add filters:
   - **Process Name** is **chrome.exe**
   - **Operation** contains **WriteFile** OR **DeviceIoControl**
   - **Path** contains **nxKey** OR **touchen**

### Step 3: Compare Real vs Automated

**Test 1: Real keyboard**
1. Start capturing
2. Type password with real keyboard
3. Stop capturing
4. Save log as `real-keyboard.pml`

**Test 2: Playwright**
5. Start capturing
6. Run automation
7. Stop capturing
8. Save log as `automation.pml`

**Compare the logs:**
- Look for driver calls
- Check DeviceIoControl operations
- See what TouchEn driver queries

---

## Method 4: Intercept TouchEn Driver Communication

### Step 1: Check What TouchEn Driver Exports

In Command Prompt (as Admin):

```cmd
dumpbin /exports "C:\Program Files\RaonSecure\nxKey\nxKey.sys"
```

(Replace path with actual TouchEn installation path)

This shows what functions the driver exposes.

### Step 2: Monitor Driver IOCTL Calls

Use **API Monitor** or **WinDbg** to see what IOCTLs are being sent to TouchEn driver:

- What requests does the browser make to the driver?
- What data does the driver return?
- Are there validation checks?

---

## Method 5: Fiddler/Charles Proxy

Intercept HTTPS traffic between browser and bank:

1. Install **Fiddler** (free)
2. Enable HTTPS decryption
3. Type with real keyboard → Capture traffic
4. Run automation → Capture traffic
5. **Compare payloads**

Look for differences in:
- Encrypted keyboard data format
- Timing information
- Metadata fields

---

## What to Look For

Based on all methods above, you're looking for **any difference** between real keyboard and automation:

**Likely checks:**
- ✅ `event.isTrusted === false` (we know this)
- ❓ TouchEn driver query: "Is keyboard connected?"
- ❓ Device validation: "What's the USB device ID?"
- ❓ Process check: "Is Playwright/automation running?"
- ❓ Timing fingerprint sent to server
- ❓ Custom event properties

---

## Quick Test You Can Do RIGHT NOW

Open the bank website and run this in console:

```javascript
// Intercept password field events
const pwd = document.querySelector('input[type="password"]');
pwd.addEventListener('keydown', (e) => {
  console.log('isTrusted:', e.isTrusted);
  console.log('All event properties:', Object.keys(e));
  console.log('Full event:', e);
}, true);

// Now type with real keyboard and check what logs
// Then run automation and compare
```

---

**Try the browser console method first** - it's the fastest way to see what TouchEn is checking!

Let me know what you find!
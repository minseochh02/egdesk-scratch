# 🔍 Shinhan Card Security Keyboard - Research Findings

**Date:** 2026-01-28
**Target:** Shinhan Card (www.shinhancard.com) password field
**Goal:** Automate password entry

---

## 🛡️ Security Layers Detected

### **1. Veraport (Wizvera)**
- **Processes:** `veraport.exe`, `veraport-x64.exe`, `delfino.exe`
- **Role:** Secure keyboard input management
- **Level:** User-mode + Browser extension

### **2. IPinside (Interezen)**
- **Processes:** `I3GProc.exe`
- **Role:** Additional security monitoring
- **Level:** User-mode

### **3. Kernel Driver**
- **Driver:** `TKFWVT64.sys`
- **Path:** `C:\WINDOWS\system32\TKFWVT64.sys`
- **Role:** Kernel-level keyboard input filtering
- **Level:** Kernel-mode (deepest level)

### **4. Dream Security**
- **Processes:** `MagicLine4NX.exe`, `Launcher.exe`
- **Role:** Digital signature/certificate management
- **Level:** User-mode (not related to keyboard)

### **5. AhnLab V3**
- **Process:** `V3UI.exe`
- **Role:** Antivirus (not keyboard security)

---

## 🧪 Testing Results

### **❌ FAILED APPROACHES:**

#### **1. Playwright Standard Keyboard API**
```javascript
await page.keyboard.type(password);
```
**Result:** ❌ Blocked
**Why:** Kernel driver (TKFWVT64.sys) blocks automation frameworks

---

#### **2. Virtual Keyboard Extension**
**Approach:** Chrome extension to simulate keyboard
**Result:** ❌ Blocked
**Why:** Security software blocks extension-based input

---

#### **3. WebUSB API Emulation**
**Approach:** Emulate USB keyboard via WebUSB API
**Result:** ❌ Failed
**Why:** Browser requires real physical USB device, showed permission dialog

---

#### **4. Python pynput (OS-Level Input)**
```python
from pynput.keyboard import Controller
keyboard.type(password)
```
**Result:** ❌ Blocked
**Why:** Kernel driver (TKFWVT64.sys) detected it as non-USB input
**Test:** Confirmed via direct testing on Windows

---

#### **5. Capture & Replay Attack**
**Approach:** Manually type password once, capture encrypted `pwd__E2E__` value, replay it
**Result:** ❌ Failed
**Why:** Encrypted values are session-specific (include nonce/timestamp)
**Error:** "패스워드 입력오류입니다" (Password input error)

---

#### **6. jQuery Keypad Plugin Methods**
```javascript
$('#pwd').keypad('setValue', 'Test123');
$('#pwd').keypad('encrypt', 'Test123');
```
**Result:** ❌ Methods exist but don't set encrypted field
**Why:** Methods are stubs or require specific initialization

---

## ✅ KEY DISCOVERIES

### **Discovery 1: Password Masking Pattern**

**Finding:** Passwords are visually masked in the DOM:
- Numbers (0-9) → `"1"`
- Letters (a-z, A-Z) → `"a"`
- Example: `Test123!` becomes `aaaa111a`

**Implication:** Real password is encrypted separately from display

---

### **Discovery 2: Encrypted Hidden Fields**

**Finding:** Multiple encrypted fields exist:
```javascript
pwd__E2E__: "9acd29615174b51ed4695ac9e5fe229645dda1e38fd12f6b5b"
__E2E_RESULT__: "50bf373c1576b08701c3fb76c322fbf32a78de560f7844f60c"
__E2E_KEYPAD__: "1920e1f0f921a02d07c9b5af40ae7bfb1c8c4c10f5ab0bfb97"
__KI_pwd: "812c92fdb7231c0dc6d7ff8dfe579e9da62bf94731d44bb90e"
```

**Implication:** Password is encrypted via E2E (End-to-End) encryption before submission

---

### **Discovery 3: Encryption Happens in Browser JavaScript (NOT Kernel)**

**Test:** Cloned password field without event listeners
- Original field (with listeners): ✅ Encryption happens
- Cloned field (no listeners): ❌ No encryption

**Conclusion:** Browser JavaScript is required for encryption, not kernel driver

**Why kernel driver exists:** To block fake keyboard input, but actual encryption is in browser

---

### **Discovery 4: Event Listeners on Password Field**

**Finding:**
```javascript
onkeydown: ❌ NO listener
onkeyup: ✅ YES → function onkeyup(event) { checkMods(event); }
onkeypress: ❌ NO listener
oninput: ❌ NO listener
onchange: ❌ NO listener
```

**checkMods() function:**
```javascript
function checkMods(e) {
  // Only checks if Enter key (code 13) was pressed
  if(code == 13) {
    $('#loginC').trigger('click');  // Clicks login
  }
}
```

**Conclusion:** `checkMods()` is NOT the encryption function (just detects Enter key)

---

### **Discovery 5: WebSocket Communication**

**Finding:** Encryption uses WebSocket to local nProtect service

**WebSocket URL:** `wss://127.0.0.1:14440/`

**Call Stack when pwd__E2E__ is set:**
```
npWebSocket.onmessage       ← WebSocket receives message
  ↓
peekSendStackMsg()          ← Processes message
  ↓
Object.ax()                 ← Handles result
  ↓
v()                         ← Sets pwd__E2E__ field
```

**Source:** `nppfs-1.13.0.js` (nProtect Pluginfree JavaScript library)

**Messages per keystroke:** ~18 messages sent per character typed

**Responses captured:** 0 (our hooks run too late or responses handled differently)

---

### **Discovery 6: jQuery Keypad Plugin**

**Finding:** `$.fn.keypad()` plugin exists

**Plugin source:**
```javascript
function(a) {
  var b = { div: "nppfs-keypad-div", data: null };
  nq.extend(b, a);
  return this.each(function() {
    if (b.data == null) return true;
    var c = new npKeyPadMaker(this, b);
    npVCtrl.keypadObject.push(c);
  })
}
```

**Related functions:**
- `window.npKeyPadMaker(element, config)` - Creates keypad instance
- `window.setKeyPadOffset(e)` - Adjusts keypad positioning

**Plugin initialization:** Password field has `data-keypad-*` attributes:
```html
data-keypad-type="alpha"
data-keypad-theme="shinhancard"
data-keypad-useyn-input="__KU_89aad1fbb663"
```

---

## 🤔 UNRESOLVED QUESTIONS

### **Question 1: How does browser capture keystrokes?**

**Evidence:**
- ❌ No `onkeydown` listener on password field
- ❌ No `oninput` listener on password field
- ✅ Only `onkeyup` listener (but it's just for Enter key detection)

**Possibilities:**
1. **Kernel driver injects keystrokes into browser** - Kernel monitors real keyboard, sends to browser
2. **Document-level event listeners** - Not on field itself, but on document/window
3. **Iframe captures input** - Virtual keyboard in iframe intercepts
4. **Native browser extension** - Extension captures before JavaScript sees it

**Status:** ⚠️ UNKNOWN - Need more investigation

---

### **Question 2: Where do WebSocket responses go?**

**Evidence:**
- ✅ 18 messages SENT per character typed
- ❌ 0 messages RECEIVED captured
- ✅ But `pwd__E2E__` field DOES get populated
- ✅ Call stack shows `npWebSocket.onmessage` was called

**Possibilities:**
1. **Responses handled before our hooks run** - Native handler processes first
2. **Responses are binary/different format** - Our hook doesn't recognize them
3. **Synchronous local processing** - No async response needed
4. **Direct memory access** - nProtect writes to browser memory directly

**Status:** ⚠️ UNKNOWN - Hooks not catching responses

---

### **Question 3: What do the WebSocket messages contain?**

**Evidence:**
```
Message format: Hex-encoded strings
Length: 415-671 characters
Example: f54e7b411b17fdde86e134d3fde127e7c70fb55106c1bda41bc1b36d58ff658e14000000...
```

**Observations:**
- Messages vary in length (415, 439, 447, 666, 671 chars)
- Many messages start with same prefix: `f54e7b411b17fdde86e134d3fde127e7`
- Some messages start differently: `a4fea4d1745962e775b7e390f6a227f6`
- Contains hex-encoded data

**Possibilities:**
1. **Encrypted keystroke data** - Each character encrypted before sending
2. **Session tokens + keystroke** - Includes session info
3. **Protocol headers + payload** - Format includes metadata
4. **Challenge-response** - Messages include authentication data

**Status:** ⚠️ UNKNOWN - Need to decode message format

---

### **Question 4: Can we communicate with WebSocket directly?**

**Known:**
- ✅ WebSocket endpoint: `wss://127.0.0.1:14440/`
- ✅ Connection is TLS/SSL encrypted (wss://)
- ✅ Running on localhost (nProtect service)
- ✅ Port 14440

**Unknowns:**
- ❓ Message protocol format
- ❓ Authentication required?
- ❓ Session initialization sequence
- ❓ How to construct valid messages

**Status:** ⚠️ UNKNOWN - Need protocol reverse engineering

---

## 🎯 CURRENT SITUATION

### **What We Know For Sure:**

1. ✅ Kernel driver blocks automation keyboard input (Playwright, pynput, etc.)
2. ✅ Browser JavaScript performs encryption (not kernel driver)
3. ✅ Encryption requires browser event handlers/listeners
4. ✅ WebSocket communication to localhost service (wss://127.0.0.1:14440/)
5. ✅ Each keystroke triggers multiple WebSocket messages (~18 per character)
6. ✅ Encrypted values are session-specific (replay attack failed)
7. ✅ Password displayed as masked pattern (`aaaa111`)
8. ✅ Real password encrypted in `pwd__E2E__` hidden field

### **What We Don't Know:**

1. ❓ How browser captures keystrokes (no obvious event listeners)
2. ❓ WebSocket message format and protocol
3. ❓ How to construct valid WebSocket messages
4. ❓ Where WebSocket responses go (not captured by hooks)
5. ❓ How to trigger encryption from automation

---

## 🚀 POTENTIAL NEXT STEPS

### **Option A: Reverse Engineer WebSocket Protocol** 🔴 **HARD**

**Approach:**
1. Decode hex message format
2. Understand protocol structure
3. Craft valid messages
4. Send password character-by-character
5. Receive encrypted responses
6. Build complete `pwd__E2E__` value

**Difficulty:** Very High
**Timeline:** 2-4 weeks
**Success Probability:** 40%

**Challenges:**
- Protocol is proprietary
- May include authentication/session tokens
- Messages are hex-encoded (need to decode)
- No documentation available

---

### **Option B: Find How Browser Captures Keystrokes** 🟡 **MEDIUM**

**Approach:**
1. Search for document-level event listeners
2. Check if iframe captures input
3. Look for browser extension listeners
4. Find where keystroke → WebSocket sending happens

**Once found:**
- Trigger the same code path from automation
- Send our password through the same mechanism
- Get encrypted value

**Difficulty:** Medium
**Timeline:** 1-2 weeks
**Success Probability:** 50%

---

### **Option C: Analyze nppfs-1.13.0.js Source** 🟢 **EASIER**

**Approach:**
1. Download: `https://www.shinhancard.com/csolution/inca_nos/pluginfree/js/nppfs-1.13.0.js`
2. Beautify/deobfuscate the code
3. Find the encryption function
4. Find the WebSocket send function
5. Understand what triggers it
6. Replicate in automation

**Difficulty:** Medium
**Timeline:** 1 week
**Success Probability:** 60%

**Next steps:**
```bash
# Download the script
curl "https://www.shinhancard.com/csolution/inca_nos/pluginfree/js/nppfs-1.13.0.js" > nppfs.js

# Search for relevant functions
grep -i "websocket.send" nppfs.js
grep -i "pwd__E2E__" nppfs.js
grep -i "encrypt" nppfs.js
```

---

### **Option D: Monitor at Lower Level** 🔴 **HARD**

**Approach:**
Use Windows API monitoring tools:
1. **API Monitor** - Monitor WebSocket API calls
2. **Process Monitor** - Monitor nProtect service activity
3. **Wireshark** - Capture localhost WebSocket traffic (might be encrypted)
4. **Fiddler** - Intercept WebSocket messages

**Tools:**
- API Monitor: http://www.rohitab.com/apimonitor
- Process Monitor: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon
- Wireshark: https://www.wireshark.org/

**Difficulty:** High
**Timeline:** 2-3 weeks
**Success Probability:** 50%

---

### **Option E: Hardware USB Device** ✅ **GUARANTEED**

**Approach:** USB Rubber Ducky or Arduino Leonardo

**Why it works:**
- Kernel driver sees it as real USB keyboard
- No browser automation needed
- Bypasses all security layers

**Difficulty:** Low
**Timeline:** 1-2 weeks (shipping time)
**Success Probability:** 99%
**Cost:** $60-80

---

## 🧩 MISSING PIECES

### **Critical Unknown: How are keystrokes captured?**

**What we checked:**
```javascript
onkeydown: ❌ NO
onkeyup: ✅ YES (but only checks for Enter key)
onkeypress: ❌ NO
oninput: ❌ NO
onchange: ❌ NO
```

**The mystery:**
- No obvious event listener captures individual keystrokes
- Yet browser knows what you typed
- Sends it via WebSocket

**Theories:**

#### **Theory A: Document/Window Level Listeners**
```javascript
// Not on the field itself, but on document
document.addEventListener('keydown', function(e) {
  if (e.target.id === 'pwd') {
    // Send to WebSocket
  }
});
```

#### **Theory B: Kernel Driver Injects Keystrokes**
```
Real keyboard → Kernel driver → Browser (via injection)
                                  ↓
                            WebSocket send
```

#### **Theory C: Browser Extension Intercepts**
```
Browser extension → Captures keystrokes before page sees them
                  → Sends to WebSocket
```

#### **Theory D: Virtual Keyboard Iframe**
```
Click password field → Iframe keyboard appears
                     → You click keys in iframe
                     → Iframe sends to WebSocket
```

**Status:** Need to test each theory

---

## 📊 WEBSOCKET PROTOCOL ANALYSIS

### **Endpoint:**
```
URL: wss://127.0.0.1:14440/
Protocol: WebSocket Secure (TLS)
Service: Local nProtect process
```

### **Traffic Pattern:**
```
One character typed → ~18 WebSocket messages sent
```

### **Message Format:**
```
Format: Hex-encoded strings
Length: 415-671 characters
Example: f54e7b411b17fdde86e134d3fde127e7c70fb55106c1bda41bc1b36d58ff658e14000000...
```

**Common prefixes:**
- `f54e7b411b17fdde86e134d3fde127e7c70fb55106c1bda41bc1b36d58ff658e`
- `a4fea4d1745962e775b7e390f6a227f66f06ae1392a317adbb20bc4c0ae2ca1d`
- `02a09fc9af07ca384a81770e524126b3431d8fe3e3fda36828b7b342f5672cd5`

**Observations:**
- Multiple message types (different prefixes)
- Variable lengths suggest different message types
- Likely includes: session ID, sequence number, encrypted keystroke

### **Response Messages:**
```
Captured: 0
Expected: ~18 (matching sent messages)
```

**Problem:** Our hooks don't capture responses

**Possibilities:**
1. Responses handled by native code (before JavaScript hooks)
2. Responses processed synchronously
3. No actual responses (one-way communication?)
4. Hook timing issue

---

## 🔧 TECHNICAL DETAILS

### **nProtect JavaScript Library:**
```
File: nppfs-1.13.0.js
URL: https://www.shinhancard.com/csolution/inca_nos/pluginfree/js/nppfs-1.13.0.js
Size: Unknown (minified)
```

**Key functions identified:**
- `npKeyPadMaker()` - Creates keypad instance
- `peekSendStackMsg()` - Processes WebSocket messages
- `npWebSocket.onmessage` - Handles responses
- `Object.ax()` - Handles encryption result
- `v()` - Sets encrypted field value

### **jQuery Plugin:**
```javascript
$.fn.keypad(options)
```

**Purpose:** Initializes secure keypad on input field
**Usage:** `$('#pwd').keypad({ data: keypadConfig })`
**Note:** Methods like `setValue`, `encrypt` exist but don't work as expected

---

## 🎯 RECOMMENDED NEXT ACTIONS

### **Priority 1: Download and Analyze nppfs-1.13.0.js** ⭐

**Why:**
- Contains all encryption logic
- Shows WebSocket protocol
- Reveals how to trigger encryption
- Most direct path to solution

**How:**
```bash
curl "https://www.shinhancard.com/csolution/inca_nos/pluginfree/js/nppfs-1.13.0.js" > nppfs.js
# Beautify it
# Search for key functions
# Understand the flow
```

**Timeline:** 1 week
**Difficulty:** Medium
**Success probability:** 60%

---

### **Priority 2: Find Document-Level Event Listeners**

**Why:**
- Keystrokes must be captured somewhere
- No field-level listeners found
- Must be document/window level

**How:**
- Search for `document.addEventListener`
- Check `window.addEventListener`
- Look in nppfs-1.13.0.js for event setup

**Timeline:** 2-3 days
**Difficulty:** Easy
**Success probability:** 70%

---

### **Priority 3: Fix WebSocket Response Capture**

**Why:**
- Need to see what responses look like
- Need to understand response format
- Might contain encrypted values directly

**How:**
- Hook at native WebSocket level
- Use browser DevTools (if we can open it)
- Use external tools (Wireshark, Fiddler)

**Timeline:** 3-5 days
**Difficulty:** Medium
**Success probability:** 50%

---

## 💡 CURRENT HYPOTHESIS

### **The Encryption Flow (Best Guess):**

```
1. User types "g" on real keyboard
              ↓
2. Kernel driver (TKFWVT64.sys) allows it (real USB keyboard)
              ↓
3. ??? UNKNOWN: How does browser capture it? ???
   - Document-level listener?
   - Browser extension?
   - Iframe?
              ↓
4. Browser JavaScript sends to WebSocket
   → wss://127.0.0.1:14440/
   → nProtect service receives keystroke
              ↓
5. nProtect service encrypts it
              ↓
6. ??? UNKNOWN: How does response come back? ???
   - WebSocket response (we didn't capture)?
   - Direct memory write?
   - Callback function?
              ↓
7. pwd__E2E__ field gets set with encrypted value
              ↓
8. User clicks login → Form submits with encrypted password
```

**Missing pieces:**
- Step 3: How browser captures keystrokes
- Step 6: How encrypted value comes back

---

## 🎯 DECISION POINT

### **Software Solution Paths:**

| Path | Difficulty | Time | Success | Status |
|------|-----------|------|---------|--------|
| **Analyze nppfs-1.13.0.js** | Medium | 1 week | 60% | ⏳ Recommended |
| **Find event listeners** | Easy | 2-3 days | 70% | ⏳ Recommended |
| **Reverse engineer WebSocket** | Hard | 2-4 weeks | 40% | ⏸️ Low priority |
| **Fix response capture** | Medium | 3-5 days | 50% | ⏸️ Medium priority |

### **Hardware Solution:**

| Option | Difficulty | Time | Success | Cost |
|--------|-----------|------|---------|------|
| **USB Rubber Ducky** | Easy | 1-2 weeks | 99% | $60-80 |
| **Arduino Leonardo** | Easy | 1-2 days | 99% | $10-15 |

---

## 📝 NOTES

- All testing done on Windows PC
- Chrome browser (not Chromium)
- Multiple security layers active simultaneously
- DevTools forcibly closed when opened (anti-debugging)
- Security software: Veraport, IPinside, Dream Security, AhnLab V3
- Kernel driver: TKFWVT64.sys

---

## 🤝 COLLABORATION POINTS

**Where we are:**
- Identified security layers ✅
- Tested multiple bypass approaches ✅
- Found WebSocket communication ✅
- Located relevant JavaScript files ✅

**Where we're stuck:**
- Don't know how browser captures keystrokes ❌
- Can't capture WebSocket responses ❌
- Can't craft valid WebSocket messages ❌

**What we need to decide:**
- Continue software investigation? (1+ more weeks)
- Switch to hardware solution? (1-2 days, $10-15)

---

---

## 🏗️ SYSTEM ARCHITECTURE MAP

### **Component Overview:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHINHAN CARD SERVER                         │
│                                                                 │
│  - Has decryption keys (from Veraport)                         │
│  - Receives encrypted pwd__E2E__ value                         │
│  - Decrypts and validates password                             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS POST
                              │ Form submission with:
                              │ - pwd: "aaaa111" (masked)
                              │ - pwd__E2E__: "encrypted..."
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     CHROME BROWSER                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  WEB PAGE (HTML/JavaScript)                             │  │
│  │                                                          │  │
│  │  - Password field: <input id="pwd">                     │  │
│  │  - Hidden field: <input name="pwd__E2E__">              │  │
│  │  - nppfs-1.13.0.js (nProtect JavaScript library)        │  │
│  │  - jQuery keypad plugin: $.fn.keypad()                  │  │
│  │                                                          │  │
│  │  Event Listeners:                                       │  │
│  │    - onkeyup: checkMods() (only checks Enter key)       │  │
│  │    - onfocus: ??? (activates encryption system)         │  │
│  │                                                          │  │
│  │  WebSocket Client:                                      │  │
│  │    - Connects to: wss://127.0.0.1:14440/                │  │
│  │    - Sends: ~18 messages per character                  │  │
│  │    - Receives: ??? (not captured yet)                   │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ WebSocket (wss://)
                              │ Messages: Hex-encoded
                              │
┌─────────────────────────────────────────────────────────────────┐
│              LOCALHOST nProtect SERVICE                         │
│                 (User's Computer)                               │
│                                                                 │
│  Processes:                                                     │
│    - veraport.exe, veraport-x64.exe                            │
│    - I3GProc.exe (IPinside)                                    │
│    - delfino.exe                                               │
│                                                                 │
│  WebSocket Server:                                             │
│    - Listening on: 127.0.0.1:14440                            │
│    - Protocol: WebSocket Secure (TLS)                          │
│                                                                 │
│  Functions:                                                     │
│    - Receives keystroke data from browser                      │
│    - Encrypts using stored keys                                │
│    - Sends encrypted value back (?)                            │
│    - OR directly modifies browser memory (?)                   │
│                                                                 │
│  Encryption Keys:                                              │
│    - Downloaded from Veraport server during install            │
│    - Same keys that Shinhan Card server has                    │
│    - Can encrypt offline (no internet needed)                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Monitors keyboard
                              │ Blocks non-USB input
                              │
┌─────────────────────────────────────────────────────────────────┐
│                  KERNEL DRIVER (TKFWVT64.sys)                   │
│                    (Windows Kernel Space)                       │
│                                                                 │
│  Role:                                                          │
│    - Monitors ALL keyboard input at kernel level               │
│    - Blocks automation tools (Playwright, pynput, etc.)        │
│    - Allows only REAL USB keyboard input                       │
│    - ??? Possibly communicates with nProtect service ???       │
│                                                                 │
│  How it knows which field:                                     │
│    - ??? Browser/service tells it which field to monitor ???   │
│    - ??? Registers field #pwd for encryption ???               │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Hardware input
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICAL USB KEYBOARD                        │
│                                                                 │
│  - Real hardware device                                         │
│  - Kernel driver ACCEPTS input from this                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 **The Complete Flow (Our Best Guess):**

### **Initialization Phase (When field gets focus):**

```
Step 1: User tabs/clicks password field
        ↓
Step 2: Browser detects focus event
        ↓
Step 3: JavaScript sends WebSocket messages to localhost:14440
        "Hey nProtect service, field #pwd needs encryption"
        ↓
Step 4: nProtect service receives registration
        "OK, monitoring field #pwd"
        ↓
Step 5: ??? Service tells kernel driver about this field ???
        "TKFWVT64.sys, watch for input to #pwd"
        ↓
Step 6: System is ARMED - ready for encrypted input
```

### **Keystroke Phase (After field is focused):**

```
Step 1: User types "g" on REAL USB keyboard
        ↓
Step 2: Kernel driver (TKFWVT64.sys) intercepts keystroke
        - Checks: Is this from real USB keyboard? ✅ YES
        - Checks: Is this for registered field #pwd? ✅ YES
        - Action: Allow it to continue
        ↓
Step 3A: ??? WHO captures the keystroke now? ???

        Theory A: Kernel driver sends to nProtect service directly
        Theory B: Browser JavaScript captures and sends to WebSocket
        Theory C: Browser extension intercepts

        ↓
Step 4: nProtect service (localhost:14440) receives keystroke data
        ↓
Step 5: nProtect service encrypts it using stored keys
        "g" → "99dcd5e948b0..."
        ↓
Step 6: ??? HOW does encrypted value get back to browser? ???

        Theory A: WebSocket response to browser
        Theory B: Service directly writes to browser memory
        Theory C: Kernel driver injects value into pwd__E2E__ field

        ↓
Step 7: pwd__E2E__ field gets populated with encrypted value
        ↓
Step 8: Browser shows masked pattern "a" in visible field
```

---

## ❓ CRITICAL UNKNOWNS

### **Unknown #1: How does kernel driver know which field?**

**Theories:**

**A) Browser JavaScript registers the field:**
```javascript
// Browser tells service/kernel: "Monitor field #pwd"
nProtectAPI.registerField('pwd', { type: 'password', encrypt: true });
```

**B) Field attributes signal the system:**
```html
<input id="pwd"
       data-keypad-type="alpha"     ← These attributes
       data-keypad-theme="shinhancard"  ← Tell the system
       data-keypad-useyn-input="__KU_89aad1fbb663">  ← To monitor this field
```

**C) jQuery keypad initialization:**
```javascript
$('#pwd').keypad({ data: config });  ← Registers field with service
```

**Evidence needed:** Check WebSocket messages sent on focus

---

### **Unknown #2: Who captures keystrokes after kernel driver allows them?**

**Theories:**

**A) Kernel driver sends to nProtect service:**
```
Kernel driver → veraport.exe (via IPC/shared memory)
```

**B) Browser JavaScript captures:**
```
Browser event listener → WebSocket → veraport.exe
```

**C) Browser extension captures:**
```
Chrome extension → WebSocket → veraport.exe
```

**Evidence:** We saw ~18 WebSocket messages sent per keystroke
**Implies:** Browser IS sending messages (Theory B or C)

---

### **Unknown #3: How does encrypted value get back?**

**Theories:**

**A) WebSocket response to browser:**
```
veraport.exe → WebSocket response → Browser JavaScript → Sets pwd__E2E__
```
**Problem:** We couldn't capture responses

**B) Direct browser memory write:**
```
veraport.exe → Chrome process memory → Direct write to pwd__E2E__ field
```
**Problem:** Would bypass our JavaScript hooks

**C) Kernel driver injects:**
```
veraport.exe → Kernel driver → Injects into browser DOM
```
**Problem:** Would bypass our hooks too

**Evidence needed:** Our deepest hook should catch it if it's JavaScript

---

### **Unknown #4: What do the 18 messages contain?**

**For ONE character "g", we send ~18 WebSocket messages**

**Theories:**

**A) Different message types:**
```
Messages 1-5: Initialization/handshake
Messages 6-10: Session management
Message 11: The actual keystroke "g"
Messages 12-18: Validation/confirmation
```

**B) Character sent multiple times:**
```
Each message: Different encryption of "g"
For validation or redundancy
```

**C) Protocol overhead:**
```
Keep-alive, heartbeat, status checks
Plus the actual data
```

**Evidence needed:** Analyze message content/format

---

## 🎯 WHAT WE NEED TO FIND

### **Priority 1: Analyze WebSocket Messages on Focus** ⭐

**Test:**
```
1. Clear all messages
2. Focus on password field (don't type yet!)
3. Capture messages sent
4. These are REGISTRATION/INITIALIZATION messages
```

**What this reveals:**
- How field gets registered
- What initialization looks like
- Possibly the protocol format

---

### **Priority 2: Capture Messages for Single Keystroke** ⭐

**Test:**
```
1. Field already focused (initialized)
2. Type ONLY "g"
3. Separate initialization messages from keystroke messages
```

**What this reveals:**
- Which message(s) contain the actual keystroke
- Message format for character encryption
- How to craft our own messages

---

### **Priority 3: Run Deepest Hook Test** ⭐

**Test:** Run `test-kernel-vs-browser.js`

**What this reveals:**
- If JavaScript sets pwd__E2E__ → We can intercept ✅
- If something else sets it → Hardware needed ❌

---

## 🧪 PROPOSED NEXT EXPERIMENTS

### **Experiment A: Focus-Only Message Capture**
```javascript
// Capture baseline
await page.goto(url);
let messages = await getWebSocketMessages(); // = 0

// Focus field
await page.locator('#pwd').focus();
await wait(2s);

let afterFocus = await getWebSocketMessages(); // = X messages
// These X messages are INITIALIZATION
```

### **Experiment B: Keystroke-Only Message Capture**
```javascript
// Field already focused
let beforeType = await getWebSocketMessages(); // = X

// Type "g"
// (manually or somehow)

let afterType = await getWebSocketMessages(); // = X + Y
// The Y new messages are for keystroke "g"
```

### **Experiment C: Run Definitive JavaScript Hook Test**
```bash
node test-kernel-vs-browser.js
```

---

## 📋 QUESTIONS TO ANSWER

Before we proceed, we need to answer:

**Q1:** Does our deepest hook catch `pwd__E2E__` being set?
- ✅ YES → Browser JavaScript does it, we can intercept
- ❌ NO → Kernel/service does it directly, much harder

**Q2:** What messages are sent on field focus (before typing)?
- Tells us initialization/registration protocol

**Q3:** What messages are sent for a single character?
- Tells us how to send our own characters

**Q4:** Can we decode the WebSocket message format?
- Hex data → What does it represent?

---

## 🎯 RECOMMENDED ORDER

1. **Run `test-kernel-vs-browser.js`** first
   - Answers Q1: Does JS set the field?
   - This determines if software solution is even possible

2. **If Q1 = YES, analyze WebSocket messages**
   - Separate focus messages from keystroke messages
   - Understand protocol format
   - Try to replicate

3. **If Q1 = NO, hardware solution**
   - USB Rubber Ducky or Arduino
   - Done in 1-2 days

---

**End of findings document. Next: Run definitive test, then update this doc with results.**


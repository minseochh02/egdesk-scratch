# 🔥 Software-Only Bypass Plan - Pushing the Limits

**Goal:** Bypass kernel-level keyboard security (TKFWVT64.sys + Veraport + IPinside) WITHOUT hardware.

**Challenge Accepted:** Let's explore EVERY software possibility.

---

## 🎯 The Challenge

### What We're Up Against:

```
Layer 1: TKFWVT64.sys (Kernel Driver)
         ↓ Monitors all keyboard input at kernel level
         ↓ Filters non-USB input
         ↓ Cannot be bypassed from user-mode

Layer 2: Veraport (User-mode + Browser)
         ↓ Browser extension monitoring
         ↓ Process-level checks
         ↓ Automation detection

Layer 3: IPinside (User-mode)
         ↓ Additional monitoring
         ↓ Security policy enforcement

Layer 4: Browser Security
         ↓ DevTools blocked
         ↓ navigator.webdriver detection
```

---

## 🚀 Software-Only Approaches (Ranked by Feasibility)

### **Tier 1: Realistic (Weeks to Implement)**

#### **1. Windows Kernel Driver - Virtual USB HID Device** ⭐

**Concept:** Create a software USB device that the kernel driver accepts as real USB.

**How it works:**
```
Your App → Kernel Driver (signed) → Creates Virtual USB Device
                                    ↓
                            TKFWVT64.sys sees "USB keyboard"
                                    ↓
                            Accepts input ✅
```

**Implementation:**
1. **Windows Driver Kit (WDK)** development
2. Create virtual USB bus driver
3. Implement USB HID keyboard descriptor
4. Send HID reports to virtual device
5. **Critical:** Must be signed by Microsoft

**Feasibility:** 🟡 **Possible but complex**

**Timeline:** 4-8 weeks

**Requirements:**
- Windows Driver Kit expertise
- Understanding of USB HID protocol
- Driver signing ($$$)
- Testing infrastructure

**Pros:**
- ✅ Software-only solution
- ✅ Works remotely
- ✅ Appears as real USB device to kernel
- ✅ Once working, it's permanent

**Cons:**
- ❌ Very complex (kernel programming)
- ❌ Requires driver signing ($300-500/year)
- ❌ May need EV certificate ($200-400)
- ❌ Must maintain for each Windows update
- ❌ User must install driver (admin rights)

**Resources:**
- Microsoft WDK: https://docs.microsoft.com/en-us/windows-hardware/drivers/
- Virtual USB: https://github.com/Microsoft/Windows-driver-samples/tree/main/usb
- HID examples: https://github.com/Microsoft/Windows-driver-samples/tree/main/hid

**Signing Process:**
1. Get EV Code Signing Certificate (~$300/year)
2. Create driver package
3. Submit to Windows Hardware Dev Center
4. Wait for attestation signing (~24-48 hours)
5. Distribute signed driver

**Code Complexity:** ~5,000-10,000 lines of C code

---

#### **2. Browser Extension Manipulation**

**Concept:** Find and use Veraport's internal API directly.

**How it works:**
```
Your Automation → Inject into page context
                → Find Veraport API
                → window.Veraport.sendPassword('text')
                → Bypasses keyboard monitoring ✅
```

**Implementation:**

**Step A: Extract Veraport Extension**
```bash
# Location:
%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\

# Find Veraport extension
# Copy all files
```

**Step B: Decompile/Analyze**
```javascript
// Look for:
// 1. content_script.js
// 2. background.js
// 3. Injected scripts

// Search for:
window.Veraport = { ... }
window.sendSecureInput = function() { ... }
document.getElementById('secure_keyboard').setValue()
```

**Step C: Call API from Playwright**
```javascript
await page.evaluate((password) => {
  // If they expose a global object
  if (window.Veraport && window.Veraport.sendPassword) {
    window.Veraport.sendPassword(password);
    return true;
  }

  // Or if they use events
  const event = new CustomEvent('secureInput', {
    detail: { value: password }
  });
  document.dispatchEvent(event);

  return false;
}, password);
```

**Feasibility:** 🟢 **Most likely to work**

**Timeline:** 1-2 weeks

**Requirements:**
- JavaScript reverse engineering
- Chrome extension knowledge
- Patience to read obfuscated code

**Pros:**
- ✅ Pure software
- ✅ No driver signing needed
- ✅ Works remotely
- ✅ Relatively simple if API exists

**Cons:**
- ❌ API may not exist or be exposed
- ❌ Code may be heavily obfuscated
- ❌ May change with updates
- ❌ May require specific timing/context

**Next Steps:**
1. Extract Veraport extension files
2. Search for JavaScript APIs
3. Test calling them from console (if DevTools works)
4. Integrate into Playwright

---

#### **3. Windows Test Mode + Unsigned Driver**

**Concept:** Run Windows in test mode to load unsigned kernel driver.

**How it works:**
```
Enable Test Mode → Load unsigned driver → Virtual USB device → Bypass ✅
```

**Enable Test Mode:**
```cmd
# Run as Administrator
bcdedit /set testsigning on
# Reboot
```

**Implementation:**
Same as Tier 1 Option 1, but skip expensive signing.

**Feasibility:** 🟡 **Possible but user-hostile**

**Timeline:** 3-6 weeks (development) + instant deployment

**Pros:**
- ✅ No driver signing cost
- ✅ Faster development cycle
- ✅ Full kernel access

**Cons:**
- ❌ User must enable test mode (scary)
- ❌ Test mode shows watermark on desktop
- ❌ May void warranties
- ❌ Some software refuses to run in test mode
- ❌ Security implications

---

### **Tier 2: Challenging (Months to Implement)**

#### **4. Memory Injection into Chrome Process**

**Concept:** Inject code into Chrome that hooks before Veraport sees it.

**How it works:**
```
Your App → DLL Injection → Chrome Process
                          → Hook keyboard input API
                          → Insert password before Veraport checks
                          → Bypass monitoring ✅
```

**Implementation:**
```cpp
// Injector.cpp
HANDLE hProcess = OpenProcess(PROCESS_ALL_ACCESS, FALSE, chromePID);
LPVOID loadLibraryAddr = GetProcAddress(GetModuleHandle("kernel32.dll"), "LoadLibraryA");
LPVOID dllPathAddr = VirtualAllocEx(hProcess, NULL, strlen(dllPath), MEM_COMMIT, PAGE_READWRITE);
WriteProcessMemory(hProcess, dllPathAddr, dllPath, strlen(dllPath), NULL);
CreateRemoteThread(hProcess, NULL, 0, (LPTHREAD_START_ROUTINE)loadLibraryAddr, dllPathAddr, 0, NULL);
```

```cpp
// Hooks.cpp
// Hook Chrome's input handling
typedef void (WINAPI *SendInputFunc)(UINT, LPINPUT, int);
SendInputFunc OriginalSendInput = NULL;

void WINAPI HookedSendInput(UINT cInputs, LPINPUT pInputs, int cbSize) {
    // Modify input to look like USB keyboard
    // Then call original
    OriginalSendInput(cInputs, pInputs, cbSize);
}
```

**Feasibility:** 🔴 **Very difficult**

**Timeline:** 2-3 months

**Pros:**
- ✅ Software-only
- ✅ No driver needed

**Cons:**
- ❌ Chrome has anti-injection protections
- ❌ May not bypass kernel driver
- ❌ Code signing required
- ❌ Chrome updates break it
- ❌ Security software detects injection

---

#### **5. Alternative Input Path - IME (Input Method Editor)**

**Concept:** Use Korean IME to inject text, which may bypass keyboard monitoring.

**How it works:**
```
Your App → Windows IME API → Korean input
                            → Veraport may not monitor IME
                            → Bypass ✅ (maybe)
```

**Implementation:**
```cpp
// Use ImmSetCompositionString
HIMC hIMC = ImmGetContext(hwnd);
ImmSetCompositionString(hIMC, SCS_SETSTR, password, len, NULL, 0);
ImmReleaseContext(hwnd, hIMC);
```

**Feasibility:** 🟡 **Worth trying**

**Timeline:** 1 week

**Pros:**
- ✅ Different input path than keyboard
- ✅ Relatively simple
- ✅ May not be monitored

**Cons:**
- ❌ Security software likely monitors IME too
- ❌ May only work with Korean characters
- ❌ Requires focus management

---

#### **6. Windows Accessibility API Abuse**

**Concept:** Use accessibility APIs which have special privileges.

**How it works:**
```
Your App → UI Automation API → Set field value
                              → Accessibility APIs have special access
                              → May bypass monitoring ✅
```

**Implementation:**
```csharp
// C# with UI Automation
using System.Windows.Automation;

AutomationElement passwordField = /* find element */;
if (passwordField != null) {
    ValuePattern valuePattern = passwordField.GetCurrentPattern(ValuePattern.Pattern) as ValuePattern;
    valuePattern.SetValue("password");
}
```

**Feasibility:** 🟢 **Easy to try**

**Timeline:** 3-5 days

**Pros:**
- ✅ Simple to implement
- ✅ Microsoft-sanctioned API
- ✅ May have special permissions

**Cons:**
- ❌ Likely monitored by security software
- ❌ May still be blocked

---

### **Tier 3: Extreme (Theoretical)**

#### **7. Kernel-Mode Hook of TKFWVT64.sys**

**Concept:** Hook the security driver itself to allow our input.

**Feasibility:** 🔴 **Extremely difficult, possibly illegal**

**Why it's extreme:**
- Requires kernel debugging
- May trigger PatchGuard (Windows kernel protection)
- Likely violates Windows ToS
- Could brick system
- Definitely violates security software ToS

**NOT RECOMMENDED**

---

#### **8. Hypervisor-Based Approach**

**Concept:** Run Windows in a VM, intercept input at hypervisor level.

**Feasibility:** 🔴 **Overkill**

**Why it's extreme:**
- Security software may detect VM
- Hypervisor development is extremely complex
- May not work with modern anti-VM detection

**NOT RECOMMENDED**

---

#### **9. BIOS/UEFI USB Emulation**

**Concept:** Emulate USB keyboard at firmware level.

**Feasibility:** 🔴 **Insanely complex**

**Why it's extreme:**
- Requires BIOS/UEFI development
- Hardware-dependent
- Could brick motherboard
- Essentially building hardware solution

**NOT RECOMMENDED**

---

## 🎯 Recommended Software-Only Strategy

### **Phase 1: Quick Wins (Week 1-2)**

**Priority 1: Browser Extension API Hunt** ⭐
- Extract Veraport extension
- Decompile/read JavaScript
- Find exposed APIs
- **If found**: Implement immediately
- **Success chance**: 40%

**Priority 2: Accessibility API Test**
- Try Windows UI Automation
- Test with password field
- **If works**: Implement immediately
- **Success chance**: 20%

**Priority 3: IME Input Test**
- Try Korean IME API
- Test if bypasses monitoring
- **Success chance**: 15%

### **Phase 2: Serious Engineering (Month 1-2)**

**If Phase 1 fails:**

**Build Virtual USB Kernel Driver**
1. Set up Windows Driver Kit
2. Study USB HID protocol
3. Create virtual USB bus driver
4. Implement HID keyboard
5. Test in Windows Test Mode first
6. If works, invest in code signing
7. Deploy signed driver

**Success chance**: 70%
**Timeline**: 6-8 weeks
**Cost**: $500-800 (certificates)

### **Phase 3: Nuclear Option (Month 3+)**

**If Phase 2 fails:**

**Consider these unlikely scenarios:**
- Contact security software vendor for official API
- Reverse engineer and find vulnerability
- Switch to different authentication method
- Hardware solution (give up on software-only)

---

## 📊 Success Probability Matrix

| Approach | Success | Timeline | Difficulty | Cost |
|----------|---------|----------|------------|------|
| **Browser Extension API** | 40% | 1-2 weeks | Medium | $0 |
| **Accessibility API** | 20% | 3-5 days | Easy | $0 |
| **IME Input** | 15% | 1 week | Easy | $0 |
| **Virtual USB Driver** | 70% | 6-8 weeks | Very Hard | $500 |
| **Memory Injection** | 30% | 2-3 months | Hard | $300 |
| **Test Mode Driver** | 60% | 6-8 weeks | Very Hard | $0 |

---

## 🚀 Implementation Roadmap

### **Week 1: Reconnaissance**
- [ ] Extract Veraport extension files
- [ ] Decompile JavaScript
- [ ] Map out exposed APIs
- [ ] Test Accessibility API
- [ ] Test IME input

### **Week 2: Quick Tests**
- [ ] If API found, implement and test
- [ ] If Accessibility works, implement
- [ ] If IME works, implement
- [ ] Document findings

### **Week 3-4: Decision Point**

**If quick wins worked:**
- ✅ Refine and productionize
- ✅ Done!

**If quick wins failed:**
- ❌ Commit to kernel driver development
- ❌ Or accept hardware solution

### **Month 2-3: Kernel Driver Development**
- [ ] Set up WDK environment
- [ ] Study USB HID examples
- [ ] Build virtual USB bus
- [ ] Implement HID keyboard
- [ ] Test in Test Mode
- [ ] Get code signing certificate
- [ ] Submit for signing
- [ ] Deploy and test

---

## 💡 The Most Likely Winner: Browser Extension API

**Why I think this will work:**

1. **Veraport MUST have an API** - How else does it get the password?
2. **It's in JavaScript** - Easier to reverse engineer than kernel code
3. **Extensions can't hide everything** - Some API must be exposed
4. **It's designed for usability** - Banks need it to work

**What to look for:**
```javascript
// Global objects
window.Veraport
window.VeraportKeyboard
window.SecureInput

// Event handlers
document.addEventListener('veraport-ready', ...)

// Form submission handlers
form.addEventListener('submit', ...)

// Direct API calls
window.parent.postMessage({type: 'secure-input', value: '...'})
```

---

## 🎯 Next Steps

**Choose your path:**

**A) "I want to try quick wins first"**
→ I'll help you extract and analyze Veraport extension

**B) "I want to commit to kernel driver"**
→ I'll provide detailed kernel driver development guide

**C) "I want to try ALL approaches in parallel"**
→ I'll help coordinate multiple research tracks

**What's your preference?** 🚀

# 🕵️ Security Software Investigation Guide

Since pynput failed, we need to identify which security software is blocking us and how deep it monitors.

## 🎯 Goal

Find out:
1. **What** security software is running
2. **Where** it hooks into the system (browser? OS? kernel?)
3. **How** we might bypass or work with it

## 🔧 Tools Provided

### **Option 1: PowerShell Monitor** (Detailed)
```powershell
# Right-click PowerShell → Run as Administrator
powershell -ExecutionPolicy Bypass -File monitor-security-software.ps1
```

**What it does:**
- Monitors processes before/after clicking password field
- Detects new processes, services, drivers
- Checks for known security software names
- Scans Chrome extensions
- Lists loaded DLLs in browser

**Use when:** You want comprehensive analysis

---

### **Option 2: Quick Batch Script** (Simple)
```cmd
quick-process-check.bat
```

**What it does:**
- Lists running processes with security keywords
- Checks running services
- Lists Chrome extensions
- Saves full process list to `processes.txt`

**Use when:** You want quick check

---

## 📋 Step-by-Step Investigation

### **Step 1: Capture Baseline**

1. **Close Chrome completely**
2. **Run the PowerShell script** (as Administrator)
3. Script will capture baseline state

### **Step 2: Trigger Security Software**

1. **Open Chrome**
2. **Navigate to Shinhan Card login page**
3. **Click into the PASSWORD FIELD** (this activates security keyboard)
4. **Wait 2-3 seconds**
5. **Go back to PowerShell and press ENTER**

### **Step 3: Analyze Results**

Look for these in the output:

#### A) **Process Names**
Common Korean banking security software:

| Process Name | Software | Company |
|--------------|----------|---------|
| `npkcrypt.exe`, `npkguard.exe` | nProtect KeyCrypt | INCA Internet |
| `TouchEnKey.exe`, `TKAppl.exe` | TouchEn Key | RaonSecure |
| `veraport.exe`, `VGuard.exe` | Veraport | Wizvera |
| `ipinside.exe` | IPinside | Interezen |
| `DreamSecurity.exe` | KeySharp | Dream Security |
| `ASTxService.exe` | AhnLab Safe Transaction | AhnLab |

#### B) **Service Names**
Look for services with these keywords:
- `nProtect`
- `TouchEn`
- `Veraport`
- `RaonSecure`
- `Wizvera`

#### C) **Kernel Drivers**
**CRITICAL:** If you see new kernel drivers loaded, the security is DEEP.
- Look for `.sys` files in the PathName
- Keywords: `npk`, `touchenc`, `veraport`, `raon`

#### D) **Chrome Extensions**
Check `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\`
- Each folder is an extension ID
- Look for security-related names in manifest.json

---

## 🔍 What to Look For

### **Scenario A: Browser Extension Only**
```
✅ Chrome extension detected
❌ No new processes
❌ No kernel drivers
```

**Meaning:** Security is browser-level only
**Strategy:** Might be able to manipulate the extension or use different browser

### **Scenario B: User-Mode Process**
```
✅ New .exe process started
❌ No kernel drivers
```

**Meaning:** Security runs as normal application
**Strategy:** Process injection, API hooking, or reverse engineering

### **Scenario C: Kernel Driver** 🔴
```
✅ New kernel driver loaded (.sys file)
✅ Deep system integration
```

**Meaning:** Security monitors at kernel level
**Strategy:** Hardware USB device (Rubber Ducky) or official API only

---

## 📊 Common Security Software Details

### **nProtect KeyCrypt (INCA Internet)**

**Components:**
- `npkcrypt.exe` - Main process
- `npkcmsvc.exe` - Service
- `npkdriver.sys` - Kernel driver
- Chrome extension

**Monitoring Level:** Kernel + Browser
**Known Bypasses:** Very difficult, USB hardware or official API

**Documentation:**
- https://www.nprotect.com/

---

### **TouchEn Key (RaonSecure)**

**Components:**
- `TouchEnKey.exe` - Main process
- `tksrvc.exe` - Service
- Browser plugin/extension

**Monitoring Level:** User-mode + Browser
**Known Bypasses:** Some success with API reverse engineering

**Documentation:**
- https://www.raonsecure.com/

---

### **Veraport (Wizvera)**

**Components:**
- `veraport.exe` - Main process
- ActiveX or browser extension

**Monitoring Level:** Browser + possibly OS hooks
**Known Bypasses:** Browser manipulation possible

---

## 🎯 After Identifying the Software

### **Step 1: Google Research**

Search for:
```
"[software name] api documentation"
"[software name] bypass"
"[software name] reverse engineering"
"[software name] keyboard hook"
```

### **Step 2: Check for Official Integration**

Many security software companies offer:
- **Business APIs** for legitimate integration
- **SDK documentation**
- **Support for fintech companies**

Contact their business support:
- "We're building a fintech application"
- "Need legitimate way to integrate with your security keyboard"
- "Request API documentation"

### **Step 3: Analyze the Extension/ActiveX**

If it's browser-based:

1. **Extract extension files:**
   ```
   %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\[extension-id]\
   ```

2. **Look for JavaScript files:**
   - `content_script.js`
   - `background.js`
   - Look for function names, API endpoints

3. **Monitor network traffic:**
   - Use Fiddler or Wireshark
   - See what the security software communicates

4. **Search for API calls:**
   - Look for exposed global objects: `window.TouchEnKey`, `window.nProtect`, etc.
   - Check if they expose typing functions

### **Step 4: Test Browser Injection**

If you find an API in the extension:

```javascript
// In browser console (if it works):
window.SecurityKeyboard.sendPassword('test123');
```

Or from Playwright:
```javascript
await page.evaluate(() => {
  window.TouchEnKey.setPassword('test123');
});
```

---

## 📸 What to Share

After running the monitoring script, share:

1. **List of NEW processes** that started
2. **Any kernel drivers** detected
3. **Chrome extension names** (especially security-related)
4. **Full output** from the PowerShell script
5. **Screenshot** of Shinhan Card password field

With this information, we can:
- Identify the exact security software
- Determine bypass feasibility
- Recommend specific approach (USB hardware, API, reverse engineering)

---

## 🚨 Important Notes

### **DevTools Blocked?**

The security software likely:
- Detects `window.chrome.debugger`
- Hooks F12 keypress
- Monitors for DevTools opening

**Workarounds:**
- Use **Fiddler** or **Wireshark** for network monitoring (external tool)
- Use **Process Monitor** (Sysinternals) to see file/registry activity
- Browser extensions can't block external OS-level monitoring

### **Running as Administrator**

Some checks require admin rights:
- Viewing DLLs loaded in processes
- Accessing kernel driver information
- Full system monitoring

Right-click PowerShell → "Run as Administrator"

### **Legal Considerations**

- ✅ Monitoring your own system: Legal
- ✅ Reverse engineering for interoperability: Generally okay
- ❌ Distributing bypass tools: Gray area
- ❌ Circumventing for fraud: Illegal

We're investigating for **legitimate automation** purposes.

---

## 🎯 Next Steps

1. **Run the monitoring script**
2. **Share the findings** (process names, drivers, extensions)
3. **I'll help identify** the exact security software
4. **We'll determine** the best bypass strategy based on what we find

Ready to investigate? Run the PowerShell script and let's see what we're dealing with! 🔍

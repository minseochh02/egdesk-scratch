# 🪟 Windows Testing Setup Guide

Since Korean banking security keyboards are designed for **Windows**, testing on Windows will give accurate results.

## 📦 Files to Transfer to Windows PC

Copy these files/folders to your Windows machine:

```
test-security-keyboard-levels.js
SECURITY-KEYBOARD-TEST-README.md
src/main/financehub/utils/virtual-hid-keyboard.py
package.json (for dependencies reference)
```

Or simply transfer the entire project folder.

## 🛠️ Windows Setup

### 1. Install Node.js (if not installed)

Download from: https://nodejs.org/
- Use LTS version
- Check installation:
  ```cmd
  node --version
  npm --version
  ```

### 2. Install Python (if not installed)

Download from: https://www.python.org/downloads/
- **IMPORTANT**: Check "Add Python to PATH" during installation
- Check installation:
  ```cmd
  python --version
  ```

### 3. Install Chrome Browser

Download from: https://www.google.com/chrome/
- Must use Chrome (not Edge, not Chromium)
- Security keyboards may behave differently in different browsers

### 4. Install Dependencies

Open Command Prompt in the project folder:

```cmd
REM Install Node.js dependencies
npm install playwright-core

REM Install Python pynput
pip install pynput
```

### 5. Run the Test

```cmd
node test-security-keyboard-levels.js
```

## 🔍 What to Expect on Windows

### Korean Security Keyboard Software

Korean banking sites may install security software like:
- **nProtect KeyCrypt** (TouchEn Key)
- **AhnLab Safe Transaction**
- **Wizvera Veraport**
- **Interezen IPinside**

These programs:
- ✅ Monitor keyboard input at **kernel driver level**
- ✅ Detect automation frameworks
- ✅ Block programmatic input
- ✅ May show warning popups

### Test Results on Windows

Likely outcome:
```
Test 1 (Playwright): ❌ BLOCKED - Automation detected
Test 2 (Direct Fill): ❌ BLOCKED - No keyboard events
Test 3 (DOM Events): ❌ BLOCKED - isTrusted = false
Test 4 (OS-level pynput): ??? - This is what we need to find out!
```

## 🎯 Why This Matters

**If Test 4 (pynput) works on Windows:**
✅ Our current implementation will work!
✅ Security keyboard accepts OS-level input
✅ We're done!

**If Test 4 (pynput) fails on Windows:**
❌ Security monitors at kernel level
❌ Need hardware USB HID emulator
❌ Or need to reverse-engineer security keyboard API

## 📊 After Testing

**Please share:**
1. Screenshot or text output of test results
2. Any security software popups that appear
3. Windows version (Windows 10 or 11)
4. Any error messages

This will tell us exactly what level the security keyboard monitors at!

## 🔧 Troubleshooting

### Error: "Chrome executable not found"

**Solution**: Make sure Chrome is installed (not just Edge)
```cmd
REM Check Chrome installation
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

### Error: "python is not recognized"

**Solution**: Python not in PATH
1. Reinstall Python with "Add to PATH" checked
2. Or manually add Python to PATH

### Error: "pynput import failed"

**Solution**: pynput not installed properly
```cmd
pip install --upgrade pynput
```

### Windows Defender Blocks Script

**Solution**: Add exception for Python or Node.js
1. Windows Security → Virus & threat protection
2. Manage settings → Add or remove exclusions
3. Add folder exception for project directory

## 🚀 Quick Start (Copy-Paste)

```cmd
REM In Command Prompt (run as Administrator if needed)
cd path\to\project
npm install playwright-core
pip install pynput
node test-security-keyboard-levels.js
```

## 💡 Tips

- **Run as Administrator** if you get permission errors
- **Disable antivirus temporarily** if it blocks scripts (re-enable after testing!)
- **Close other browsers** before testing
- **Don't touch keyboard/mouse** during Test 4 (OS-level test)

---

After running the test on Windows, we'll know exactly how to bypass the security keyboard! 🎯

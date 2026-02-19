# Security Keyboard Tests

Two test scripts are available to test Shinhan Card's security keyboard.

## 🎯 Quick Start (Recommended)

```bash
# Install dependencies
npm install playwright-core
pip install pynput  # or pip3 on macOS

# Run simplified test (OS-level only)
node test-pynput-only.js
```

## 📋 Available Tests

### 1. `test-pynput-only.js` ⭐ **RECOMMENDED**

**What it tests**: Only Python pynput (OS-level keyboard input)

**Why use this**:
- ✅ Faster (1 test vs 4 tests)
- ✅ More focused on what matters
- ✅ Clearer results
- ✅ Browser methods are likely blocked anyway

**Run it**:
```bash
node test-pynput-only.js
```

**Output**:
```
✅ SUCCESS! OS-level input (pynput) BYPASSES the security keyboard!
```
or
```
❌ FAILED! OS-level input (pynput) is BLOCKED
```

---

### 2. `test-security-keyboard-levels.js` 📊 **COMPREHENSIVE**

**What it tests**: All 4 input methods
1. Playwright Keyboard API
2. Direct Fill (value manipulation)
3. JavaScript DOM Events
4. Python pynput (OS-level)

**Why use this**:
- 📊 Complete analysis of all methods
- 🔍 Detailed comparison
- 📈 See which methods work/fail

**Run it**:
```bash
node test-security-keyboard-levels.js
```

**Output**: Detailed results for each method

---

## 🪟 Windows vs macOS

### Windows (Recommended for Korean Banking)
Korean security keyboards target Windows, so test results will be most accurate.

```cmd
REM Install dependencies
npm install playwright-core
pip install pynput

REM Run test
node test-pynput-only.js
```

### macOS (Development Testing)
Security keyboards may not be present, but you can test the mechanism.

```bash
# Install dependencies
npm install playwright-core
pip3 install pynput

# Grant accessibility permissions
# 시스템 설정 → 개인 정보 보호 및 보안 → 손쉬운 사용

# Run test
node test-pynput-only.js
```

---

## 📊 Interpreting Results

### ✅ If pynput test SUCCEEDS:
```
Characters captured: 9 / 9
Security keyboard bypassed: ✅ YES!
```

**Meaning**:
- Your Virtual HID implementation works! 🎉
- OS-level input bypasses security keyboard
- No need for hardware solutions
- Ready for production

**Next steps**:
1. Ensure pynput is installed in production
2. Test with real credentials
3. Deploy!

---

### ❌ If pynput test FAILS:
```
Characters captured: 0 / 9
Security keyboard bypassed: ❌ NO
```

**Meaning**:
- Security keyboard blocks OS-level input
- Monitoring at kernel level or deeper
- Current approach won't work

**Possible causes**:
1. **Setup issue** - pynput not working correctly
   - Check Python installation
   - Check accessibility permissions (macOS)
   - Run as Administrator (Windows)

2. **Security is blocking** - Real kernel-level monitoring
   - Need hardware USB HID emulator
   - Or reverse-engineer security keyboard API
   - Or use official API if available

**Next steps**:
1. Verify pynput works on a test website first
2. Check permissions/admin rights
3. If still fails, consider hardware solution

---

## 🔧 Troubleshooting

### "Python not found"
**Windows**: Install Python from https://python.org (check "Add to PATH")
**macOS**: Python3 is pre-installed, use `python3` command

### "pynput not installed"
```bash
# Windows
pip install pynput

# macOS
pip3 install pynput
```

### "Chrome not found"
Download Chrome from: https://www.google.com/chrome/
(Not Edge, not Chromium - must be Chrome)

### "Permission denied" (macOS)
Grant accessibility permissions:
```
시스템 설정 → 개인 정보 보호 및 보안 → 손쉬운 사용 → Terminal
```

### Test hangs during pynput
Don't touch keyboard/mouse for 5 seconds during OS-level input test!

---

## 📈 What the Test Does

1. **Opens Chrome** with production automation flags
2. **Navigates** to Shinhan Card login page
3. **Finds** password field `[id="pwd"]`
4. **Focuses** the field
5. **Types** via Python pynput (OS kernel input)
6. **Checks** if characters were captured
7. **Reports** success or failure

---

## 🎯 Which Test Should I Use?

| Scenario | Use This Test |
|----------|---------------|
| Quick check if solution works | `test-pynput-only.js` ⭐ |
| Need detailed analysis | `test-security-keyboard-levels.js` |
| Windows production test | `test-pynput-only.js` ⭐ |
| macOS development | `test-pynput-only.js` |
| Debugging why it fails | `test-security-keyboard-levels.js` |

**95% of the time**: Use `test-pynput-only.js` ⭐

---

## 💡 Pro Tips

1. **Test on Windows** if possible - Korean security keyboards target Windows
2. **Don't touch keyboard/mouse** during the 5-second typing window
3. **Browser stays open** for 30 seconds after test - inspect manually
4. **Check console output** - detailed logs show what's happening
5. **Run with real credentials** after test succeeds with dummy password

---

## 📞 Need Help?

If tests fail and you're not sure why, check:
1. Dependencies installed? (`python --version`, `pip list | grep pynput`)
2. Permissions granted? (macOS accessibility)
3. Running as admin? (Windows)
4. Chrome installed? (not Edge, not Chromium)
5. Correct URL loaded? (should see Shinhan Card login page)

Share test output for debugging! 🔍

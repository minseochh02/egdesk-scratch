# Security Keyboard Monitoring Level Test

This test suite helps determine **at what level** Shinhan Card's security keyboard monitors and blocks input.

## 🎯 Purpose

Before implementing a bypass, we need to understand:
1. **What level does the security keyboard monitor?**
2. **Which input methods does it accept/block?**
3. **Where should we focus our bypass efforts?**

## 🧪 Test Methods

The suite tests 4 different input levels:

### Test 1: Playwright Keyboard API
- **Level**: Browser automation (CDP protocol)
- **Detection Risk**: Very High
- **How it works**: `page.keyboard.type()`
- **Detectable by**: `navigator.webdriver`, CDP traces

### Test 2: Direct Fill
- **Level**: Direct value manipulation
- **Detection Risk**: Very High
- **How it works**: `element.value = "text"`
- **Detectable by**: No keyboard events fired

### Test 3: JavaScript DOM Events
- **Level**: Browser JavaScript
- **Detection Risk**: High
- **How it works**: `dispatchEvent(new KeyboardEvent(...))`
- **Detectable by**: `isTrusted = false` flag

### Test 4: Python pynput (OS-level)
- **Level**: Operating System kernel input stack
- **Detection Risk**: Low
- **How it works**: Python library creates OS keyboard events
- **Detectable by**: Requires deep kernel monitoring

## 🚀 How to Run

```bash
node test-security-keyboard-levels.js
```

### Prerequisites

For Test 4 (OS-level), you need Python and pynput:

```bash
# Check Python
python3 --version

# Install pynput
pip3 install pynput

# Grant accessibility permissions (macOS)
# System Settings → Privacy & Security → Accessibility
# Add Terminal or your IDE
```

## 📊 Interpreting Results

### Scenario A: All Tests Blocked ❌
```
✅ Accepted: 0/4
❌ Blocked: 4/4
```

**Meaning**: Security keyboard monitors at **kernel level** or deeper
**Solution**:
- Hardware USB HID emulator (USB Rubber Ducky)
- Reverse-engineer security keyboard API
- Use official API

### Scenario B: Only OS-level Works ✅
```
Test 1 (Playwright): ❌ BLOCKED
Test 2 (Direct Fill): ❌ BLOCKED
Test 3 (DOM Events): ❌ BLOCKED
Test 4 (OS-level): ✅ ACCEPTED
```

**Meaning**: Security monitors browser automation but accepts OS keyboard
**Solution**: Use Python pynput (already implemented!)

### Scenario C: DOM Events Work ✅
```
Test 1 (Playwright): ❌ BLOCKED
Test 2 (Direct Fill): ❌ BLOCKED
Test 3 (DOM Events): ✅ ACCEPTED
Test 4 (OS-level): ✅ ACCEPTED
```

**Meaning**: Security only checks for `navigator.webdriver`
**Solution**: Hide automation flags, use DOM events

### Scenario D: Everything Works ✅
```
All tests: ✅ ACCEPTED
```

**Meaning**: Security keyboard is not active or not monitoring
**Solution**: Use simplest method (Playwright keyboard)

## 🔍 What the Test Does

1. **Opens Shinhan Card website**
2. **Finds the password field**
3. **Analyzes the field** (classes, attributes, security markers)
4. **Tries each input method** one by one
5. **Checks if characters were captured**
6. **Provides recommendations** based on results

## ⚠️ Important Notes

- **Test 4 requires you to NOT touch keyboard/mouse** for 5 seconds
- Browser stays open for 30 seconds after tests for manual inspection
- Results show exact characters captured by each method
- Run with `headless: false` to see what's happening

## 📈 Expected Output

```
═══════════════════════════════════════════════════════════════════
🔬 Security Keyboard Monitoring Level Test Suite
═══════════════════════════════════════════════════════════════════

📋 Test 1: Playwright Keyboard API
   Result: ❌ BLOCKED
   Value captured: "" (length: 0)

📋 Test 2: Direct Fill
   Result: ❌ BLOCKED
   Value captured: "" (length: 0)

📋 Test 3: JavaScript DOM Events
   Result: ❌ BLOCKED
   Value captured: "" (length: 0)

📋 Test 4: Python pynput (OS-level keyboard events)
   ⚠️  IMPORTANT: Do NOT touch keyboard/mouse for 5 seconds!
   Result: ✅ ACCEPTED
   Value captured: "Test123" (length: 7)

═══════════════════════════════════════════════════════════════════
📊 Test Results Summary
═══════════════════════════════════════════════════════════════════

✅ Accepted Methods: 1/4
❌ Blocked Methods: 3/4

🟢 SOME METHODS WORK!
   Working methods:
   ✅ Python pynput (OS Kernel Input Stack)

   Recommendation: Use the lowest-level working method
```

## 🛠️ Next Steps

After running this test, you'll know exactly:
1. Which bypass method to use
2. Whether current implementation will work
3. If you need hardware solutions
4. Where the security monitoring happens

Run the test and share the results!

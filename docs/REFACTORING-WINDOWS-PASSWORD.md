# Windows Password Input Refactoring Plan

**Date**: 2026-01-19
**Status**: ✅ **COMPLETED**
**Impact**: ~375 lines of duplication eliminated

---

## 🔴 Problem: Massive Duplication

### 1. Duplicate Utility Files (322 lines × 2 = 644 lines!)

**File**: `windowsKeyboardInput.js`
- `banks/shinhan/windowsKeyboardInput.js` - 322 lines
- `banks/nh/windowsKeyboardInput.js` - 322 lines

**Diff Result**: 99% identical! Only difference is default parameter:
```diff
- async function typePasswordWithKeyboard(page, password, delays, log, passwordSelector) {
+ async function typePasswordWithKeyboard(page, password, delays, log, passwordSelector = '//input[@id="loginUserPwd"]') {
```

**Content**:
- `isWindows()` - Platform check
- `typePasswordWithKeyboard()` - Keyboard.type method
- `typePasswordWithFill()` - Fill method
- `typePasswordWithClipboard()` - Clipboard paste method
- `handleWindowsPasswordInput()` - Smart fallback handler (tries all 3 methods)

### 2. Duplicate Wrapper Methods (~30 lines × 2 = 60 lines)

**Shinhan** (lines 129-159):
```javascript
async handleWindowsPasswordInput(page, password) {
  try {
    this.log('Using Windows keyboard input for password entry...');

    const typingResult = await handleWindowsPasswordInput(
      page,
      password,
      this.config.delays,
      this.log.bind(this),
      this.config.windowsInputMethod || 'auto',
      this.config.xpaths.passwordInput
    );

    return {
      ...typingResult,
      keyboardAnalysis: null,
    };
  } catch (error) {
    this.error('Windows keyboard password typing failed:', error.message);
    return { /* error object */ };
  }
}
```

**NH** (lines 81-111):
```javascript
async handleWindowsPasswordInput(page, password) {
  // IDENTICAL to Shinhan
}
```

### 3. Duplicate Platform Branching Logic (~23 lines × 2 = 46 lines)

**Shinhan** (lines 99-121):
```javascript
async handlePasswordInput(page, password) {
  try {
    if (isWindows() && this.config.useWindowsKeyboard !== false) {
      this.log('Windows platform detected, using keyboard input method...');
      return await this.handleWindowsPasswordInput(page, password);
    } else {
      this.log('Using virtual keyboard method...');
      return await this.handleVirtualKeyboard(page, password);
    }
  } catch (error) {
    this.error('Password input failed:', error.message);
    return { /* error object */ };
  }
}
```

**NH** (lines 51-73):
```javascript
async handlePasswordInput(page, password) {
  // IDENTICAL to Shinhan
}
```

---

## 🎯 Solution

### Step 1: Move Utility to Shared Location

Move `windowsKeyboardInput.js` to `utils/windowsKeyboardInput.js`

**Impact**: Eliminates 322 duplicate lines

### Step 2: Add Methods to BaseBankAutomator

Add two methods to `BaseBankAutomator`:

```javascript
/**
 * Handles password input based on platform
 * Windows: Uses keyboard input
 * Other: Uses virtual keyboard
 */
async handlePasswordInput(page, password) {
  try {
    if (this.isWindows() && this.config.useWindowsKeyboard !== false) {
      this.log('Windows platform detected, using keyboard input method...');
      return await this.handleWindowsPasswordInput(page, password);
    } else {
      this.log('Using virtual keyboard method...');
      return await this.handleVirtualKeyboard(page, password);
    }
  } catch (error) {
    this.error('Password input failed:', error.message);
    return this.createPasswordErrorResult(password.length, error.message);
  }
}

/**
 * Windows keyboard input handler
 */
async handleWindowsPasswordInput(page, password) {
  try {
    this.log('Using Windows keyboard input for password entry...');

    const typingResult = await handleWindowsPasswordInput(
      page,
      password,
      this.config.delays,
      this.log.bind(this),
      this.config.windowsInputMethod || 'auto',
      this.config.xpaths.passwordInput
    );

    return {
      ...typingResult,
      keyboardAnalysis: null,
    };
  } catch (error) {
    this.error('Windows keyboard password typing failed:', error.message);
    return this.createPasswordErrorResult(password.length, error.message, 'windows_keyboard_failed');
  }
}

/**
 * Platform check helper
 */
isWindows() {
  return os.platform() === 'win32';
}

/**
 * Creates standardized error result for password operations
 */
createPasswordErrorResult(passwordLength, errorMessage, method = 'unknown') {
  return {
    success: false,
    error: errorMessage,
    totalChars: passwordLength,
    typedChars: 0,
    failedChars: [],
    shiftClicks: 0,
    details: [],
    method: method
  };
}
```

**Impact**: Eliminates ~53 lines of duplication from banks

### Step 3: Update Bank Automators

Remove all Windows password handling code from banks:

**Shinhan**: Remove lines 99-159 (~60 lines)
**NH**: Remove lines 51-111 (~60 lines)

Update imports to use shared utility.

---

## 📊 Impact Analysis

### Before Refactoring

| Component | Shinhan | NH | Total |
|-----------|---------|-----|-------|
| `windowsKeyboardInput.js` | 322 lines | 322 lines | 644 lines |
| `handlePasswordInput()` | 23 lines | 23 lines | 46 lines |
| `handleWindowsPasswordInput()` | 30 lines | 30 lines | 60 lines |
| **Subtotal per bank** | **375 lines** | **375 lines** | **750 lines** |

### After Refactoring

| Component | Location | Lines |
|-----------|----------|-------|
| `windowsKeyboardInput.js` | `utils/` (shared) | 322 lines |
| `handlePasswordInput()` | `BaseBankAutomator` | 23 lines |
| `handleWindowsPasswordInput()` | `BaseBankAutomator` | 30 lines |
| `isWindows()` | `BaseBankAutomator` | 3 lines |
| `createPasswordErrorResult()` | `BaseBankAutomator` | 15 lines |
| **Total** | **Shared code** | **393 lines** |

**Savings**: 750 - 393 = **357 lines eliminated** (48% reduction)

---

## 🚀 Implementation Steps

### 1. Move Utility to Shared Location

```bash
# Move Shinhan version to utils (it's already generic)
mv src/main/financehub/banks/shinhan/windowsKeyboardInput.js \
   src/main/financehub/utils/windowsKeyboardInput.js

# Delete NH duplicate
rm src/main/financehub/banks/nh/windowsKeyboardInput.js
```

### 2. Add to BaseBankAutomator

Add 4 new methods:
- `isWindows()` - Platform detection
- `handlePasswordInput()` - Platform branching logic
- `handleWindowsPasswordInput()` - Windows wrapper
- `createPasswordErrorResult()` - Error result builder

### 3. Update Bank Automators

**Shinhan**:
- Remove `handlePasswordInput()` method
- Remove `handleWindowsPasswordInput()` method
- Update import: `require('../../utils/windowsKeyboardInput')`

**NH**:
- Remove `handlePasswordInput()` method
- Remove `handleWindowsPasswordInput()` method
- Update import: `require('../../utils/windowsKeyboardInput')`

### 4. Update Utils Index

Add to `utils/index.js`:
```javascript
const windowsKeyboardInput = require('./windowsKeyboardInput');

module.exports = {
  // ... existing exports
  ...windowsKeyboardInput,
};
```

---

## ✅ Benefits

### Code Quality
- ✅ **Single source of truth** - One utility file instead of two
- ✅ **DRY principle** - No duplicated branching logic
- ✅ **Consistent behavior** - All banks use same Windows input methods

### Maintainability
- ✅ **Fix once** - Windows keyboard bugs fixed in one place
- ✅ **Easier testing** - Test utility once, not per bank
- ✅ **Less confusion** - Clear where Windows logic lives

### Extensibility
- ✅ **New banks** - Inherit Windows support automatically
- ✅ **Method improvements** - All banks benefit immediately
- ✅ **Platform detection** - Centralized and consistent

---

## 🧪 Testing Strategy

### Unit Tests

```javascript
describe('BaseBankAutomator - Windows Password Input', () => {
  describe('isWindows', () => {
    it('should return true on Windows platform');
    it('should return false on macOS');
    it('should return false on Linux');
  });

  describe('handlePasswordInput', () => {
    it('should use Windows method on Windows if enabled');
    it('should use virtual keyboard on non-Windows');
    it('should respect useWindowsKeyboard config flag');
    it('should handle errors gracefully');
  });

  describe('handleWindowsPasswordInput', () => {
    it('should pass correct parameters to utility');
    it('should use config delays');
    it('should use config passwordInput selector');
    it('should use config windowsInputMethod');
  });

  describe('createPasswordErrorResult', () => {
    it('should create standardized error object');
    it('should include method name');
  });
});
```

### Integration Tests

```javascript
describe('Windows Password Integration', () => {
  beforeEach(() => {
    // Mock Windows platform
    jest.spyOn(os, 'platform').mockReturnValue('win32');
  });

  it('Shinhan should use Windows keyboard on Windows');
  it('NH should use Windows keyboard on Windows');
  it('Kookmin should use Windows keyboard on Windows');

  it('should fall back to virtual keyboard on macOS');
});
```

---

## 🎯 Refactoring Checklist

- [ ] Move `windowsKeyboardInput.js` to `utils/`
- [ ] Delete duplicate from `banks/nh/`
- [ ] Add `isWindows()` to `BaseBankAutomator`
- [ ] Add `handlePasswordInput()` to `BaseBankAutomator`
- [ ] Add `handleWindowsPasswordInput()` to `BaseBankAutomator`
- [ ] Add `createPasswordErrorResult()` to `BaseBankAutomator`
- [ ] Remove methods from `ShinhanBankAutomator`
- [ ] Remove methods from `NHBankAutomator`
- [ ] Update imports in Shinhan
- [ ] Update imports in NH
- [ ] Update `utils/index.js` exports
- [ ] Test Shinhan on Windows
- [ ] Test NH on Windows
- [ ] Test all banks on macOS (should use virtual keyboard)

---

## 📁 File Structure (After)

```
financehub/
├── utils/
│   ├── windowsKeyboardInput.js      [MOVED HERE - shared by all]
│   └── index.js                     [Updated exports]
├── core/
│   └── BaseBankAutomator.js         [+4 new methods]
└── banks/
    ├── shinhan/
    │   ├── ShinhanBankAutomator.js  [-60 lines, updated import]
    │   └── windowsKeyboardInput.js  [DELETED]
    └── nh/
        ├── NHBankAutomator.js       [-60 lines, updated import]
        └── windowsKeyboardInput.js  [DELETED]
```

---

## 🎓 Design Pattern

**Strategy Pattern** - Select input method based on platform:

```
BaseBankAutomator.handlePasswordInput()
  ├─ Platform check (isWindows())
  │
  ├─ Windows → handleWindowsPasswordInput()
  │   └─ utils/windowsKeyboardInput
  │       ├─ Try keyboard.type()
  │       ├─ Fallback: fill()
  │       └─ Fallback: clipboard paste()
  │
  └─ Other → handleVirtualKeyboard()
      └─ analyzeVirtualKeyboard() + click keys
```

---

## ⚠️ Edge Cases

### 1. NH Business Bank
- Uses certificate authentication
- Has custom Windows password implementation for certificate password
- **Keep its custom implementation** (different use case)

### 2. Config Override
Banks can disable Windows keyboard:
```javascript
config: {
  useWindowsKeyboard: false  // Force virtual keyboard even on Windows
}
```

### 3. Method Preference
Banks can prefer specific Windows method:
```javascript
config: {
  windowsInputMethod: 'clipboard'  // or 'keyboard', 'fill', 'auto'
}
```

---

## 🎉 Expected Results

After refactoring:

✅ **357 lines eliminated** from bank-specific code
✅ **1 shared utility** instead of 2 duplicates
✅ **Platform detection** centralized in base class
✅ **Automatic Windows support** for all banks
✅ **Consistent error handling** across all banks

---

## ✅ Implementation Completed

1. ✅ Created refactoring plan
2. ✅ Moved `windowsKeyboardInput.js` to `utils/`
3. ✅ Added 4 methods to `BaseBankAutomator`:
   - `isWindows()` - Platform detection
   - `handlePasswordInput()` - Platform branching logic
   - `handleWindowsPasswordInput()` - Windows wrapper
   - `createPasswordErrorResult()` - Error result builder
4. ✅ Removed duplicates from `ShinhanBankAutomator` (~60 lines)
5. ✅ Removed duplicates from `NHBankAutomator` (~60 lines)
6. ✅ Updated imports in both banks
7. ✅ Deleted duplicate files:
   - `banks/shinhan/windowsKeyboardInput.js`
   - `banks/nh/windowsKeyboardInput.js`
8. ✅ Updated `utils/index.js` to export Windows keyboard utilities

---

## 📊 Combined Impact (Virtual Keyboard + Windows Password)

| Refactoring | Lines Eliminated |
|-------------|-----------------|
| Virtual keyboard analysis | 310 lines |
| Windows password handling | 357 lines |
| **TOTAL** | **667 lines** |

**Before**: 1,417 lines of bank-specific code
**After**: 750 lines of shared code
**Savings**: 47% reduction!

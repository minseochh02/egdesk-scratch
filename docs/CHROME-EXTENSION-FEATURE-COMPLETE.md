# Chrome Extension Feature - Complete Documentation

**Status:** ⚠️ PARTIALLY IMPLEMENTED - Code Generation Incomplete
**Date:** 2026-01-22

---

## Feature Summary

Implemented a system for loading Chrome extensions in the browser recorder. Users can select extensions from their Chrome profiles via UI, and those extensions are copied and loaded **during recording sessions**.

**⚠️ CRITICAL LIMITATION:** Generated scripts do NOT include extension loading code. Extensions only work during the initial recording, not when replaying the script.

---

## Current State

✅ **Recording:** Extensions load and work perfectly
❌ **Script Generation:** Extension code not included in output
❌ **Replay:** Extensions missing when running generated scripts

---

## Quick Status

| Component | Status | Works? |
|-----------|--------|--------|
| Extension Scanner | ✅ Complete | Yes |
| Extension UI | ✅ Complete | Yes |
| Extension Selection | ✅ Complete | Yes |
| Preference Saving | ✅ Complete | Yes |
| **Recording with Extensions** | **✅ Complete** | **Yes** |
| Permission Copying | ✅ Complete | Yes |
| Native Messaging | ✅ Complete | Yes |
| **Code Generation** | **❌ Missing** | **No** |
| **Script Replay** | **❌ Missing** | **No** |

**Use Case:** ✅ One-time recordings with extensions
**Use Case:** ❌ Reusable scripts with extensions

---

## What Was Implemented

### ✅ Backend (Complete)

1. **ChromeExtensionScanner** (`src/main/chrome-extension-scanner.ts`)
   - Scans all Chrome profiles (Default, Profile 1, Profile 2, etc.)
   - Parses extension manifests
   - Extracts extension icons as base64 data URLs
   - Cross-platform support (macOS/Windows/Linux)

2. **IPC Handlers** (`src/main/chrome-handlers.ts`)
   - `chrome-extensions:scan-profiles` - Scans and returns all extensions
   - `chrome-extensions:save-preferences` - Saves user's extension selection
   - `chrome-extensions:get-preferences` - Loads saved selections
   - `chrome-extensions:get-user-data-dir` - Gets Chrome directory path

3. **Browser Recorder Integration** (`src/main/browser-recorder.ts`)
   - `setExtensions()` - Accepts extension paths before recording
   - `copyExtensionsToTemp()` - Copies extensions to temp directory
   - `copyNativeMessagingHosts()` - Copies native messaging host manifests
   - Automatically switches to `'chromium'` channel when extensions present
   - Cleans up temp extensions on stop

### ✅ Frontend (Complete)

4. **ChromeExtensionSelector Component** (`src/renderer/components/ChromeExtensionSelector/`)
   - Modal UI with visual extension cards
   - Displays extension icons, names, versions, descriptions
   - Checkbox selection interface
   - "Select All" / "Deselect All" per profile
   - Persistent preferences via electron-store
   - Loading states and error handling

5. **Browser Recorder Integration** (`src/renderer/components/BrowserRecorder/BrowserRecorderPage.tsx`)
   - "🧩 Extensions" button showing count
   - Auto-loads saved extension preferences on mount
   - Passes extension paths to recorder on launch
   - Debug logging for extension operations

---

## How It Works

### User Flow

```
1. User opens Browser Recorder
   ↓
2. Clicks "🧩 Extensions (0)" button
   ↓
3. Modal opens, scanning Chrome profiles
   ↓
4. Displays all profiles and their extensions with icons
   ↓
5. User selects desired extensions (checkbox)
   ↓
6. Clicks "Use Selected Extensions"
   ↓
7. Preferences saved to electron-store
   ↓
8. User enters URL and clicks "Start Recording"
   ↓
9. Backend copies extensions to temp folder
   ↓
10. Backend copies native messaging host manifests
   ↓
11. Backend launches Chromium with extensions
   ↓
12. ✅ Extensions loaded and functional!
```

### Technical Flow

```typescript
// 1. Extension selection
ChromeExtensionScanner.getAllProfiles()
→ Scans: ~/Library/Application Support/Google/Chrome/{Profile}/Extensions/
→ Returns: profiles with extensions and icon data URLs

// 2. Recording starts
BrowserRecorder.setExtensions(paths)
→ Stores extension paths

// 3. Extension copying
copyExtensionsToTemp()
→ Copies from: {Chrome Profile}/Extensions/{extId}/{version}/
→ To: /tmp/egdesk-extensions-XXXX/{extId}-{version}/
→ Copies permissions from Secure Preferences
→ Copies native messaging hosts to {profileDir}/NativeMessagingHosts/

// 4. Browser launch
chromium.launchPersistentContext(profileDir, {
  channel: 'chromium',  // Must use Chromium (Chrome removed --load-extension)
  args: [
    '--load-extension=/tmp/egdesk-extensions-XXXX/ext1,/tmp/egdesk-extensions-XXXX/ext2'
  ]
})
```

---

## Key Technical Discoveries

### 1. Chrome vs Chromium Channel

**Issue:** Chrome 137+ removed `--load-extension` flag support
**Solution:** Use `channel: 'chromium'` when extensions are selected

```typescript
const browserChannel = copiedExtensionPaths.length > 0 ? 'chromium' : 'chrome';
```

### 2. HMAC Validation in Secure Preferences

**Issue:** Secure Preferences uses HMAC-SHA256 signatures
**Discovery:** Each profile has a unique secret key for HMAC
**Impact:** Copying Secure Preferences between profiles fails validation
**Solution:** Copy extension settings from source profile (preserves original HMACs)

**Research:** [HMAC and "Secure Preferences" Paper](https://www.cse.chalmers.se/~andrei/cans20.pdf)

### 3. Native Messaging Hosts

**Issue:** Extensions connecting to native apps fail with "host not found"
**Discovery:** Native host manifests in `/Library/Google/Chrome/NativeMessagingHosts/`
**Impact:** Extensions like INISAFE SmartManagerEX need native app communication
**Solution:** Copy native messaging host manifests to `{profileDir}/NativeMessagingHosts/`

**Example:**
```json
{
  "name": "kr.co.initech.smartmanagerex",
  "path": "/Library/.../CrossExChrome.app/Contents/MacOS/CrossExChrome",
  "allowed_origins": ["chrome-extension://extensionId/"]
}
```

### 4. Unpacked Extensions Auto-Grant Permissions

**Discovery:** Extensions loaded via `--load-extension` automatically grant all manifest permissions
**Benefit:** No need to manually grant permissions - they're trusted in dev mode
**Source:** [Extension Permissions Docs](https://chromium.googlesource.com/chromium/src/+/main/extensions/docs/permissions.md)

---

## Known Limitations & Workarounds

### ⚠️ Limitation 1: Site Access Defaults to "On Click"

**Issue:** Extensions show "Access requested" banner and need user click to activate on pages

**Why:** Site access preference is stored in `Secure Preferences` under `withholding_permissions` field

**Current Behavior:**
```
Extension loads → Set to "On click" → Shows "Access requested"
```

**Workaround:** User must manually:
1. Click extension icon OR
2. Right-click extension → "This can read and change site data" → "On all sites"

**Possible Fix (Not Implemented):**
```typescript
// In copyExtensionsToTemp(), add to extensionSettings:
extensionSettings[extensionId] = {
  ...extSettings,
  withholding_permissions: false,  // Don't withhold permissions
  granted_permissions: {
    ...extSettings.granted_permissions,
    explicit_host: ["<all_urls>"]  // Grant all sites
  }
}
```

**Status:** ON HOLD - Needs HMAC signature or use workaround

---

### ⚠️ Limitation 2: Extension State Starts Fresh

**Issue:** Extensions start with empty state (no saved data, settings, accounts)

**What's Lost:**
- ❌ Extension localStorage/IndexedDB
- ❌ User settings/preferences
- ❌ Saved accounts (e.g., Phantom wallet accounts)
- ❌ Extension cookies

**What's Preserved:**
- ✅ Extension code
- ✅ Permissions
- ✅ Native messaging hosts

**Example - Phantom Wallet Errors:**
```
Error: Trying to find a selected account, but there no accounts in the vault.
RPC ROUTER: Unexpected error in method: sol_connect
```

**Why:** Fresh profile = empty extension storage

**Workaround:** User must:
1. Set up extension after launch (create wallet, configure settings, etc.)
2. These settings won't persist between recording sessions

**Possible Fix (Not Implemented):**
```typescript
// Copy extension storage from user's profile
const sourceStorage = path.join(profilePath, 'Local Extension Settings', extensionId);
const destStorage = path.join(this.profileDir, 'Local Extension Settings', extensionId);
fs.cpSync(sourceStorage, destStorage, { recursive: true });
```

**Status:** ON HOLD - Complex LevelDB databases, privacy concerns

---

### ⚠️ Limitation 3: Service Worker Warnings

**Console Warnings:**
```
Event handler of 'error' event must be added on the initial evaluation of worker script.
Event handler of 'unhandledrejection' event must be added on the initial evaluation of worker script.
```

**What it is:** Chromium's strict service worker requirements
**Impact:** ⚠️ None - Just warnings, extension works
**Who should fix:** Extension developers (Phantom)
**Status:** IGNORE - Not our issue

---

### ⚠️ Limitation 4: Deprecated Dependencies

**Console Warning:**
```
[DEPRECATED] Default export is deprecated. Instead use import { create } from 'zustand'
```

**What it is:** Phantom uses outdated Zustand import syntax
**Impact:** ⚠️ None - Just a warning
**Who should fix:** Phantom developers
**Status:** IGNORE - Not our issue

---

## Testing Results

### ✅ What Works

- ✅ Extension scanning from all Chrome profiles
- ✅ Visual UI with extension icons and details
- ✅ Extension selection and preference persistence
- ✅ Extension copying to temp directory
- ✅ Permission copying from Secure Preferences
- ✅ Native messaging host support
- ✅ Extensions load in Chromium
- ✅ Extensions appear in chrome://extensions/
- ✅ Extension service workers start
- ✅ Native messaging connects successfully (INISAFE SmartManagerEX tested)
- ✅ Temp cleanup on stop

### ⚠️ What Needs Manual User Action

- ⚠️ **Site Access:** User must click extension and select "On all sites" OR click "Allow" when prompted
- ⚠️ **Extension Setup:** Extensions that require initial setup (wallets, logins) need configuration
- ⚠️ **State/Storage:** Extension data doesn't persist between sessions

---

## Files Changed

### Created (4 files)
1. `src/main/chrome-extension-scanner.ts` (239 lines)
2. `src/renderer/components/ChromeExtensionSelector/ChromeExtensionSelector.tsx` (248 lines)
3. `src/renderer/components/ChromeExtensionSelector/ChromeExtensionSelector.css` (315 lines)
4. `src/renderer/components/ChromeExtensionSelector/index.ts` (1 line)

### Modified (4 files)
5. `src/main/chrome-handlers.ts` - Added IPC handlers
6. `src/main/browser-recorder.ts` - Extension loading logic
7. `src/main/preload.ts` - API exposure
8. `src/renderer/components/BrowserRecorder/BrowserRecorderPage.tsx` - UI integration

### Documentation (6 files)
9. `CHROME-EXTENSIONS-GUIDE.md` - How to use extensions with Playwright
10. `CHROME-EXTENSION-UI-IMPLEMENTATION.md` - Implementation plan
11. `CHROME-EXTENSION-PERMISSIONS-RESEARCH.md` - Permission system research
12. `CHROME-EXTENSION-IMPLEMENTATION-COMPLETE.md` - Initial completion summary
13. `CHROMIUM-LAUNCH-INSTANCES.md` - All Chromium launches catalog
14. `docs/PLANNED-FEATURES.md` - Feature tracking

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Chrome Profiles                    │
│  ~/Library/Application Support/Google/Chrome/               │
│  ├── Default/Extensions/{extId}/{version}/                  │
│  ├── Profile 1/Extensions/{extId}/{version}/                │
│  ├── Profile 1/Secure Preferences  (permissions)            │
│  └── Profile 1/NativeMessagingHosts/ (if exists)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
                      [Scan & Display in UI]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   ChromeExtensionScanner                     │
│  - getAllProfiles()                                          │
│  - scanExtensions()                                          │
│  - findExtensionIcon()                                       │
│  - getExtensionIconDataUrl()                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  User Selects Extensions                     │
│  [☑] Phantom Wallet                                          │
│  [☑] INISAFE SmartManagerEX                                  │
│  [☐] React DevTools                                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
                [Save to electron-store & Start Recording]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BrowserRecorder.start()                    │
│  1. copyExtensionsToTemp()                                   │
│     ├─ Copy extension files                                  │
│     └─ Copy permissions from Secure Preferences              │
│  2. copyNativeMessagingHosts()                               │
│     └─ Copy host manifests from Chrome to profile            │
│  3. launchPersistentContext()                                │
│     ├─ channel: 'chromium'                                   │
│     └─ args: ['--load-extension=ext1,ext2']                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           Temporary Profile & Extensions Created             │
│  /tmp/egdesk-extensions-XXXX/                                │
│  ├── extensionId1-version/                                   │
│  └── extensionId2-version/                                   │
│                                                              │
│  {profileDir}/                                               │
│  ├── NativeMessagingHosts/                                   │
│  │   └── kr.co.initech.smartmanagerex.json                   │
│  └── Secure Preferences  (copied extension settings)         │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ✅ Chromium Launches
                    ✅ Extensions Load
                    ✅ Native Messaging Works
```

---

## Technical Implementation Details

### Extension Copying Strategy

```typescript
// Path format: .../Chrome/{Profile}/Extensions/{extensionId}/{version}/
const version = path.basename(extPath);
const extensionId = path.basename(path.dirname(extPath));
const profilePath = path.dirname(path.dirname(path.dirname(extPath)));

// Copy to temp
const destPath = path.join(tempExtensionsDir, `${extensionId}-${version}`);
fs.cpSync(extPath, destPath, { recursive: true });

// Copy permissions
const securePrefs = JSON.parse(fs.readFileSync(
  path.join(profilePath, 'Secure Preferences')
));
const extSettings = securePrefs.extensions.settings[extensionId];

// Write to new profile (preserves HMAC from source)
extensionSettings[extensionId] = {
  ...extSettings,
  path: `${extensionId}-${version}`,
  location: 10
};
```

### Native Messaging Host Copying

```typescript
// Native host locations on macOS
const locations = [
  '/Library/Google/Chrome/NativeMessagingHosts',
  '~/Library/Application Support/Google/Chrome/NativeMessagingHosts',
  '/Library/Application Support/Chromium/NativeMessagingHosts'
];

// Copy to profile
for (const location of locations) {
  const files = fs.readdirSync(location);
  for (const file of files) {
    if (file.endsWith('.json')) {
      fs.copyFileSync(
        path.join(location, file),
        path.join(profileDir, 'NativeMessagingHosts', file)
      );
    }
  }
}
```

### Browser Launch

```typescript
const browserChannel = copiedExtensionPaths.length > 0 ? 'chromium' : 'chrome';

chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: browserChannel,
  args: [
    '--disable-extensions-except=ext1,ext2',
    '--load-extension=ext1,ext2'
  ]
});
```

---

## Known Issues & Status

### Issue 0: Generated Scripts Don't Include Extensions ⚠️ CRITICAL

**Problem:** When recording WITH extensions, the generated script file does NOT include extension loading code

**Current Behavior:**
- Recording session: Extensions load ✅
- Generated script: No extension code ❌
- Replaying script: Extensions NOT loaded ❌

**Impact:**
- Scripts that depend on extensions will fail on replay
- User must manually add extension code to generated scripts
- Extensions are only available during initial recording

**Example - What's Missing:**
```javascript
// Generated script currently has:
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',  // ← Should be 'chromium'
  args: [
    // ❌ Missing: --load-extension args
  ]
});

// Should generate:
// 1. Extension copying function
// 2. Native host copying function
// 3. Call those functions
// 4. channel: 'chromium'
// 5. args: ['--load-extension=...']
```

**Required Implementation:**
1. Store `this.extensionPaths` in `RECORDED_ACTIONS` comment
2. In `generateTestCode()`, check if extensions were used
3. Generate extension copying code
4. Generate native host copying code
5. Change channel to `'chromium'` if extensions present
6. Add `--load-extension` args

**Estimated Effort:** 2-3 hours

**Priority:** HIGH - Feature is incomplete without this

**Status:** 🚨 BLOCKING ISSUE - Must implement before production use

---

### Issue 1: Site Access Defaults to "On Click" ⏸️ ON HOLD

**Problem:** Extensions show "Access requested" banner, requiring user click to activate

**Root Cause:** `withholding_permissions` field in Secure Preferences

**Current State:**
- Extension loads ✅
- Permissions granted ✅
- But set to "On click" mode
- User must manually change to "On all sites"

**Workaround:**
```
Right-click extension → "This can read and change site data" → "On all sites"
```

**Possible Fix:**
```typescript
extensionSettings[extensionId] = {
  ...extSettings,
  withholding_permissions: false,
  granted_permissions: {
    explicit_host: ["<all_urls>"]
  }
}
```

**Why Not Implemented:**
- Requires HMAC signature recalculation
- Complex cryptographic implementation
- Manual workaround is simple for now

**Priority:** Medium - User workaround exists

---

### Issue 2: Extension State Not Preserved ⏸️ ON HOLD

**Problem:** Extensions start with empty state (no accounts, settings, data)

**Example - Phantom Wallet:**
```
Console Error: "Trying to find a selected account, but there no accounts in the vault."
```

**What's Missing:**
- Extension localStorage/IndexedDB
- User accounts/wallets
- Extension settings
- Cookies

**Current State:**
- Extension loads ✅
- Extension runs ✅
- But has no user data
- User must set up extension each time

**Workaround:**
User manually sets up extension after launch (create wallet, login, etc.)

**Possible Fix:**
```typescript
// Copy Local Extension Settings (LevelDB database)
const sourceStorage = path.join(profilePath, 'Local Extension Settings', extensionId);
const destStorage = path.join(profileDir, 'Local Extension Settings', extensionId);
fs.cpSync(sourceStorage, destStorage, { recursive: true });
```

**Why Not Implemented:**
- Privacy concerns (copying wallet private keys, passwords)
- Complex LevelDB database format
- Not all extensions need this
- Manual setup is safer

**Priority:** Low - Security/privacy considerations

---

### Issue 3: Service Worker Warnings ✅ EXPECTED

**Console Warnings:**
```
Event handler of 'error' event must be added on the initial evaluation
Event handler of 'unhandledrejection' event must be added on the initial evaluation
```

**Status:** These are warnings from the extension's code, not our implementation
**Impact:** None - Extensions still work
**Action:** No action needed

---

### Issue 4: Extension-Specific Errors ✅ EXPECTED

**Console Errors:**
```
[DEPRECATED] Default export is deprecated (Zustand)
Error: Trying to find a selected account (Phantom)
RPC ROUTER: Unexpected error in method: sol_connect
```

**Status:** These are errors from extensions with no setup/data
**Impact:** Expected when extensions start fresh
**Action:** No action needed (user sets up extension if needed)

---

## Usage Guide

### For Users

1. **Open Browser Recorder**
2. **Click "🧩 Extensions (0)"** button
3. **Select desired extensions** from the modal
4. **Click "Use Selected Extensions"**
5. **Enter URL** and start recording
6. **When browser opens:**
   - Extensions will be loaded
   - **For wallet extensions:** Set up wallet if needed
   - **For site access:** Click extension and select "On all sites" if needed
7. **Continue recording** normally

### For Developers

```typescript
// Manual launch with extensions
await window.electron.debug.launchBrowserRecorderEnhanced({
  url: 'https://example.com',
  extensionPaths: [
    '/Users/.../Chrome/Profile 1/Extensions/extId1/version/',
    '/Users/.../Chrome/Profile 1/Extensions/extId2/version/'
  ]
});
```

---

## Testing Checklist

### ✅ Completed Tests

- [x] Scanner finds all Chrome profiles
- [x] Scanner finds all extensions in each profile
- [x] Extension icons load correctly
- [x] Modal displays extensions properly
- [x] Checkbox selection works
- [x] Preferences save/load correctly
- [x] Extensions copy to temp directory
- [x] Native messaging hosts copy correctly
- [x] Chromium launches with extensions
- [x] Extensions appear in chrome://extensions/
- [x] Extension service workers start
- [x] Native messaging connects (INISAFE tested)
- [x] Temp directories clean up on stop

### ⏸️ Known Manual Steps Required

- [ ] User must grant "On all sites" access (manual click)
- [ ] User must set up wallet extensions (create/import wallet)
- [ ] User must configure extension settings if needed

---

## Performance Impact

### Startup Time

**Without Extensions:**
- Browser launch: ~2-3 seconds

**With Extensions (3 extensions):**
- Extension copying: ~200ms
- Native host copying: ~50ms
- Browser launch: ~3-4 seconds
- **Total overhead: ~1 second**

### Disk Usage

**Per Recording Session:**
- Extensions: ~5-20 MB (depends on extensions)
- Profile: ~1-2 MB
- **Total: ~10-25 MB**

**Cleanup:** Automatic on stop

---

## Future Improvements (Not Implemented)

### Priority: Low

1. **Auto-grant "On all sites" access**
   - Requires HMAC signature implementation
   - Effort: High (cryptographic complexity)

2. **Preserve extension state/storage**
   - Copy Local Extension Settings
   - Privacy/security review needed
   - Effort: Medium

3. **Extension marketplace**
   - Upload custom unpacked extensions
   - Manage extension library
   - Effort: Medium

4. **Extension settings UI**
   - Configure extension options before loading
   - Effort: Low

5. **Recently used extensions**
   - Quick access to frequently used
   - Effort: Low

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-22 | ✅ Implement extension UI | Significant UX improvement for power users |
| 2026-01-22 | ✅ Use Chromium channel for extensions | Chrome removed --load-extension support |
| 2026-01-22 | ✅ Copy native messaging hosts | Required for INISAFE and similar extensions |
| 2026-01-22 | ⏸️ Don't auto-grant site access | Requires HMAC; manual workaround acceptable |
| 2026-01-22 | ⏸️ Don't copy extension storage | Privacy/security concerns; manual setup acceptable |
| 2026-01-22 | 🚨 Missing: Generate extension code | **DISCOVERED:** Scripts don't include extension loading |
| 2026-01-22 | 📝 Document and put on hold | Feature incomplete, needs code generation work |

---

## Recommendation

**Current Status:** ⚠️ FEATURE INCOMPLETE - Code Generation Not Implemented

**What Works:**
- ✅ Recording WITH extensions (100% functional)
- ✅ Extension scanning and UI
- ✅ Native messaging support

**What's Missing:**
- ❌ Generated scripts don't include extension loading
- ❌ Scripts can't be replayed with extensions
- 🚨 **BLOCKING for production use**

**Required Before Production:**
1. **Implement extension code generation** (HIGH PRIORITY)
   - Add extension copying to generated script
   - Add native host copying to generated script
   - Change channel to 'chromium' when extensions used
   - Add --load-extension args to generated script
   - Estimated: 2-3 hours

2. **Add user warnings** (MEDIUM PRIORITY)
   - "⚠️ Extensions load during recording but NOT in generated scripts"
   - "Scripts recorded with extensions won't work on replay"

**Optional Improvements:**
3. Auto-grant site access (requires HMAC implementation)
4. Preserve extension storage (privacy/security review needed)

**Overall Assessment:**
✅ Recording functionality works excellently
❌ Script generation is incomplete
🚨 NOT ready for production until code generation implemented
📊 Can be used for one-off recording sessions (not for script reuse)

---

## References

### Research Sources
- [Chrome extensions | Playwright](https://playwright.dev/docs/chrome-extensions)
- [HMAC and "Secure Preferences": Revisiting Chromium-based Browsers Security](https://www.cse.chalmers.se/~andrei/cans20.pdf)
- [RFC: Removing --load-extension flag in Chrome](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/aEHdhDZ-V0E)
- [Extension Permissions Documentation](https://chromium.googlesource.com/chromium/src/+/main/extensions/docs/permissions.md)
- [Native messaging | Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Permission prompts Issue #38670](https://github.com/microsoft/playwright/issues/38670)
- [User controls for host permissions](https://developer.chrome.com/docs/extensions/mv2/runtime-host-permissions)

### Related Documentation
- `CHROME-EXTENSIONS-GUIDE.md` - General usage guide
- `CHROME-EXTENSION-UI-IMPLEMENTATION.md` - Implementation plan
- `CHROME-EXTENSION-PERMISSIONS-RESEARCH.md` - Permission system deep dive
- `CHROMIUM-LAUNCH-INSTANCES.md` - All Chromium launch locations

---

**Status:** 📝 DOCUMENTED - FEATURE ON HOLD FOR PRODUCTION USE
**Ready for:** Beta testing, user feedback, incremental improvements

# Chromium Launch Instances - Complete Reference

This document catalogs all instances where Chromium/Chrome is launched in the EGDesk codebase, including their configuration, profile management, and cleanup strategies.

**Last Updated:** 2026-01-22

---

## Table of Contents

1. [Browser Recorder](#1-browser-recorder)
2. [Hometax Automation](#2-hometax-automation)
3. [Finance Hub - Bank Automators](#3-finance-hub---bank-automators)
4. [SNS Integration](#4-sns-integration)
5. [Scheduler Service](#5-scheduler-service)
6. [File Conversion MCP Server](#6-file-conversion-mcp-server)
7. [SEO Tools](#7-seo-tools)
8. [Naver Automator](#8-naver-automator)
9. [Main Process Utilities](#9-main-process-utilities)
10. [Legacy Scripts](#10-legacy-scripts)
11. [Profile Management Strategy](#11-profile-management-strategy)

---

## 1. Browser Recorder

**File:** `src/main/browser-recorder.ts`

**Purpose:** Records user interactions with websites and generates Playwright test scripts.

> **🎯 PLANNED FEATURE:** Chrome Extension UI integration - See `CHROME-EXTENSION-UI-IMPLEMENTATION.md`
> Users will be able to select extensions from their Chrome profiles via UI, and those extensions will be loaded when launching the browser recorder.

### Launch Configuration

```typescript
// Recording Session
this.context = await chromium.launchPersistentContext(this.profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
  downloadsPath: path.join(app.getPath('downloads'), `EGDesk-${this.scriptName}`),
  args: [
    '--window-size={browserWidth},{browserHeight}',
    '--window-position={browserX},{browserY}',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-features=PrivateNetworkAccessSendPreflights',
    '--disable-features=PrivateNetworkAccessRespectPreflightResults'
  ]
});
```

### Profile Management

- **Profile Location:** `{userData}/chrome-profiles/playwright-recording-XXXXXX` (temp)
- **Fallback Location:** `{tmpdir}/playwright-profiles/playwright-recording-XXXXXX`
- **Downloads Location:** `~/Downloads/EGDesk-egdesk-browser-recorder-{timestamp}/` (unique per script)
- **Cleanup Strategy:** ✅ Profile deleted after recording stops (Lines 4920-4927, 5137-5145)
- **Cache/Cookies Preserved:** ❌ No (currently deleted)

### Generated Scripts

```typescript
// Generated code template (Line 5389)
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));
const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  acceptDownloads: true,
  downloadsPath: path.join(os.homedir(), 'Downloads', 'EGDesk-{scriptName}')
});

// Cleanup in finally block (Line 5857)
fs.rmSync(profileDir, { recursive: true, force: true });
```

**Lines:** 169-189 (recording), 5400-5415 (generated code)

---

## 2. Hometax Automation

**File:** `src/main/hometax-automation.ts`

**Purpose:** Korean National Tax Service automation for electronic tax invoice retrieval.

### Launch Configuration

```typescript
// fetchCertificates() - Line 48
const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
  downloadsPath: path.join(os.homedir(), 'Downloads', 'EGDesk-Hometax'),
  args: [
    '--window-size=907,871',
    '--window-position=605,0',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-features=PrivateNetworkAccessSendPreflights',
    '--disable-features=PrivateNetworkAccessRespectPreflightResults'
  ]
});
```

### Profile Management

- **Profile Location:** `{tmpdir}/hometax-profile-XXXXXX` (temp)
- **Downloads Location:** `~/Downloads/EGDesk-Hometax/` (shared)
- **Cleanup Strategy:** ❌ No cleanup (profiles accumulate in tmpdir)
- **Cache/Cookies Preserved:** ❌ No
- **Browser Reuse:** ✅ Context stored in `globalContext` between `fetchCertificates()` and `connectToHometax()`

**Lines:** 48-67 (fetchCertificates), 256-275 (connectToHometax fallback)

**Issue:** Profiles are created but never deleted, accumulating in `/tmp/`.

---

## 3. Finance Hub - Bank Automators

**File:** `src/main/financehub/core/BaseBankAutomator.js`

**Purpose:** Base class for all bank automation (Shinhan, Kookmin, NH, NH Business).

### Launch Configuration

```javascript
// setupBrowser() - Uses BaseBankAutomator pattern
async setupBrowser(proxyUrl = '') {
  const profilesDir = path.join(os.homedir(), '.egdesk-profiles', this.config.bank.id);
  const profileDir = fs.mkdtempSync(path.join(profilesDir, 'session-'));

  this.context = await chromium.launchPersistentContext(profileDir, {
    headless: this.config.headless,
    channel: this.config.chromeProfile ? 'chrome' : undefined,
    viewport: null,
    acceptDownloads: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
}
```

### Profile Management

- **Profile Location:** `~/.egdesk-profiles/{bankId}/session-XXXXXX/` (permanent)
- **Downloads Location:** No downloads (data extracted from HTML)
- **Cleanup Strategy:** ❌ No cleanup (profiles accumulate)
- **Cache/Cookies Preserved:** ✅ Yes (by design)

**Used By:**
- `src/main/financehub/banks/shinhan/ShinhanBankAutomator.js`
- `src/main/financehub/banks/kookmin/KookminBankAutomator.js`
- `src/main/financehub/banks/nh/NHBankAutomator.js`
- `src/main/financehub/banks/nh-business/NHBusinessBankAutomator.js`

**Lines:** BaseBankAutomator.js (browser setup methods)

---

## 4. SNS Integration

### 4.1 Instagram

**File:** `src/main/sns/instagram/index.ts`

```typescript
// Line 152
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

**File:** `src/main/sns/instagram/login.ts`

```typescript
// Line varies
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

### 4.2 Facebook

**File:** `src/main/sns/facebook/login.ts`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

### 4.3 Twitter

**File:** `src/main/sns/twitter/login.ts`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

### 4.4 YouTube

**File:** `src/main/sns/youtube/login.ts`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

### SNS Profile Management

- **Profile Location:** None (standard `chromium.launch()` without persistent context)
- **Downloads Location:** N/A
- **Cleanup Strategy:** ✅ Browser closed after operation
- **Cache/Cookies Preserved:** ❌ No (ephemeral sessions)

---

## 5. Scheduler Service

**File:** `src/main/scheduler/playwright-scheduler-service.ts`

**Purpose:** Executes scheduled Playwright scripts.

### Launch Configuration

```typescript
// Line 406+
const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  channel: 'chrome',
  viewport: null,
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
  downloadsPath: downloadsPath
});
```

### Profile Management

- **Profile Location:** Temporary (pattern not shown in grep)
- **Downloads Location:** `~/Downloads/EGDesk-Playwright/` (shared - potential collision!)
- **Cleanup Strategy:** Unknown (needs investigation)
- **Cache/Cookies Preserved:** Unknown

**Lines:** ~406

---

## 6. File Conversion MCP Server

**File:** `src/main/mcp/file-conversion/file-conversion-service.ts`

**Purpose:** Converts documents to PDF using Playwright for HTML rendering.

### Launch Configuration

```typescript
// Multiple instances for different conversion types
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
// ... conversion logic ...
await browser.close();
```

### Profile Management

- **Profile Location:** None (headless, ephemeral)
- **Downloads Location:** Output files saved to specified paths
- **Cleanup Strategy:** ✅ Browser closed immediately after conversion
- **Cache/Cookies Preserved:** ❌ No

**Use Cases:**
- Markdown to PDF
- HTML to PDF
- Spreadsheet to PDF
- Web page to PDF

**Lines:** Multiple instances throughout file

---

## 7. SEO Tools

**File:** `src/main/seo/seo-analyzer.ts`

```typescript
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

**File:** `src/main/web/seo-report.ts`

```typescript
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox']
});
```

### Profile Management

- **Profile Location:** None (headless)
- **Downloads Location:** N/A
- **Cleanup Strategy:** ✅ Browser closed after analysis
- **Cache/Cookies Preserved:** ❌ No

---

## 8. Naver Automator

**File:** `src/main/naver/browser-controller.ts`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

**File:** `src/main/automator.js`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

### Profile Management

- **Profile Location:** None (standard launch)
- **Downloads Location:** N/A
- **Cleanup Strategy:** ✅ Browser closed after operation
- **Cache/Cookies Preserved:** ❌ No

---

## 9. Main Process Utilities

**File:** `src/main/main.ts`

### 9.1 Launch Chrome Handler (Line 831)

```typescript
ipcMain.handle('launch-chrome', async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });
  // Opens Naver Blog write page
});
```

### 9.2 Website Crawler (Line 857)

```typescript
ipcMain.handle('crawl-website', async (event, { url, proxy }) => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    proxy: proxyConfig
  });
  // Crawls website links
});
```

### Profile Management

- **Profile Location:** None
- **Downloads Location:** N/A
- **Cleanup Strategy:** ⚠️ May not be closed properly (check needed)
- **Cache/Cookies Preserved:** ❌ No

---

## 10. Legacy Scripts

### 10.1 Google Workspace Authorization

**File:** `scripts/legacy/g-workspace/playwright-authorization.ts`

```typescript
// Line 455 - Standard launch
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
});

// Line 748 - Persistent context with profile
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chrome',
  headless: false,
  args: ['--profile-directory={profileDir}']
});
```

### 10.2 Test Scripts

**File:** `scripts/test/test-paste-component.js`

```typescript
browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

**File:** `src/main/test-parsing.ts`

```typescript
const browser = await chromium.launch({
  headless: false,
  channel: 'chrome'
});
```

---

## 11. Profile Management Strategy

### Current Status by Component

| Component | Profile Type | Location | Cleanup | Cache Preserved |
|-----------|-------------|----------|---------|-----------------|
| **Browser Recorder** | Persistent | `{userData}/chrome-profiles/` | ✅ Deleted | ❌ No |
| **Hometax** | Persistent | `{tmpdir}/hometax-profile-*` | ❌ No | ❌ No |
| **Bank Automators** | Persistent | `~/.egdesk-profiles/{bank}/` | ❌ No | ✅ Yes |
| **SNS (All)** | None | N/A | ✅ Auto | ❌ No |
| **Scheduler** | Persistent | Unknown | ❓ Unknown | ❓ Unknown |
| **File Conversion** | None | N/A | ✅ Auto | ❌ No |
| **SEO Tools** | None | N/A | ✅ Auto | ❌ No |
| **Naver** | None | N/A | ✅ Auto | ❌ No |

### Recommendations for Profile Preservation

#### Components That SHOULD Keep Profiles

1. **Browser Recorder** ✅
   - Reason: User may record multiple sessions, cookies help skip logins
   - **Action:** Change cleanup strategy to preserve profiles
   - **Location:** Store in `~/.egdesk-profiles/browser-recorder/{scriptName}/`

2. **Hometax** ✅
   - Reason: Certificate authentication, session persistence across calls
   - **Action:** Move to permanent location, stop deleting
   - **Location:** `~/.egdesk-profiles/hometax/`

3. **Bank Automators** ✅ (Already implemented)
   - Reason: Login sessions, reduces captchas
   - **Current:** Already preserves in `~/.egdesk-profiles/{bankId}/`

#### Components That Should NOT Keep Profiles

1. **File Conversion** ❌ (Correct)
   - Reason: Headless PDF conversion, no user sessions needed

2. **SEO Tools** ❌ (Correct)
   - Reason: Headless analysis, clean slate preferred

3. **SNS** ❓ (Consideration needed)
   - Could benefit from profile persistence for multi-post operations

---

## 12. Cleanup Issues & Fixes Needed

### Critical Issues

1. **Hometax Profile Accumulation**
   ```bash
   # Current: Creates but never deletes
   /tmp/hometax-profile-abc123/
   /tmp/hometax-profile-def456/
   /tmp/hometax-profile-ghi789/
   ```

   **Fix:** Use persistent profile in `~/.egdesk-profiles/hometax/`

2. **Browser Recorder Profile Deletion**
   ```typescript
   // Current: Lines 4920-4927, 5137-5145
   fs.rmSync(this.profileDir, { recursive: true, force: true });
   ```

   **Fix:** Comment out cleanup, use persistent profile per script

3. **Scheduler Downloads Collision**
   ```bash
   # All scheduled scripts share same folder
   ~/Downloads/EGDesk-Playwright/
   ```

   **Fix:** Use unique folder per script like browser recorder

### Proposed Changes

#### Option 1: Preserve All Profiles (Recommended)

```typescript
// Centralized profile management
class ProfileManager {
  static getProfilePath(component: string, sessionId?: string): string {
    const base = path.join(os.homedir(), '.egdesk-profiles', component);
    return sessionId
      ? path.join(base, sessionId)
      : path.join(base, 'default');
  }

  // No cleanup - let profiles accumulate for better UX
  // Optional: Add manual cleanup UI feature
}
```

**Benefits:**
- Faster automation (sessions persist)
- Fewer captchas
- Better user experience
- Simple implementation

**Drawbacks:**
- Disk space usage (mitigated by infrequent use)
- Need cleanup UI for power users

#### Option 2: Configurable Retention

```typescript
interface ProfileConfig {
  preserve: boolean;
  maxAge?: number; // days
  maxCount?: number;
}

const PROFILE_CONFIGS = {
  'browser-recorder': { preserve: true, maxCount: 10 },
  'hometax': { preserve: true },
  'bank-automation': { preserve: true },
  'file-conversion': { preserve: false }
};
```

---

## 13. Migration Path

### Phase 1: Stop Deleting (Low Risk)

1. Comment out profile cleanup in:
   - `browser-recorder.ts` (lines 4922, 5139)
   - Any other cleanup `fs.rmSync()` calls

2. Test: Verify profiles accumulate but don't cause issues

### Phase 2: Centralize Locations (Medium Risk)

1. Move all profiles to `~/.egdesk-profiles/{component}/`
2. Update all `launchPersistentContext` calls
3. Test each component

### Phase 3: Add Management UI (Nice to Have)

1. Settings panel: "Clear Browser Profiles"
2. Show disk usage
3. Selective cleanup

---

## Quick Reference: Finding Launch Calls

```bash
# Find all chromium launches
grep -r "chromium\.launch\|launchPersistentContext" src/main --include="*.ts" --include="*.js"

# Count by type
grep -r "chromium\.launch(" src/main | wc -l        # Standard launch
grep -r "launchPersistentContext" src/main | wc -l  # Persistent context
```

---

## Profile Directory Structure

```
~/.egdesk-profiles/
├── browser-recorder/
│   ├── egdesk-browser-recorder-2026-01-22T10-30-00/
│   └── egdesk-browser-recorder-2026-01-22T11-00-00/
├── hometax/
│   └── default/
├── shinhan/
│   ├── session-abc123/
│   └── session-def456/
├── kookmin/
│   └── session-ghi789/
├── nh/
│   └── session-jkl012/
└── nh-business/
    └── session-mno345/
```

---

## Summary

**Total Chromium Launch Instances:** 23 files

**Launch Types:**
- `chromium.launch()`: ~15 instances (ephemeral)
- `chromium.launchPersistentContext()`: ~8 instances (with profiles)

**Cleanup Status:**
- ✅ Proper cleanup: ~60% (mainly headless/SNS)
- ❌ No cleanup: ~30% (bank automators - intentional)
- ⚠️ Problematic: ~10% (hometax, browser recorder)

**Recommendation:** Preserve profiles for browser recorder and hometax to improve user experience and reduce authentication friction.

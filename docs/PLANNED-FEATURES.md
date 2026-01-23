# Planned Features & Improvements

This document tracks features that have been designed but not yet implemented.

**Last Updated:** 2026-01-22

---

## 🎯 High Priority

### 1. Chrome Extension UI for Browser Recorder

**Status:** ✅ IMPLEMENTED - On Hold for Production

**Description:** Add UI to scan user's Chrome profiles and allow selection of extensions to load when launching browser recorder.

**Documentation:**
- [`CHROME-EXTENSION-FEATURE-COMPLETE.md`](../CHROME-EXTENSION-FEATURE-COMPLETE.md) - **READ THIS FIRST**
- [`CHROME-EXTENSION-UI-IMPLEMENTATION.md`](../CHROME-EXTENSION-UI-IMPLEMENTATION.md)
- [`CHROME-EXTENSION-PERMISSIONS-RESEARCH.md`](../CHROME-EXTENSION-PERMISSIONS-RESEARCH.md)

**Key Benefits:**
- ✅ Visual extension selection (no manual path entry)
- ✅ Supports all Chrome profiles on system
- ✅ Persistent user preferences
- ✅ Automatic extension loading in recorder
- ✅ Native messaging host support

**Implementation Checklist:**
- [x] Backend: Create `ChromeExtensionScanner` class
- [x] Backend: Add IPC handlers for scanning/saving
- [x] Backend: Update `BrowserRecorder.setExtensions()`
- [x] Frontend: Create `ChromeExtensionSelector` component
- [x] Frontend: Integrate with recorder controls
- [x] Testing: End-to-end extension loading
- [x] Native messaging host copying
- [x] Permission preservation from Secure Preferences

**Completed:** 2026-01-22

**Known Limitations (Documented):**
- ⚠️ Site access defaults to "On click" - user must manually change to "On all sites"
- ⚠️ Extension state not preserved - fresh start each session (wallets, settings, etc.)
- ✅ Console warnings from extensions are cosmetic (safe to ignore)

**Related Files (Implemented):**
- `src/main/chrome-extension-scanner.ts` ✅
- `src/main/chrome-handlers.ts` ✅
- `src/main/browser-recorder.ts` ✅
- `src/renderer/components/ChromeExtensionSelector/` ✅

**Status:** READY FOR BETA TESTING

---

## 🔄 Medium Priority

### 2. Profile Preservation for Better Performance

**Status:** ⏸️ ON HOLD - Reverted per user request

**Description:** Keep browser profiles instead of deleting them after each session to preserve cache/cookies.

**Documentation:** [`CHROMIUM-LAUNCH-INSTANCES.md`](../CHROMIUM-LAUNCH-INSTANCES.md) - Section 11

**Key Benefits:**
- Faster page loads (cached resources)
- Persistent login sessions
- Fewer CAPTCHAs
- Better automation reliability

**Current Behavior:**
- ❌ Profiles deleted after recording
- ❌ Cache/cookies lost
- ❌ Must re-login on each session

**Proposed Behavior:**
- ✅ Profiles kept in `~/.egdesk-profiles/browser-recorder/`
- ✅ Cache/cookies preserved
- ✅ Faster subsequent recordings

**Blockers:**
- User requested to keep current cleanup behavior
- Can be revisited if needed

**Implementation:** Just comment out `fs.rmSync()` calls (already tested)

---

### 3. Hometax Profile Cleanup

**Status:** ⚠️ ISSUE IDENTIFIED - Needs Fix

**Description:** Hometax automation creates temporary profiles in `/tmp/` but never deletes them, causing disk space accumulation.

**Current Issue:**
```bash
/tmp/hometax-profile-abc123/  # Never deleted
/tmp/hometax-profile-def456/  # Never deleted
/tmp/hometax-profile-ghi789/  # Never deleted
```

**Proposed Fix:**
Move to persistent profile for better UX:
```typescript
// Instead of temp profiles
const profileDir = path.join(os.homedir(), '.egdesk-profiles', 'hometax');
```

**Benefits:**
- No disk space accumulation
- Preserves login sessions (fewer certificate prompts)
- Faster automation

**Implementation:**
- Update `src/main/hometax-automation.ts`
- Change profile path from `os.tmpdir()` to `~/.egdesk-profiles/hometax/`
- Remove temp profile creation

**Estimated Effort:** 1-2 hours

---

## 📊 Low Priority / Future Enhancements

### 4. Extension Management Features

**Requires:** Chrome Extension UI (Feature #1) to be implemented first

**Enhancements:**
- [ ] Search/filter extensions by name
- [ ] Group extensions by category
- [ ] Upload custom unpacked extensions
- [ ] Configure extension settings before loading
- [ ] "Recently used" quick access
- [ ] Check for extension updates

### 5. Scheduler Download Path Uniqueness

**Status:** 💡 IDEA - Not Scoped

**Description:** Similar to browser recorder, give each scheduled script its own download folder.

**Current:**
```
~/Downloads/EGDesk-Playwright/  # All scheduled scripts share this
```

**Proposed:**
```
~/Downloads/EGDesk-{scriptName}-{timestamp}/  # Unique per script
```

**Related:** `src/main/scheduler/playwright-scheduler-service.ts`

### 6. Profile Cleanup UI

**Status:** 💡 IDEA - Nice to Have

**Description:** Add settings panel to manage browser profiles.

**Features:**
- View all EGDesk browser profiles
- Show disk space usage
- Selective cleanup (delete old profiles)
- Auto-cleanup after N days

**Location:** Settings → Advanced → Browser Profiles

---

## 🎨 UI/UX Improvements

### 7. Download Path Naming Consistency

**Status:** ✅ COMPLETED

**Description:** Use consistent naming for browser recorder downloads.

**Before:**
```
~/Downloads/EGDesk-Playwright/  # Generic
```

**After:**
```
~/Downloads/EGDesk-egdesk-browser-recorder-{timestamp}/  # Specific per script
```

**Implemented:** 2026-01-22

---

## 📝 Notes

### Implementation Priority Order

1. **Chrome Extension UI** - High user value, well-defined scope
2. **Hometax Profile Cleanup** - Fixes disk space issue
3. **Profile Preservation** - Only if user requests it
4. **Other enhancements** - As needed

### Decision Log

| Date | Feature | Decision | Reason |
|------|---------|----------|--------|
| 2026-01-22 | Chrome Extension UI | ✅ Approved | Significant UX improvement |
| 2026-01-22 | Profile Preservation | ⏸️ On Hold | User prefers cleanup |
| 2026-01-22 | Download Path Naming | ✅ Implemented | Better organization |

---

## 🔗 Related Documentation

- [`CHROME-EXTENSIONS-GUIDE.md`](../CHROME-EXTENSIONS-GUIDE.md) - How to use extensions with Playwright
- [`CHROME-EXTENSION-UI-IMPLEMENTATION.md`](../CHROME-EXTENSION-UI-IMPLEMENTATION.md) - Complete implementation plan
- [`CHROMIUM-LAUNCH-INSTANCES.md`](../CHROMIUM-LAUNCH-INSTANCES.md) - All Chromium launch locations
- [`BROWSER_RECORDER_README.md`](../BROWSER_RECORDER_README.md) - Browser recorder documentation

# Browser Cleanup Analysis - Card & Bank Automation

**Date:** 2026-02-10
**Purpose:** Verify browser cleanup after each card/bank automation to prevent conflicts

---

## Browser Lifecycle in Scheduler

### Card Sync Flow (FinanceHubScheduler.ts:798-966)

```
1. Create Automator (Line 834-857)
   const automator = cards.createCardAutomator(cardCompanyId, {...});
   this.activeBrowsers.set(entityKey, automator);  // ✅ Track browser

2. Login (Line 861)
   await automator.login(savedCredentials);
   // Browser is created ONLY during login via createBrowser()

3. Get Transactions (Line 888)
   await automator.getTransactions(cardNumber, startDate, endDate);

4. Import to Database (Line 918)
   financeHubDb.importTransactions(...);

5. CLEANUP in finally block (Line 959-964) ✅ ALWAYS RUNS
   finally {
     // CRITICAL: Always cleanup browser, even on errors
     if (automator) {
       const entityKey = `card:${cardId}`;
       await this.safeCleanupBrowser(automator, entityKey);
     }
   }
```

**Result:** ✅ Browser ALWAYS cleaned up (even on errors)

---

### Bank Sync Flow (FinanceHubScheduler.ts:967-1168)

```
1. Create Automator (Line 1011-1018)
   const automator = banks.createBankAutomator(bankId, {...});
   this.activeBrowsers.set(entityKey, automator);  // ✅ Track browser

2. Login (Line 1024)
   await automator.login(savedCredentials);

3. Get Transactions (Line 1082)
   const result = await automator.getTransactions(...);

4. Import to Database (Line 1098)
   financeHubDb.importTransactions(...);

5. CLEANUP in finally block (Line 1143-1148) ✅ ALWAYS RUNS
   finally {
     // CRITICAL: Always cleanup browser, even on errors
     if (automator) {
       const entityKey = `bank:${bankId}`;
       await this.safeCleanupBrowser(automator, entityKey);
     }
   }

6. ADDITIONAL CLEANUP on timeout (Line 1158-1162) ✅
   if (automator) {
     await this.safeCleanupBrowser(automator, entityKey);
   }
```

**Result:** ✅ Browser ALWAYS cleaned up (even on errors/timeouts)

---

## safeCleanupBrowser Implementation (Lines 752-786)

### Robust Cleanup with Timeout Protection:

```typescript
private async safeCleanupBrowser(automator, entityKey, timeoutMs = 30000) {
  try {
    // 1. Race between cleanup and timeout (30s max)
    await Promise.race([
      automator.cleanup(false),  // Force close
      timeoutPromise
    ]);
    ✅ Normal cleanup succeeded

  } catch (cleanupError) {
    // 2. Fallback: Force kill browser process
    if (automator.browser) {
      await automator.browser.close();  // Direct browser.close()
    }
    ✅ Force kill succeeded

  } finally {
    // 3. Always remove from tracking
    this.activeBrowsers.delete(entityKey);  // ✅ ALWAYS runs
  }
}
```

**Protection Layers:**
1. ✅ 30-second timeout prevents hung cleanup
2. ✅ Fallback force-kill if cleanup fails
3. ✅ Always removes from activeBrowsers tracking
4. ✅ Called in `finally` block of sync methods

---

## Hung Browser Detection & Cleanup (Lines 600-604)

**Before starting new sync:**

```typescript
// CRITICAL FIX: Kill any hung browser from previous attempt
if (this.activeBrowsers.has(entityKey)) {
  console.log(`Killing hung browser from previous attempt: ${entityKey}`);
  const oldAutomator = this.activeBrowsers.get(entityKey);
  await this.safeCleanupBrowser(oldAutomator, entityKey);
}
```

**Result:** ✅ Any hung browsers are killed before new sync starts

---

## Manual Excel Import - NEW Feature (main.ts:885-975)

### Browser Lifecycle:

```
1. Create Automator (Line 894)
   const automator = cards.createCardAutomator(cardCompanyId, {...});
   // ✅ No browser created (constructor only sets this.browser = null)

2. Parse Excel (Line 902-908)
   extractedData = await automator.parseDownloadedExcel(filePath);
   // ✅ Parser methods don't need browser (only read files)

3. Import to Database (Line 951)
   financeHubDb.importTransactions(...);

4. Return Result (Line 961)
   return { success: true, ... };
   // ⚠️ No cleanup called (but no browser was created)
```

**Analysis:**
- ✅ No browser is created (parsers are pure file operations)
- ✅ No cleanup needed
- ✅ automator object garbage collected after function returns
- ✅ No conflict with scheduler (different code path)

**Verification:**
- Constructor: `this.browser = null` (BaseBankAutomator.js:31)
- Browser only created in: `createBrowser()` method (line 150)
- createBrowser only called from: `login()` method
- Manual import never calls: `login()`

**Result:** ✅ Safe - no browser created, no cleanup needed

---

## Potential Conflict Scenarios

### Scenario 1: User imports Excel while scheduler is running
```
Timeline:
T+0: Scheduler starts card sync (creates browser for bc-card)
T+5: User manually imports BC Card Excel file
T+10: Scheduler finishes, cleans up browser
```

**Analysis:**
- ✅ No conflict - Different operations:
  - Scheduler: Uses automator with browser (activeAutomators map)
  - Manual import: Creates temporary automator without browser
  - Manual import: Uses local file path, doesn't touch browser
- ✅ Database has proper locking (SQLite handles concurrent writes)
- ✅ No shared state between scheduler and manual import

---

### Scenario 2: Manual card transaction navigation (via UI)
**Location:** `src/main/main.ts:742-817`

```typescript
ipcMain.handle('finance-hub:card:login-and-get-cards', async (_event, ...) => {
  const automator = cards.createCardAutomator(cardCompanyId, {...});
  activeAutomators.set(cardCompanyId, automator);  // ✅ Tracked

  const loginResult = await automator.login(credentials);
  // ... get cards, get transactions

  // ❌ NO CLEANUP HERE!
  // Browser stays open until user clicks "Disconnect" or app closes
});

ipcMain.handle('finance-hub:card:disconnect', async (_event, cardCompanyId) => {
  const automator = activeAutomators.get(cardCompanyId);
  if (automator) {
    await automator.cleanup(false);  // ✅ Cleanup on disconnect
    activeAutomators.delete(cardCompanyId);
  }
});
```

**Analysis:**
- ⚠️ Manual UI navigation keeps browser open (by design)
- ✅ Browser closed when user clicks "Disconnect"
- ⚠️ **POTENTIAL CONFLICT:** If scheduler runs while manual browser is open

---

## CRITICAL BUG FOUND: Scheduler vs Manual Browser Conflict

### Problem:

**Timeline:**
```
T+0: User manually connects to BC Card via UI
     → Creates browser, stores in activeAutomators['bc-card']

T+10: Scheduler runs, tries to sync bc-card
      → Checks if activeBrowsers.has('card:bc')  // ❌ Different key!
      → Creates NEW browser for same card
      → TWO BROWSERS OPEN FOR SAME CARD ❌
```

**Root Cause:**
- Manual navigation uses key: `'bc-card'` (activeAutomators)
- Scheduler uses key: `'card:bc'` (activeBrowsers)
- **Different Maps!** `activeAutomators` vs `activeBrowsers`
- **Different Keys!** `'bc-card'` vs `'card:bc'`

**Impact:**
- Multiple browsers for same card
- Login conflicts
- Session conflicts
- Resource waste

---

## Issues Identified

### Issue 1: Two Different Browser Tracking Maps ❌

**main.ts uses:** `activeAutomators` Map
```typescript
const activeAutomators = new Map();  // For manual UI navigation
activeAutomators.set('bc-card', automator);
```

**FinanceHubScheduler.ts uses:** `this.activeBrowsers` Map
```typescript
this.activeBrowsers = new Map();  // For scheduler
this.activeBrowsers.set('card:bc', automator);
```

**Problem:** No coordination between manual and scheduled syncs

---

### Issue 2: Different Key Formats ❌

**Manual navigation:**
- Key: `'bc-card'`, `'kb-card'`, `'nh-card'`

**Scheduler:**
- Key: `'card:bc'`, `'card:kb'`, `'card:nh'`
- Format: `card:{cardId}` where cardId is WITHOUT `-card` suffix

**Mismatch Example:**
```javascript
// Manual
activeAutomators.set('bc-card', automator);

// Scheduler
const cardId = 'bc';  // From config
const entityKey = `card:${cardId}`;  // = 'card:bc'
this.activeBrowsers.set('card:bc', automator);

// These are DIFFERENT keys for the SAME card! ❌
```

---

## Recommended Fixes

### Option 1: Share Browser Tracking Map

Make scheduler check both maps:
```typescript
// In syncCard() before creating automator
const manualAutomator = activeAutomators.get(cardCompanyId);
if (manualAutomator?.browser) {
  console.log(`Manual browser already open for ${cardCompanyId}, skipping scheduled sync`);
  return { success: true, skipped: true };
}
```

---

### Option 2: Close Manual Browser Before Scheduled Sync

In scheduler before creating automator:
```typescript
// Check if manual browser is open
const manualAutomator = activeAutomators.get(cardCompanyId);
if (manualAutomator) {
  console.log(`Closing manual browser for ${cardCompanyId} to run scheduled sync`);
  await manualAutomator.cleanup(false);
  activeAutomators.delete(cardCompanyId);
}
```

---

### Option 3: Unify Tracking

Use single shared Map for all browser tracking:
- Refactor to use global browser registry
- Both manual and scheduler use same map and keys
- Prevents any conflicts

---

## Current State Summary

### ✅ Working Correctly:
1. ✅ Scheduler always cleans up browsers (finally blocks)
2. ✅ safeCleanupBrowser has timeout protection + fallback
3. ✅ Hung browser detection before retry
4. ✅ Manual Excel import doesn't create browser (safe)
5. ✅ activeBrowsers properly tracked and cleaned

### ⚠️ Potential Issues:
1. ⚠️ Manual UI browser + Scheduler can create 2 browsers for same card
2. ⚠️ Different tracking maps (activeAutomators vs activeBrowsers)
3. ⚠️ Different key formats ('bc-card' vs 'card:bc')
4. ⚠️ No coordination between manual and scheduled syncs

### Recommended Action:
**Implement Option 1 or 2** to prevent conflicts when:
- User has manual browser open
- Scheduler tries to run sync for same card
- Both try to login/navigate simultaneously

---

## Testing to Verify

### Test 1: Scheduler Cleanup
1. Enable card sync in scheduler
2. Let scheduler run card sync
3. Check processes: `ps aux | grep -i chrome` after sync completes
4. Expected: No chrome processes (browser closed)

### Test 2: Manual Navigation Cleanup
1. Manually connect to card via UI
2. Click "Disconnect" button
3. Check processes: `ps aux | grep -i chrome`
4. Expected: No chrome processes (browser closed)

### Test 3: Conflict Test
1. Manually connect to BC Card (browser stays open)
2. Trigger scheduler to sync BC Card
3. Expected: Either:
   - Scheduler skips (if fix applied)
   - OR two browsers open (current bug)

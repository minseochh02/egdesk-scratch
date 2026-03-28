# Popup Detection Debugging Guide

## The Problem You Encountered

Korean banking sites load popups **asynchronously** - they don't appear immediately when the page loads. The original implementation checked too quickly!

## What Changed

### BEFORE (Didn't Work)
```javascript
await this.page.goto(url);
await this.detectAndHandlePopups(this.page);  // ❌ Too fast!
```

### AFTER (Works Now)
```javascript
await this.page.goto(url);
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 3000,  // ✅ Wait 3 seconds for popups to load
  retries: 2,             // ✅ Try multiple times
  retryDelay: 1500        // ✅ Wait between retries
});
```

## New Timing Strategy

### When We Look for Popups:

1. **After page load** → Wait **3 seconds**, then check **2 times** (1.5s apart)
2. **After login** → Wait **3 seconds**, then check **3 times** (1.5s apart)
3. **During navigation** → Quick check (1s wait, 1 retry)
4. **Background monitoring** → Check every **3 seconds** continuously

### Why This Works

Korean banking sites:
- Load popups via JavaScript (after page ready)
- Use delayed timers (1-3 seconds)
- Render in iframes that load slowly
- Show different popups based on timing

## How to Debug: 3 Easy Steps

### Step 1: Set Your Credentials
```bash
export SHINHAN_CARD_USER_ID="your-id"
export SHINHAN_CARD_PASSWORD="your-password"
```

### Step 2: Run Debug Script
```bash
cd src/main/financehub/cards/shinhan-card/tests
node debug-popup.js
```

### Step 3: Watch the Output

The script will show you:

```
🔍 STAGE 1: Initial Page Load
────────────────────────────────────────
Waiting 3000ms for popups to appear...
Starting popup detection...
Checking main page for popups (attempt 1)...

Found 12 visible buttons:
  1. "확인" [id="btnConfirm", class="btn-primary"]
  2. "닫기" [id="btnClose", class="btn-close"]
  3. "로그인" [id="", class="login-btn"]
  ...

Found 8 visible links:
  1. "오늘 하루 보지 않기" [href="#", class="close-link"]
  ...

✓ Handled security-notice popup
Screenshot saved: ./debug-output/popup-debug-2026-03-28...png
```

## What to Look For

### 1. Did the popup appear BEFORE detection?
```
Waiting 3000ms for popups to appear...  ← Popup should appear during this wait
Checking main page for popups...       ← Detection starts here
```

**If popup appeared AFTER detection started:**
- Increase `waitBeforeCheck` to 5000ms or more

### 2. Was the popup visible in the button list?
```
Found 12 visible buttons:
  1. "확인" [id="btnConfirm", class="btn-primary"]  ← Is this your popup button?
```

**If popup button is NOT in the list:**
- It might be in an iframe
- It might have loaded after all retries
- Check the screenshot to see what was on screen

### 3. Did we handle the popup?
```
✓ Handled security-notice popup  ← Success!
```

**If popup was visible but NOT handled:**
- The selector might not match
- Need to add new selector pattern

### 4. Was the popup in an iframe?
```
Found 3 frames:
  - Frame: "popupFrame" (https://...)
  - Frame: "" (https://...)
```

**If popup is in unnamed frame:**
- We check all frames automatically
- May need longer timeout

## Common Scenarios

### Scenario 1: Popup Appears Immediately
**Solution:** Reduce `waitBeforeCheck` to 1000ms
```javascript
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 1000,  // Faster check
  retries: 1
});
```

### Scenario 2: Popup Appears After 5+ Seconds
**Solution:** Increase `waitBeforeCheck`
```javascript
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 6000,  // Wait longer
  retries: 2
});
```

### Scenario 3: Multiple Popups in Sequence
**Solution:** Increase `retries`
```javascript
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 3000,
  retries: 5,  // More retries for multiple popups
  retryDelay: 2000
});
```

### Scenario 4: Popup Has Different Text
**Solution:** Add selector to `POPUP_PATTERNS` in BaseCardAutomator.js

Example: If popup button says "계속하기" (Continue):
```javascript
{
  type: 'session-extension',
  selectors: [
    '//button[contains(text(), "연장")]',
    '//button[contains(text(), "세션연장")]',
    '//button[contains(text(), "계속")]',
    '//button[contains(text(), "계속하기")]',  // ← Add this
  ],
  priority: 'high'
}
```

## Using Debug Mode in Your Code

### Quick Test
```javascript
const automator = new ShinhanCardAutomator({
  headless: false,
  manualPassword: true,
  debugPopups: true  // ← Enable debug mode
});

await automator.login(credentials);
// Will automatically show all buttons/links at each stage
```

### Manual Debug at Any Point
```javascript
// At any point in your automation:
await automator.debugPopupElements(automator.page);
// Shows all visible elements and takes screenshot
```

## Adjusting Timing Per Card Company

Each card company might need different timing:

```javascript
// Fast popup detection (for quick-loading sites)
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 1000,
  retries: 1,
  retryDelay: 500
});

// Standard popup detection (default)
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 3000,
  retries: 2,
  retryDelay: 1500
});

// Slow popup detection (for slow-loading sites)
await this.detectAndHandlePopups(this.page, {
  waitBeforeCheck: 5000,
  retries: 3,
  retryDelay: 2000
});
```

## Quick Reference: Detection Timing

| Stage | Wait Before Check | Retries | Retry Delay | Total Time |
|-------|------------------|---------|-------------|------------|
| Initial page load | 3000ms | 2 | 1500ms | ~6s max |
| After login | 3000ms | 3 | 1500ms | ~7.5s max |
| During navigation | 2000ms | 2 | 1000ms | ~4s max |
| Background monitoring | 0ms | 0 | N/A | Every 3s |

## Next Steps After Debugging

1. **Run the debug script** and observe when popups appear
2. **Note the timing** - does popup appear during the wait or after?
3. **Check the button list** - is your popup button visible?
4. **Look at screenshots** - what was on screen when detection ran?
5. **Adjust timing** based on what you learned
6. **Add new selectors** if popup text is different

## Example: Complete Debug Session

```bash
# Terminal output you'll see:

🔍 STAGE 1: Initial Page Load
────────────────────────────────────────
[SHINHAN-CARD] Waiting 3000ms for popups to appear...
[SHINHAN-CARD] Starting popup detection...
[SHINHAN-CARD] Checking main page for popups (attempt 1)...
[SHINHAN-CARD] Found 12 visible buttons:
  1. "로그인" [id="loginBtn", class="btn"]
  2. "확인" [id="", class="popup-confirm"]     ← HERE'S THE POPUP!
[SHINHAN-CARD] ✓ Handled security-notice popup   ← WE GOT IT!
[SHINHAN-CARD] Found and handled 1 popup(s) on attempt 1
```

**This means:**
- ✅ Timing is correct (popup appeared during 3s wait)
- ✅ Detection found the popup
- ✅ We successfully clicked it

## Still Not Working?

Share this information:

1. **Console output** from debug script
2. **Screenshots** from ./debug-output/
3. **When popup appeared** (in seconds after page load)
4. **Popup button text** (Korean text on the button)
5. **Any error messages**

This will help adjust:
- Wait times
- Retry counts
- Selector patterns
- Frame detection strategy

# File Upload Recording & Replay Flow

## Problem Statement

We need to handle file uploads in two scenarios:
1. **Normal recording** - User manually uploads a file
2. **Chain recording** - Auto-upload a previously downloaded file

## Key Playwright Constraint

⚠️ **CRITICAL:** Once you register a `page.on('filechooser')` listener in Playwright:
- The native file picker dialog **will not appear** unless you call `fileChooser.setFiles()`
- You MUST handle the file chooser programmatically
- The browser's normal file picker behavior is completely blocked

## Scenarios

### Scenario 1: Normal Recording (No Chain)

**User Journey:**
1. User starts recording
2. User navigates to a page with file upload
3. User clicks file input button
4. **Expected:** Native file picker opens
5. User selects a file manually
6. File is uploaded
7. Recording captures the workflow

**Recording Challenge:**
- If we add `page.on('filechooser')` listener → Native dialog won't open
- Without the listener → We can't intercept or record the file selection
- User interaction with native dialog → Playwright can't see what file was selected

**Solution Options:**

#### Option A: Don't intercept in normal mode ✅ RECOMMENDED
```typescript
// In normal recording mode:
// - No filechooser listener registered
// - Native file picker works normally
// - Clicks on file input are recorded as regular clicks
// - Generated test will have TODO comment for manual file path setup
```

**Pros:**
- Native file picker works as expected
- User can complete their workflow naturally
- No blocking of browser functionality

**Cons:**
- Can't auto-record which file was selected
- Generated test requires manual editing of file path

#### Option B: Intercept but prompt user for file path
```typescript
// When file input is clicked:
// 1. Intercept the file chooser
// 2. Show custom dialog asking for file path
// 3. Call fileChooser.setFiles(userProvidedPath)
// 4. Record the file path
```

**Pros:**
- Can record exact file path
- Generated test is complete

**Cons:**
- Breaks native browser experience
- Extra step for user (entering path manually)
- Confusing UX

#### Option C: Let dialog open, then detect the result
**NOT POSSIBLE** - Playwright's filechooser event blocks the native dialog. Can't have both.

---

### Scenario 2: Chain Recording (Download → Upload)

**User Journey:**
1. User records download workflow
2. File saves to: `~/Downloads/EGDesk-Browser/{script-name}/file.pdf`
3. User stops recording
4. User clicks "Start Upload Recording"
5. Chain parameters set:
   - `chainId`: Unique chain identifier
   - `chainDownloadPath`: Full path to downloaded file
   - `isChainedRecording`: true
6. User navigates to upload destination
7. User clicks file input button
8. **Problem:** File picker is intercepted by Playwright
9. Our code calls `fileChooser.setFiles(chainDownloadPath)`
10. **BUT:** User is stuck - website doesn't respond!

**THE PROBLEM:**

When we intercept the file chooser and call `fileChooser.setFiles()`:
- ✅ The file IS selected programmatically
- ❌ The website's UI doesn't update
- ❌ The website doesn't know a file was selected
- ❌ Upload button stays disabled
- ❌ File name doesn't show in UI
- ❌ User can't proceed with upload

**Why does this happen?**

The website expects this flow:
1. User clicks file input
2. Native file picker opens
3. User selects file
4. Browser fires `change` event on the input element
5. Website's JavaScript hears the event
6. Website updates UI (shows file name, enables button, etc.)

But with Playwright interception:
1. User clicks file input
2. Our listener intercepts → No native picker!
3. We call `fileChooser.setFiles()` → File selected in Playwright
4. ⚠️ **No `change` event fired** → Website doesn't know!
5. Website UI stays frozen
6. User is blocked

**WRONG Implementation (Current):**
```typescript
// This BLOCKS the user!
if (this.isChainedRecording && this.chainDownloadPath) {
  this.page.on('filechooser', async (fileChooser) => {
    // Auto-select the file
    await fileChooser.setFiles(this.chainDownloadPath);
    
    // Record the action
    this.actions.push({...});
    
    // ❌ User is now stuck!
    // Website doesn't know file was selected
    // UI doesn't update
    // Can't proceed
  });
}
```

**Solution Options:**

#### Option 1: DON'T Intercept During Recording (Let Native Picker Work) ✅ RECOMMENDED

```typescript
// During RECORDING in chain mode:
// - DON'T register filechooser listener
// - Let native file picker open
// - User selects the downloaded file MANUALLY
// - Website works normally
// - We just record the click on file input

// During REPLAY:
// - Register filechooser listener
// - Auto-select the file
// - Trigger change events for the website
```

**This means:**
- **Recording:** User still has to manually select the file (but it's right there in the dialog)
- **Replay:** Fully automated with `fileChooser.setFiles()`

#### Option 2: Intercept + Trigger Events (Complex)

```typescript
this.page.on('filechooser', async (fileChooser) => {
  // Auto-select file
  await fileChooser.setFiles(this.chainDownloadPath);
  
  // Try to trigger change event
  const element = fileChooser.element();
  await this.page.evaluate((el) => {
    // Dispatch change event
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Some sites also listen for these:
    el.dispatchEvent(new Event('blur'));
  }, element);
});
```

**Problems:**
- Events triggered programmatically often don't work due to browser security
- Websites can detect fake events
- Still might not update UI properly

#### Option 3: Use setInputFiles Instead of File Chooser

```typescript
// Don't intercept file chooser
// Use setInputFiles directly on the input element
await page.locator('input[type="file"]').setInputFiles(filePath);

// This:
// - Doesn't open file picker
// - Sets the files directly
// - Triggers proper change events
// - Website sees it as normal file selection
```

**Pros:**
- Works reliably
- Triggers all proper events
- Website responds normally

**Cons:**
- Only works during replay, not during recording
- User still sees the file input click during recording without file selection

---

## CORRECT IMPLEMENTATION

### During Recording (Both Normal & Chain Mode)
**DO NOT intercept file chooser at all**

```typescript
setupPageListeners() {
  // DON'T register filechooser listener during recording
  // Not in normal mode
  // Not in chain mode either!
  
  // Let the native file picker work naturally
  // User selects file manually (even in chain mode)
  // We just record the click on the file input
}
```

### During Replay
**Use setInputFiles (NOT file chooser interception)**

```typescript
// Generated code for chain mode:
{
  const uploadFilePath = path.join(downloadsPath, 'invoice.pdf');
  console.log('📤 Uploading file from chain:', uploadFilePath);
  
  // Option A: Direct setInputFiles (RECOMMENDED)
  await page.locator('input[type="file"]').setInputFiles(uploadFilePath);
  console.log('✅ File uploaded');
}

// OR Option B: File chooser (if Option A doesn't work for some sites)
{
  const uploadFilePath = path.join(downloadsPath, 'invoice.pdf');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('input[type="file"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(uploadFilePath);
}
```

---

## Implementation Decision

### During RECORDING (Normal & Chain Mode)
**DO NOT register filechooser listener - EVER**

```typescript
setupPageListeners() {
  // ... other listeners ...
  
  // NO file chooser listener during recording!
  // Let the native file picker work naturally
  // User selects files manually (this is fine!)
  // We record clicks on file inputs as regular clicks
  
  // Chain mode benefit during recording:
  // - Downloaded file is in a known location
  // - User just has to navigate to that folder in the picker
  // - Still manual but easier to find
}
```

**Generated code for any file input click:**
```javascript
// Click was recorded during session
await page.locator('input[type="file"]').click();

// In chain mode, we KNOW the file path, so generate this:
const uploadFilePath = path.join(downloadsPath, 'invoice.pdf');
await page.locator('input[type="file"]').setInputFiles(uploadFilePath);
```

### During REPLAY (Automated Test Execution)
**Use setInputFiles() method - NO file chooser event needed**

```typescript
// Generated code for chain uploads:
{
  // File from previous download step
  const uploadFilePath = path.join(downloadsPath, 'invoice.pdf');
  console.log('📤 Uploading file from chain:', uploadFilePath);
  
  // Use setInputFiles - this triggers proper events!
  await page.locator('input[type="file"]').setInputFiles(uploadFilePath);
  console.log('✅ File uploaded:', uploadFilePath);
}
```

**Why setInputFiles() is better than file chooser interception:**
- ✅ Sets files directly on the input element
- ✅ Triggers all proper change/input events
- ✅ Website JavaScript handlers fire normally
- ✅ UI updates to show selected file
- ✅ More reliable across different websites
- ✅ No need to intercept file chooser at all!

---

## Edge Cases & Considerations

### 1. Multiple file inputs on same page
**Solution:** Each file input click generates separate action
```typescript
// Action 1
{ type: 'click', selector: '#file-input-1' }

// Action 2  
{ type: 'click', selector: '#file-input-2' }

// In chain mode, each will auto-select the same downloaded file
```

### 2. New tabs with file inputs
**Solution:** Setup listeners on new pages
```typescript
context.on('page', async (newPage) => {
  // ... existing code ...
  
  // Re-run setupPageListeners for the new page
  this.page = newPage;
  this.setupPageListeners();
});
```

### 3. File input inside iframe
**Current:** Should work - file chooser event fires at page level
**Test:** Need to verify this works

### 4. User cancels file picker in normal mode
**Behavior:** Click is recorded, no file selected
**Generated code:** Shows TODO comment
**Replay:** Will fail unless user adds file path

### 5. Multiple files upload (input[multiple])
**Current:** Not fully supported
**Future:** Could record array of file paths

---

## Testing Checklist

### Test 1: Normal Recording - File Upload (Non-chain)
- [ ] Start recording
- [ ] Navigate to file upload page
- [ ] Click file input
- [ ] **Verify:** Native file picker opens
- [ ] Select a file
- [ ] Complete upload
- [ ] Stop recording
- [ ] **Verify:** Click on file input is recorded
- [ ] **Verify:** No fileUpload action in generated code
- [ ] **Verify:** Generated code has TODO comment

### Test 2: Chain Recording - Download then Upload
- [ ] Start recording
- [ ] Download a file
- [ ] Stop recording
- [ ] Click "Start Upload Recording"
- [ ] Navigate to upload destination
- [ ] Click file input
- [ ] **Verify:** Downloaded file is auto-selected (no dialog)
- [ ] Complete upload
- [ ] Stop recording
- [ ] **Verify:** fileUpload action is recorded
- [ ] **Verify:** Generated code includes file path
- [ ] Replay test
- [ ] **Verify:** Test runs successfully end-to-end

### Test 3: Chain Recording - Multiple Uploads
- [ ] Download file in step 1
- [ ] Upload to destination A in step 2
- [ ] Upload to destination B in step 3
- [ ] **Verify:** Same file is used for both uploads
- [ ] **Verify:** Both uploads recorded correctly

### Test 4: New Tab with File Upload (Chain)
- [ ] Download file
- [ ] Open new tab
- [ ] Click file input in new tab
- [ ] **Verify:** File auto-selected in new tab
- [ ] **Verify:** Upload recorded correctly

---

## Current Implementation Status

### ✅ Completed
- [ ] RecordedAction interface updated with fileUpload type
- [ ] Chain mode file chooser listener
- [ ] Auto-select file in chain mode
- [ ] Generate code for chained uploads
- [ ] Generate code for partial execution

### ⚠️ Needs Fixing
- [ ] **Remove filechooser listener in normal mode**
- [ ] Update documentation
- [ ] Add TODO comments for non-chain file inputs
- [ ] Test with new tabs
- [ ] Test with iframes

### 🔮 Future Enhancements
- [ ] Support multiple file uploads
- [ ] Better handling of drag-and-drop uploads
- [ ] File preview before upload
- [ ] Smart file path detection

---

## Summary

**Key Insight:** 
Don't intercept file chooser during recording - it blocks the website!

**Recording (Both Modes):**
- No filechooser listener → Native picker works
- User selects files manually (even in chain mode)
- File input clicks recorded as regular clicks
- In chain mode, we track the downloaded file path for later use

**Replay (Automated):**
- Use `setInputFiles()` to set files directly
- Triggers proper events, website responds normally
- In chain mode, file path from download step is used automatically
- Fully automated, no dialogs

**Result:**
- Natural browser behavior during recording ✅
- User can complete their workflow ✅
- Fully automated replay ✅
- Works reliably across all websites ✅

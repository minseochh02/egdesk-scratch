# File Upload Recording & Replay Implementation

**Date:** 2026-01-26
**Status:** ✅ Implemented

## Summary

Implemented full file upload recording and replay functionality for the browser recorder, completing the action chain feature for download-to-upload workflows.

## Changes Made

### 1. Updated RecordedAction Interface

Added `'fileUpload'` to the action types and new fields:

```typescript
interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'keypress' | 'screenshot' | 'waitForElement' | 
        'download' | 'datePickerGroup' | 'captureTable' | 'newTab' | 'print' | 
        'clickUntilGone' | 'closeTab' | 'fileUpload';  // <-- Added
  
  // ... existing fields ...
  
  // File upload fields (NEW)
  filePath?: string;        // Path to the file being uploaded
  fileName?: string;        // Name of the file for display
  isChainedFile?: boolean;  // Whether this is from a previous chain step
}
```

### 2. File Chooser Event Handler

**Location:** `browser-recorder.ts` ~line 5283

**What it does:**
- Listens for Playwright's `filechooser` event when user clicks file input
- Records file upload action with selector and file information
- Handles both chained uploads (auto-select) and manual uploads (user selection)

**Key Features:**
- **Chain Mode:** Auto-selects file from previous download step
- **Normal Mode:** Records the file input interaction for manual replay
- Generates CSS selector and XPath fallback for the file input element
- Updates live code preview after recording

### 3. Code Generation for File Uploads

**Location:** `generateTestCode()` method ~line 6052

**Generated Code for Chained Files:**
```javascript
// Upload file from previous chain step
{
  const uploadFilePath = path.join(downloadsPath, 'downloaded-file.pdf');
  console.log('📤 Uploading file from chain:', uploadFilePath);
  
  // Wait for file chooser and set the file
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('input[type="file"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(uploadFilePath);
  console.log('✅ File uploaded:', uploadFilePath);
}
```

**Generated Code for Manual Uploads:**
```javascript
// Manual file upload - you'll need to specify the file path
{
  const uploadFilePath = '/path/to/your/file'; // TODO: Update this path
  console.log('📤 Uploading file:', uploadFilePath);
  
  // Wait for file chooser and set the file
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('input[type="file"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(uploadFilePath);
  console.log('✅ File uploaded');
}
```

**Features:**
- Uses `page.waitForEvent('filechooser')` to handle file picker
- Includes CSS selector with XPath fallback for robustness
- Clear console logging for debugging
- TODO comment for manual uploads requiring user intervention

### 4. Play-to-Action Support

**Location:** `generateTestCodeUpToAction()` method ~line 6618

Added file upload case to partial test execution (Play to Here button), ensuring the feature works in both:
- Full test replay
- Partial execution during development/debugging

## How It Works

### Recording Phase

1. **User clicks file input** → Browser shows file picker
2. **File chooser event fires** → Handler captures:
   - The file input element (selector + XPath)
   - File path (if in chain mode)
   - File name for display
   - Whether it's a chained file
3. **Action recorded** → Added to actions array
4. **Code preview updates** → User sees generated code live

### Replay Phase

1. **Test reaches file upload action** → Code runs:
   ```javascript
   const fileChooserPromise = page.waitForEvent('filechooser');
   await page.locator('selector').click();
   const fileChooser = await fileChooserPromise;
   await fileChooser.setFiles(filePath);
   ```
2. **Playwright intercepts file picker** → No dialog shown
3. **File automatically selected** → Upload proceeds
4. **Test continues** → Seamless automation

## Action Chain Support

This implementation completes the download-to-upload chain feature:

### Example Workflow

**Step 1: Download Invoice**
```javascript
const downloadPromise = page.waitForEvent('download');
await page.locator('#download-btn').click();
const download = await downloadPromise;
const downloadPath = path.join(downloadsPath, 'invoice.pdf');
await download.saveAs(downloadPath);
```

**Step 2: Upload Invoice** ✨ *NEW*
```javascript
const uploadFilePath = path.join(downloadsPath, 'invoice.pdf');
const fileChooserPromise = page.waitForEvent('filechooser');
await page.locator('input[type="file"]').click();
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles(uploadFilePath);
```

**Result:** Fully automated download → upload workflow!

## Testing Recommendations

### Test Case 1: Chained Upload
1. Start recording with a download
2. Stop recording
3. Click "Start Upload Recording"
4. Navigate to upload page
5. Click file input → File auto-selects
6. Complete upload
7. Stop recording
8. Replay test → Should work end-to-end

### Test Case 2: Manual Upload
1. Start recording
2. Navigate to page with file upload
3. Click file input → Select file manually
4. Complete upload
5. Stop recording
6. Edit generated test to update file path
7. Replay test → Should upload specified file

### Test Case 3: Multiple Uploads
1. Record workflow with 2+ file uploads
2. Verify each upload generates separate code blocks
3. Verify selectors are unique
4. Replay test → All uploads should work

## Known Limitations

1. **Manual uploads require editing:** User must update the file path in generated code
2. **Multiple file selection:** Not fully supported yet (only records first file)
3. **Drag-and-drop uploads:** Not captured (only file input clicks)

## Future Enhancements

1. **Smart file path detection:** Try to detect which file was selected
2. **Multiple file uploads:** Support `input[multiple]`
3. **Drag-and-drop support:** Detect and replay drag-drop uploads
4. **File picker preview:** Show file preview in UI before upload
5. **Template files:** Common test files in a fixtures directory

## Files Modified

- `src/main/browser-recorder.ts`
  - Updated `RecordedAction` interface (line 8-42)
  - Updated file chooser handler (line 5283-5399)
  - Updated `generateTestCode()` (line 6052-6110)
  - Updated `generateTestCodeUpToAction()` (line 6618-6642)

## Verification

To verify the implementation works:

```bash
# 1. Start the app
npm run dev

# 2. Open Browser Recorder
# 3. Record a workflow with file upload
# 4. Check generated code includes fileUpload action
# 5. Replay the test
# 6. Verify file uploads successfully
```

## Notes

- Implementation follows existing patterns in codebase
- Uses Playwright's built-in file chooser API
- Maintains compatibility with all existing features
- No breaking changes to existing tests

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** ✅ Yes
**Documentation:** ✅ Complete

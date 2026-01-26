# Chain Recording Feature

## Overview

The chain recording feature allows you to link multiple recordings together to create automated workflows. The most common use case is **download → upload** chains where you:
1. Record downloading a file from one website
2. Record uploading that file to another website
3. Replay both steps automatically in sequence

## How It Works

### Recording a Chain

#### Step 1: Record the Download
1. Start a normal recording
2. Navigate to the source website and download a file
3. Stop recording
4. **Result:** A green banner appears showing "File downloaded: filename.pdf"

#### Step 2: Record the Upload
1. Click "Start Upload Recording" button
2. Enter the destination URL where you want to upload
3. Click "Start Chain Recording"
4. **Automatic upload:** When you click the file input, the downloaded file is automatically selected!
5. **Visual feedback:** A purple notification appears showing "File Auto-Uploaded ✅"
6. Complete the upload workflow
7. Stop recording

### What Happens Behind the Scenes

**During Step 1 (Download):**
- Recording happens normally
- Download action is recorded
- Script path and download path are stored in renderer

**During Step 2 (Upload - Chain Start):**
- User clicks "Start Upload Recording"
- A unique `chainId` is generated
- **Previous script is retroactively added to chain as Step 1** ✨
- Current recording becomes Step 2
- The file chooser event is intercepted
- The downloaded file from Step 1 is automatically selected
- **Visual notification** appears in the browser:
  - ✅ **Success:** Purple gradient notification with filename and checkmark
  - ❌ **Failure:** Red notification with error message
- The file upload action is recorded
- Both scripts are now linked with the same `chainId`

**Metadata Storage:**
- A `chain-metadata.json` file stores the relationship between scripts
- Each script knows its order (Step 1 = download, Step 2 = upload)
- The downloaded filename is tracked for later use

### Visual Feedback

**Success Notification:**
```
┌─────────────────────────────────┐
│ 📤  File Auto-Uploaded       ✅ │
│     filename.pdf                │
│ ────────────────────────────────│
│ Chain recording in progress     │
└─────────────────────────────────┘
```
- Purple/violet gradient background
- Shows uploaded filename
- Auto-dismisses after 3 seconds
- Smooth slide-in animation

**Error Notification:**
```
┌─────────────────────────────────┐
│ ❌  File Upload Failed          │
│     Error message details...    │
│ ────────────────────────────────│
│ You may need to select manually │
└─────────────────────────────────┘
```
- Red gradient background
- Shows specific error message
- Auto-dismisses after 5 seconds
- Helps debug upload issues

### UI Indicators

**In the Test List:**
- Tests that are part of a chain show a purple badge: `🔗 Step 1` or `🔗 Step 2`
- Hovering shows the chain ID
- The "Replay Chain" button appears for chained tests

**Chain Badge Colors:**
- Purple/violet gradient (`#c4b5fd`) indicates chain membership
- Different from regular test badges (blue) and schedule badges (orange)

## Replaying a Chain

### Individual Script Replay
- Click **▶️ Replay** on any script to run just that one step
- Useful for testing individual parts of the chain

### Full Chain Replay
- Click **🔗 Replay Chain (N steps)** to run the entire sequence
- Scripts execute in order automatically
- Progress updates appear in the debug log
- If any step fails, the chain stops and reports the error

### How File Upload Works During Replay

**The Problem:**
During recording, we record TWO actions:
1. **Click** on the file input (user's action)
2. **File Upload** (when file chooser is detected)

If we generate code for BOTH actions separately during replay:
```javascript
// Generated click action (NO listener)
await page.locator('input[type="file"]').click();  // ❌ Opens native picker, script stuck!

// Generated file upload action (never executes)
await page.locator('input[type="file"]').setInputFiles(uploadFilePath);
```

**The Solution:**
We intercept the file chooser event during replay, just like we do during recording:

1. **Skip the click action** when followed by a fileUpload action
2. **Combine them** in the fileUpload block with the file chooser listener:

```javascript
// ✅ CORRECT APPROACH (same pattern as recording)
const fileChooserPromise = page.waitForEvent('filechooser');  // Register listener FIRST
await page.locator('input[type="file"]').click();  // Click triggers the event
const fileChooser = await fileChooserPromise;  // Listener catches it
await fileChooser.setFiles(uploadFilePath);  // Handle programmatically
```

**Why This Works:**
- ✅ `page.waitForEvent('filechooser')` registers a listener
- ✅ The listener **blocks the native file picker** automatically
- ✅ Click triggers the file chooser event
- ✅ Our listener catches it and handles it programmatically
- ✅ Script runs without user interaction
- ✅ **Same pattern as recording** - consistent behavior!

## File Upload Fix Summary

The file upload feature had two main bugs that were fixed:

### Bug #1: Filename Prefix Contamination
**Problem:** The download action was recorded as:
```javascript
value: `Download completed: ${filename}`
```

When starting chain recording, this value was used directly in the file path:
```javascript
/Users/.../Download completed: 지명원_수정_최종_20220711.pdf  // ❌ Invalid path!
```

**Fix:** Strip the prefix when constructing paths (in 3 places):
- `setChainParameters()` in browser-recorder.ts
- Both `playwright-test-saved` handlers in chrome-handlers.ts (lines ~1683 and ~1770)

### Bug #2: Wrong Script Folder
**Problem:** Using `this.scriptName` (current recording) instead of previous recording's folder:
```javascript
// Wrong: Current recording folder
/Users/.../egdesk-browser-recorder-2026-01-26T04-06-47-555Z/file.pdf

// Correct: Previous recording folder where file was actually downloaded
/Users/.../egdesk-browser-recorder-2026-01-26T04-01-42-042Z/file.pdf
```

**Fix:** Pass full path from previous recording instead of just filename:
- Chrome-handlers already constructed correct `lastDownloadPath`
- Updated renderer to store and pass `lastDownloadPath` instead of `lastDownloadedFile`
- Updated `setChainParameters()` to accept full path directly

## Technical Architecture

### Components

1. **Chain Metadata Store** (`src/main/chain-metadata.ts`)
   - Singleton class managing chain relationships
   - Stores chains in `chain-metadata.json`
   - Provides methods to add, get, and cleanup chains

2. **Browser Recorder** (`src/main/browser-recorder.ts`)
   - `setChainParameters()` - Sets up chain mode
   - `getChainMetadata()` - Returns chain info for saving
   - File chooser listener automatically uploads in chain mode

3. **IPC Handlers** (`src/main/chrome-handlers.ts`)
   - `launch-browser-recorder-enhanced` - Starts recording with optional chain params
   - `get-playwright-tests` - Returns tests with chain metadata
   - `run-chain` - Executes all scripts in a chain sequentially

4. **UI** (`src/renderer/components/BrowserRecorder/BrowserRecorderPage.tsx`)
   - Chain badge display
   - "Replay Chain" button
   - Upload recording workflow

### Data Flow

```
┌─────────────────┐
│  Record Step 1  │ Download file
│  (Download)     │────────┐
└─────────────────┘        │
                           │ Save metadata
                           ▼
                    ┌──────────────┐
                    │ Chain Store  │
                    │ chainId: xxx │
                    │ scripts: [1] │
                    └──────────────┘
                           ▲
                           │ Add script 2
┌─────────────────┐        │
│  Record Step 2  │        │
│  (Upload)       │────────┘
└─────────────────┘

Then for replay:

┌──────────────┐
│ Replay Chain │
└──────┬───────┘
       │
       ├─▶ Run Script 1 (Download)
       │   ├─ Navigate to source
       │   ├─ Download file to ~/Downloads/EGDesk-Browser/script-name/file.pdf
       │   └─ ✅ Complete
       │
       └─▶ Run Script 2 (Upload)
           ├─ Navigate to destination
           ├─ Auto-select file from Script 1's download folder
           ├─ Complete upload
           └─ ✅ Complete
```

## Testing the Feature

### Manual Test Flow
1. **Record download**
   - Go to any file download site
   - Download a file
   - Stop recording
   - Verify green banner appears

2. **Record upload**
   - Click "Start Upload Recording"
   - Enter destination URL
   - Click file input → file auto-selected ✅
   - Complete upload
   - Stop recording

3. **Verify metadata**
   - Check `~/EGDesk/output/browser-recorder-tests/chain-metadata.json`
   - Should contain chain with 2 scripts

4. **Test individual replay**
   - Click ▶️ Replay on Script 1 → Should download file
   - Click ▶️ Replay on Script 2 → Should upload file (if file exists)

5. **Test chain replay**
   - Click 🔗 Replay Chain → Should run both steps automatically
   - Check debug logs for progress updates

### Known Limitations

1. **Single file chains only**
   - Currently supports one download → one upload
   - Multiple uploads of same file requires extending the chain

2. **No drag-and-drop**
   - Only works with `<input type="file">` elements
   - Drag-and-drop uploads not supported yet

3. **No cross-device chains**
   - File paths are local to the machine
   - Can't replay on different computer without file

## Future Enhancements

- [ ] Support multiple uploads in a chain
- [ ] Support branching chains (one download → multiple uploads)
- [ ] Visual chain diagram in UI
- [ ] Chain templates/presets
- [ ] Export/import chains
- [ ] Cloud storage for chain files

## Debug Logging

Key logs to watch for:

**During Recording (Terminal):**
```
🔗 Setting up file chooser listener for chain mode
📂 Will auto-select: /Users/.../file.pdf
🔍 DEBUG: FILECHOOSER CALLBACK FIRED!!!
🎯 File exists: true
✅ File auto-selected successfully
📝 Recorded file upload action
```

**During Recording (Browser):**
- Purple notification appears centered on screen
- Shows "File Auto-Uploaded ✅" with filename
- Disappears after 3 seconds
- If upload fails, red error notification appears instead

**During Replay:**
```
🔗 Running chain: chain-1234567890
📋 Chain has 2 script(s)
🎬 Running step 1: script-1.spec.js
✅ Step 1 completed
🎬 Running step 2: script-2.spec.js
✅ Step 2 completed
✅ Chain completed successfully
```

## Troubleshooting

### File not auto-uploading
**Symptoms:** No purple notification appears, file picker opens normally

**Solutions:**
1. Check terminal for debug logs - should see "FILECHOOSER CALLBACK FIRED!!!"
2. If no callback logs → listener not registered properly
3. If callback fires but fails → check error notification message
4. Verify file exists at `chainDownloadPath` shown in logs

### File not found during upload
**Symptoms:** Red error notification: "Downloaded file not found"

**Solutions:**
- Check `lastDownloadPath` in metadata
- Verify file exists at that location
- Ensure "Download completed: " prefix is stripped
- Check previous script's downloads folder

### No visual notification
**Symptoms:** Upload works but no notification appears

**Solutions:**
- Check browser console for JavaScript errors
- Page may have CSP (Content Security Policy) blocking injected styles
- Notification might be behind modal/dialog - check z-index conflicts
- Terminal logs will still show success/failure

### Chain doesn't show in UI
**Symptoms:** Tests recorded but no chain badge

**Solutions:**
- Refresh test list
- Check chain-metadata.json exists in output folder
- Verify both scripts still exist
- Check browser DevTools for IPC errors

### Wrong step numbers (Step 1 has no badge, Step 2 shows as Step 1)
**Symptoms:** Download script has no chain badge, upload script shows "Step 1"

**Root Cause:** This was a bug where the download script wasn't retroactively added to the chain.

**Fix Applied:** When starting chain recording (Step 2), the system now:
1. Generates a chainId
2. **Adds the previous download script as Step 1** ✅
3. Adds the current upload script as Step 2

**If you still see this:**
- Delete both scripts
- Re-record the chain workflow
- The fix ensures proper ordering now

### Replay fails
**Symptoms:** Chain execution stops mid-way

**Solutions:**
- Check console for error messages
- Verify scripts haven't been renamed/moved
- Try replaying individual steps first
- Check if download folder exists from Step 1

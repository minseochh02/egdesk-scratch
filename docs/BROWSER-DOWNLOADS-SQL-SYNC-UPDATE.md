# Browser Downloads SQL Sync - Script-Based View Update

## 🔄 What Changed

Updated the sync wizard from **file-based** to **script-based** browsing for better organization and to prepare for automatic sync functionality.

---

## Before vs After

### ❌ Before (File-Based)
```
Step 1: Shows ALL Excel files from all scripts mixed together
        ↓
Step 2: Select a file
        ↓
Step 3: Import
```

**Problem:** Hard to find files when you have multiple browser automations running

### ✅ After (Script-Based)
```
Step 1: Shows browser automation SCRIPTS
        ↓
Step 2: Select a script → See only that script's files
        ↓
Step 3: Select a file
        ↓
Step 4: Import
```

**Benefit:** Much cleaner organization, prepares for auto-sync feature

---

## New User Flow

### Step 1: Select Browser Automation Script

```
┌──────────────────────────────────────────────────┐
│ 🤖 Browser Automation Scripts                   │
├──────────────────────────────────────────────────┤
│                                                  │
│  🤖 KB Card All Transactions                     │
│  3 Excel files • 5 total files • 456 KB          │
│  Last modified: 2/11/2026, 10:30 AM    Connect →│
│                                                  │
│  🤖 NH Card Get All Cards                        │
│  2 Excel files • 2 total files • 234 KB          │
│  Last modified: 2/11/2026, 9:15 AM     Connect →│
│                                                  │
│  🤖 Sales Report Download                        │
│  10 Excel files • 15 total files • 2.3 MB        │
│  Last modified: 2/10/2026, 11:45 PM    Connect →│
│                                                  │
└──────────────────────────────────────────────────┘
```

### Step 2: Select File from Script

```
┌──────────────────────────────────────────────────┐
│ 🤖 KB Card All Transactions                     │
│ Select an Excel file from this automation       │
├──────────────────────────────────────────────────┤
│                                                  │
│  📄 transactions-2024-02-11.xlsx                 │
│  156 KB • 2/11/2026, 10:30 AM          Select → │
│                                                  │
│  📄 transactions-2024-02-10.xlsx                 │
│  142 KB • 2/10/2026, 10:30 AM          Select → │
│                                                  │
│  📄 transactions-2024-02-09.xlsx                 │
│  138 KB • 2/9/2026, 10:30 AM           Select → │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Steps 3-7: Same as before
(Import Mode → Column Mapping → Preview → Import → Complete)

---

## Technical Changes

### Frontend

**BrowserDownloadsSyncWizard.tsx:**
- Added `folder-selection` step before `file-selection`
- New interface: `BrowserDownloadFolder` with `scriptName` and `folderName`
- New render function: `renderFolderSelection()`
- Updated step indicator: 7 steps instead of 6
- Changed icons: 📁 → 🤖 for scripts

**UserData.css:**
- New styles for folder/script cards
- Added `.browser-download-folder-card`
- Added `.browser-download-folder-timestamp`
- Different hover colors (blue instead of green)

### Backend

**chrome-handlers.ts:**
- New handler: `get-browser-download-folders`
  - Scans `~/Downloads/EGDesk-Browser/` for script folders
  - Counts Excel files per folder
  - Calculates total folder size
  - Tracks last modified time
  - **Parses script names from folder names**

- New handler: `get-folder-files`
  - Gets all files in a specific script folder
  - Filters and sorts by modified date

**preload.ts:**
- Exposed `getBrowserDownloadFolders()`
- Exposed `getFolderFiles(folderPath)`

---

## Script Name Parsing

The backend intelligently parses folder names into human-readable script names:

### Examples

| Folder Name | Parsed Script Name |
|-------------|-------------------|
| `KBCard-alltransactions-2026-01-26T06-35-19-003Z` | **KB Card Alltransactions** |
| `NHCard-getallcards-2026-01-26T11-14-30-123Z` | **NH Card Getallcards** |
| `egdesk-browser-recorder-2026-01-26T17-33-45-678Z` | **Egdesk Browser Recorder** |
| `sales-report-download` | **Sales Report Download** |

**Parsing Logic:**
1. Remove timestamp suffix (e.g., `-2026-01-26T06-35-19-003Z`)
2. Split by hyphens
3. Title case each word
4. Join with spaces

---

## Preparing for Auto-Sync

This script-based view lays the foundation for automatic sync:

### Future Enhancement (Next Phase)
```
User connects: "KB Card All Transactions" script → "transactions" SQL table

Then, whenever this script downloads a new Excel file:
  ↓
Auto-detected by file watcher
  ↓
Automatically synced to "transactions" table
  ↓
User gets notification: "2 new rows added to transactions"
```

**Benefits:**
- Zero-touch automation
- Real-time data sync
- Perfect for scheduled scripts
- Audit trail in `import_operations`

---

## User Benefits

### 1. **Better Organization**
- See automations grouped by purpose
- Easily identify which script downloaded which files

### 2. **Clearer Context**
- Script names provide context (e.g., "KB Card All Transactions")
- Know what kind of data to expect

### 3. **Faster Navigation**
- Don't scroll through 100 mixed files
- Go directly to the script you want

### 4. **Future-Proof**
- Prepares for auto-sync feature
- Enables script → table connections

---

## Migration Notes

### For Existing Users
- No data migration needed
- All existing files still accessible
- Just organized differently in UI

### For Developers
- Backward compatible with existing downloads
- Folder structure unchanged
- Only UI and parsing logic added

---

## Testing Checklist

- [ ] List browser automation scripts correctly
- [ ] Parse script names from folder names
- [ ] Count Excel files accurately
- [ ] Navigate from script → files → import
- [ ] Back button works through all steps
- [ ] Refresh button updates script list
- [ ] Handle empty folders gracefully
- [ ] Handle folders with no Excel files
- [ ] Sort by last modified correctly

---

## API Reference

### New IPC Handlers

#### `get-browser-download-folders`
**Returns:**
```typescript
{
  success: boolean;
  folders: Array<{
    scriptName: string;      // "KB Card All Transactions"
    folderName: string;      // "KBCard-alltransactions-2026..."
    path: string;            // Full path to folder
    fileCount: number;       // Total files
    excelFileCount: number;  // Excel files only
    size: number;            // Total size in bytes
    lastModified: Date;      // Last file modification
  }>;
}
```

#### `get-folder-files`
**Parameters:** `folderPath: string`

**Returns:**
```typescript
{
  success: boolean;
  files: Array<{
    name: string;
    path: string;
    scriptFolder: string;
    size: number;
    created: Date;
    modified: Date;
  }>;
}
```

---

## Summary

✅ **Changed from file-based to script-based browsing**
✅ **Better organization for users**
✅ **Prepares for auto-sync feature**
✅ **Cleaner UI with human-readable script names**
✅ **All existing functionality preserved**

**Status:** Complete and ready for testing!

---

## Next Steps

1. **Test the new UI** with real browser automation folders
2. **Gather user feedback** on the script-based organization
3. **Implement auto-sync** feature (next phase):
   - Create script → table connections
   - File watcher for new downloads
   - Automatic import on new files
   - Notification system

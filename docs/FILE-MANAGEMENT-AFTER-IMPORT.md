# File Management After Import

## Overview

After successfully importing Excel data to SQL, users can choose what happens to the original file. Three options available:

1. **Keep Original** - Leave file in place
2. **Move to "Processed" Folder** - Archive for backup (Recommended) ✅
3. **Delete File** - Remove permanently ⚠️

---

## The Options

### 1. Keep Original (No Action)

**What it does:**
- File stays in original location
- No changes made

**Use when:**
- You want to manually manage files
- Testing/debugging imports
- Might need to re-import

**Folder structure:**
```
~/Downloads/EGDesk-Browser/
  ├── KBCard-transactions/
  │   ├── trans-feb-11.xlsx    ← Stays here
  │   ├── trans-feb-12.xlsx
  │   └── trans-feb-13.xlsx
```

---

### 2. Move to "Processed" Folder (Recommended) ✅

**What it does:**
- Moves file to `script-folder/processed/` subfolder
- Keeps backup of imported files
- If file exists, adds timestamp to prevent overwrites

**Use when:**
- Want clean download folder
- Need audit trail/backup
- Automated workflows
- **Best for production use**

**Folder structure:**
```
~/Downloads/EGDesk-Browser/
  ├── KBCard-transactions/
  │   ├── trans-feb-14.xlsx    ← New downloads
  │   └── processed/            ← Processed files archived here
  │       ├── trans-feb-11.xlsx
  │       ├── trans-feb-12.xlsx
  │       └── trans-feb-13.xlsx
```

**Duplicate handling:**
```
If processed/report.xlsx already exists:
→ New file saved as: processed/report_2024-02-11T10-30-45-123Z.xlsx
```

---

### 3. Delete File (Permanent) ⚠️

**What it does:**
- Permanently deletes the file
- Cannot be undone
- Frees disk space

**Use when:**
- Files are very large
- Disk space is limited
- Data is backed up elsewhere
- **Use with caution**

**Warning:**
```
⚠️ File will be permanently deleted!
   Make sure SQL data imported successfully first.
```

---

## UI Flow

### Step 3: Configure Parsing

After configuring header rows and skip options, users see:

```
┌────────────────────────────────────────────────┐
│ 🗂️ After Import                                │
├────────────────────────────────────────────────┤
│ What should happen to the Excel file after    │
│ successful import?                             │
│                                                │
│ ○ Keep Original                                │
│   Leave file in downloads folder (no action)  │
│                                                │
│ ● Move to "Processed" Folder  ← Recommended   │
│   Keeps backup in script/processed/ folder    │
│                                                │
│ ○ Delete File  ⚠️ Permanent                    │
│   Removes file completely (cannot undo)       │
│                                                │
└────────────────────────────────────────────────┘
```

**Default:** Move to "Processed" Folder (safest option)

---

## Technical Implementation

### Frontend (BrowserDownloadsSyncWizard.tsx)

**State:**
```typescript
const [deleteAfterImport, setDeleteAfterImport] = useState(false);
const [archiveAfterImport, setArchiveAfterImport] = useState(true);
```

**After Import:**
```typescript
if (deleteAfterImport) {
  await electron.debug.deleteFile(filePath);
} else if (archiveAfterImport) {
  await electron.debug.archiveFile(filePath);
}
// else: keep original (no action)
```

### Backend (chrome-handlers.ts)

#### Handler: `delete-file`
```typescript
ipcMain.handle('delete-file', async (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }
  
  fs.unlinkSync(filePath);
  console.log('File deleted:', filePath);
  
  return { success: true };
});
```

#### Handler: `archive-file`
```typescript
ipcMain.handle('archive-file', async (event, filePath) => {
  // Get script folder
  const scriptFolder = path.dirname(filePath);
  const fileName = path.basename(filePath);
  
  // Create processed subfolder
  const processedFolder = path.join(scriptFolder, 'processed');
  fs.mkdirSync(processedFolder, { recursive: true });
  
  // Move file (with duplicate handling)
  let newPath = path.join(processedFolder, fileName);
  if (fs.existsSync(newPath)) {
    // Add timestamp if exists
    newPath = addTimestamp(newPath);
  }
  
  fs.renameSync(filePath, newPath);
  return { success: true, newPath };
});
```

---

## Use Cases

### Case 1: Daily Card Transactions (Recommended: Archive)

**Scenario:**
- Browser automation downloads card statement daily
- Import to SQL automatically
- Need to keep originals for audit

**Configuration:**
- ✅ Move to "Processed" Folder

**Result:**
```
Day 1: trans-feb-11.xlsx → SQL → processed/trans-feb-11.xlsx
Day 2: trans-feb-12.xlsx → SQL → processed/trans-feb-12.xlsx
Day 3: trans-feb-13.xlsx → SQL → processed/trans-feb-13.xlsx

Benefit: Clean download folder, full backup history
```

---

### Case 2: Large Data Dumps (Consider: Delete)

**Scenario:**
- Automation downloads 100MB Excel files
- Only need SQL data
- Disk space is limited

**Configuration:**
- ⚠️ Delete File (after confirming import success)

**Result:**
```
Download → Import → Delete
Benefit: No disk space wasted
Risk: Can't re-import if SQL data has issues
```

---

### Case 3: Testing/Development (Keep Original)

**Scenario:**
- Testing import configurations
- Might need to retry with different settings
- Want to inspect original files

**Configuration:**
- ✅ Keep Original

**Result:**
```
Files stay in download folder
Benefit: Easy access for re-import/debugging
```

---

## Safety Features

### 1. Only After Successful Import

Files are only moved/deleted if:
- ✅ SQL table created successfully
- ✅ All rows imported (or skipped with reason)
- ✅ No critical errors

If import fails → File stays in place

### 2. Duplicate Handling

When archiving, if file already exists:
```
Original: report.xlsx
Exists: processed/report.xlsx
New name: processed/report_2024-02-11T10-30-45-123Z.xlsx
```

No overwrites, no data loss!

### 3. Transaction Safety

Import happens in transaction:
```typescript
try {
  importToSQL();
  if (success) {
    handleFile(); // Only if SQL import succeeded
  }
} catch (error) {
  // File not touched if import fails
}
```

---

## Future: Auto-Sync with File Watching

### Phase 2: Automatic File Processing

When auto-sync is enabled:

```typescript
// Watch for new files in script folder
watchFolder(scriptFolder, (newFile) => {
  if (isExcelFile(newFile)) {
    // Auto-import with saved configuration
    importToSQL(newFile, savedConfig);
    
    // Auto-process based on saved preference
    if (config.deleteAfterImport) {
      deleteFile(newFile);
    } else if (config.archiveAfterImport) {
      archiveFile(newFile);
    }
  }
});
```

**Benefits:**
- Zero-touch automation
- Files automatically cleaned up
- Consistent processing

---

## Best Practices

### For Daily Automations
```
✅ Use: Move to "Processed" Folder
Why: Keeps audit trail, clean download folder
```

### For One-Time Imports
```
✅ Use: Keep Original
Why: Might want to re-import or verify
```

### For High-Volume/Large Files
```
⚠️ Consider: Delete File
Why: Save disk space
Caution: Only if you trust the import process
```

### For Production Systems
```
✅ Use: Move to "Processed" Folder
Why: Balance of cleanliness and safety
Add: Periodic cleanup of processed/ folder
```

---

## Folder Structure Examples

### Example 1: Archiving Enabled
```
~/Downloads/EGDesk-Browser/
├── KBCard-Transactions/
│   ├── trans-2024-02-14.xlsx       ← Today's download
│   └── processed/                  ← Archived
│       ├── trans-2024-02-11.xlsx
│       ├── trans-2024-02-12.xlsx
│       └── trans-2024-02-13.xlsx
│
├── NHCard-AllCards/
│   ├── cards-latest.xlsx
│   └── processed/
│       ├── cards-2024-02-10.xlsx
│       └── cards-2024-02-11.xlsx
│
└── Sales-Reports/
    ├── sales-feb.xlsx
    └── processed/
        ├── sales-jan.xlsx
        └── sales-dec.xlsx
```

### Example 2: Delete Enabled
```
~/Downloads/EGDesk-Browser/
├── KBCard-Transactions/
│   └── [empty - all files deleted after import]
│
├── NHCard-AllCards/
│   └── cards-latest.xlsx  ← Only newest file exists
```

---

## Error Handling

### If File Move Fails
```
Import: ✅ Success (data in SQL)
Archive: ❌ Failed (file locked, permissions)
Result: File stays in download folder
Action: User notified, can manually move later
```

### If File Delete Fails
```
Import: ✅ Success (data in SQL)
Delete: ❌ Failed (file in use)
Result: File stays in download folder
Action: User notified, can manually delete later
```

**Key Point:** Import success is independent of file handling. SQL data is safe even if file operation fails.

---

## Testing Checklist

- [ ] Keep Original works (no file operation)
- [ ] Archive creates processed/ folder
- [ ] Archive moves file correctly
- [ ] Archive handles duplicates with timestamp
- [ ] Delete removes file permanently
- [ ] File only processed after successful import
- [ ] File stays if import fails
- [ ] Works with create new table
- [ ] Works with sync to existing table
- [ ] Error messages if file operation fails
- [ ] Processed folder ignored in file listing

---

## Summary

**Three Options:**
1. ✅ **Keep** - No action (testing/manual)
2. ✅ **Archive** - Move to processed/ (recommended)
3. ⚠️ **Delete** - Permanent removal (space-saving)

**Key Features:**
- Only after successful import
- Duplicate handling with timestamps
- Safe error handling
- Per-import configuration

**Recommendation:** Use Archive for production workflows!

**Status:** ✅ Complete and ready for testing!

# 🚀 Auto-Sync Quick Start Guide

**Get your browser automation downloads automatically imported to SQL in 3 steps!**

---

## Step 1: Create Configuration (One-Time Setup)

1. Go to **User Data** page
2. Click **🔄 Sync Browser Downloads**
3. Select your browser automation script (e.g., "KB Card Transactions")
4. Select an Excel file to import
5. Configure parsing:
   - Header row: `1` (or where your headers are)
   - Skip bottom rows: `0` (or number of summary rows)
6. Choose import mode:
   - **Create New Table** (recommended for first time)
   - Or **Sync to Existing Table**
7. Map your columns (drag & drop or auto-match)
8. In the **Preview** step:
   - ✅ Check **"Remember this configuration"**
   - ✅ Check **"Enable Auto-Sync"** ⭐
9. Click **Import**

**Done!** Auto-sync is now active for this script.

---

## Step 2: Verify It's Working

1. Click **⚙️ Configurations** button
2. Find your configuration in the list
3. Look for: **"● Active - Watching for new files"**
4. Footer should show: **"1 active watcher"**

If you see this, you're all set! 🎉

---

## Step 3: Test It

### Manual Test:
1. Manually copy an Excel file into the script's download folder
2. Wait 2-3 seconds
3. Check for desktop notification: **"✅ Auto-Sync Complete"**
4. File should move to `processed/` subfolder
5. Check your SQL table - data should be there!

### Real Test:
1. Run your browser automation script
2. Let it download an Excel file
3. Within seconds, you'll see the notification
4. Data is automatically in your SQL table!

---

## Managing Configurations

### View All Configurations:
- Click **⚙️ Configurations**
- See all saved configurations
- Live status updates every 5 seconds

### Disable Auto-Sync Temporarily:
- Uncheck **"Auto-Sync Enabled"**
- Watcher stops immediately
- You can still manually import

### Re-enable Auto-Sync:
- Check **"Auto-Sync Enabled"** again
- Watcher starts immediately
- Resumes monitoring

### Delete Configuration:
- Click **🗑️ Delete** button
- Confirms deletion
- Watcher stops
- SQL table is NOT deleted (only config)

---

## Troubleshooting

### ❌ "Not watching (will start when enabled)"

**Possible Causes:**
1. Auto-Sync is disabled → Check the checkbox
2. Configuration is disabled → Toggle the main switch
3. Folder doesn't exist → Check folder path

**Fix:** Toggle Auto-Sync on and ensure config is enabled.

---

### ❌ Files Not Being Imported

**Check:**
1. Is auto-sync enabled? ✅
2. Is file in the right folder?
3. Is it an Excel file (`.xlsx`, `.xls`, `.xlsm`)?
4. Is it in `processed/` or `failed/` subfolder? (These are ignored)

**Look At:**
- Check desktop notifications for error messages
- Open **⚙️ Configurations** → View Details → See error log

---

### ❌ Import Failed

**What Happens:**
- File moved to `failed/` subfolder
- Desktop notification shows error
- Config shows "Last Sync: Failed"
- Error message logged

**Common Errors:**
- **"File is not a valid Excel file"** → Corrupted download
- **"Target table not found"** → Table was deleted
- **"Column mapping failed"** → Excel structure changed

**Fix:**
- Check the error message in config details
- Manually inspect the file in `failed/` folder
- Update configuration if Excel structure changed

---

## File Management

### Where Do Files Go?

**Original Location:**
```
~/Downloads/EGDesk-Browser/YourScript-2026.../
├── new-file.xlsx          ← Will be auto-imported
├── processed/             ← Archived files
│   └── old-file.xlsx
└── failed/                ← Failed imports
    └── bad-file.xlsx
```

### File Actions:

**Archive (Default):**
- Files moved to `processed/` after successful import
- Keeps files for later review
- Recommended for most use cases

**Delete:**
- Files permanently deleted after successful import
- Use for temporary data you don't need
- Saves disk space

**Keep:**
- Files stay in original location
- Good for manual review workflow
- Folder can get cluttered

---

## Tips & Best Practices

### ✅ Do This:

1. **Test with one file first** before enabling auto-sync
2. **Use "Archive" file action** (safest option)
3. **Check first import carefully** to ensure mappings are correct
4. **Monitor desktop notifications** when testing
5. **Keep similar scripts in separate folders** for clarity

### ⚠️ Avoid This:

1. Don't change Excel file structure after configuring
2. Don't manually delete SQL table while auto-sync is active
3. Don't put non-Excel files in watched folders
4. Don't rename script folders after configuring

---

## Monitoring

### Check Recent Activity:
1. Open **⚙️ Configurations**
2. View **Last Sync** info on each config
3. See rows imported/skipped
4. Check timestamp

### View Detailed Logs:
*Coming soon: Activity log viewer*

For now, check console logs or query database:
```sql
SELECT * FROM sync_activity_log 
ORDER BY started_at DESC 
LIMIT 20;
```

---

## Common Scenarios

### Scenario 1: "I want to change column mappings"

**Option A: Edit Configuration (Future)**
- Will be added in next update

**Option B: Create New Configuration**
1. Disable old configuration
2. Create new one with correct mappings
3. Delete old configuration

---

### Scenario 2: "Excel file structure changed"

**What Happens:**
- Imports will start failing
- Desktop notification: "❌ Column mapping failed"
- Files move to `failed/` folder

**Fix:**
1. Disable auto-sync
2. Import one file manually with new structure
3. Save new configuration
4. Delete old configuration

---

### Scenario 3: "I want auto-sync for multiple scripts"

**Easy!**
1. Create a configuration for each script
2. Enable auto-sync on each one
3. All watchers run simultaneously
4. Each script's files import to its own table

**Example:**
- Script 1: KB Card → `kb_card_transactions`
- Script 2: Shinhan Bank → `shinhan_transactions`
- Script 3: Sales Data → `sales_data`

All three auto-sync independently! 🎉

---

## Summary

**3 Steps to Auto-Sync:**
1. ✅ Create configuration with "Auto-Sync" enabled
2. ✅ Verify watcher is active
3. ✅ Let automation run - files import automatically!

**After that:** Set it and forget it! 🚀

---

## Need Help?

Check these docs:
- `PHASE-1-SAVE-CONFIGURATIONS.md` - Configuration details
- `PHASE-2-FILE-WATCHER-AUTO-SYNC.md` - How auto-sync works
- `AUTO-SYNC-COMPLETE-SUMMARY.md` - Complete overview

Or check desktop notifications and error logs for specific issues.

---

**Happy Auto-Syncing!** 🎊

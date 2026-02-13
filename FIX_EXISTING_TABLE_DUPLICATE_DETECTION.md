# Fix Duplicate Detection for Existing Table

## Problem
Your existing table was created BEFORE duplicate detection was added, so it doesn't have `uniqueKeyColumns` configured. This means duplicate detection isn't working and files keep importing the same data.

## Solution Options

### Option 1: Quick Fix via Developer Console (Recommended)

1. **Open Developer Console** in your app (View → Toggle Developer Tools)

2. **Run this command:**
```javascript
// Update existing table with duplicate detection
await window.electron.invoke('user-data:update-duplicate-settings', 
  'c487e173-2d19-41ce-bf80-edc68f322e33',  // Your table ID from logs
  {
    uniqueKeyColumns: ['일자', '판매처명', '공급가액'],  // Date + Merchant + Amount
    duplicateAction: 'skip'
  }
);
```

3. **Verify it worked:**
```javascript
const table = await window.electron.invoke('user-data:get-table', 'c487e173-2d19-41ce-bf80-edc68f322e33');
console.log('Duplicate Detection Settings:', {
  uniqueKeyColumns: table.data.uniqueKeyColumns,
  duplicateAction: table.data.duplicateAction
});
```

4. **Test**: Import the same file again - duplicates should now be skipped! ✅

---

### Option 2: Delete & Recreate Table (Clean Slate)

1. Go to User Data page
2. Delete the existing table
3. Re-import with the new Duplicate Detection UI
4. Configure duplicate detection during import
5. All future imports will respect duplicate detection ✅

---

### Option 3: Update Sync Configuration (If using auto-sync)

If you have a sync configuration, update it too:

```javascript
// Get sync config ID
const configs = await window.electron.invoke('sync-config:get-all');
console.log('Sync Configs:', configs.data);

// Update the config (use the ID from above)
await window.electron.invoke('sync-config:update', 
  'YOUR-CONFIG-ID-HERE',
  {
    uniqueKeyColumns: ['일자', '판매처명', '공급가액'],
    duplicateAction: 'skip'
  }
);
```

---

## Why This Happened

Your table was created before we added:
- Database migrations (added columns but didn't set values)
- Duplicate detection UI
- Auto-detection logic

Tables created now will automatically have duplicate detection configured!

---

## Recommended Unique Key for Your Data

Based on your schema:
```
일자 (DATE) + 판매처명 (TEXT) + 공급가액 (INTEGER)
```

This combination should uniquely identify each transaction.

If you want stricter matching, add more columns:
```
일자 + 판매처명 + 공급가액 + 품목명_규격_
```

---

## Testing

After applying the fix:

1. Import the same file again
2. Check console logs for: `🔄 X duplicates skipped`
3. Verify row count doesn't increase
4. Success! ✅


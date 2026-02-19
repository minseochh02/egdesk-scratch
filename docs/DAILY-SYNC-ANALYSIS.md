# Daily Sync System - Analysis & Implementation Status

## ✅ ALREADY IMPLEMENTED (Found in Code)

### 1. Scheduler Infrastructure (`FinanceHubScheduler.ts`)
- ✅ Daily timer system with staggered execution times
- ✅ Cards: 4:00-5:10 AM (10-min intervals)
- ✅ Banks: 5:20-6:30 AM (10-min intervals)
- ✅ Tax: 6:40 AM
- ✅ Retry logic (3 retries, 5-min delay)
- ✅ Duplicate prevention (checks if already ran today)

### 2. Individual Sync Methods (JUST IMPLEMENTED)
- ✅ `syncCard(cardId)` - Lines 454-589
  - Logs in with saved credentials
  - Fetches **yesterday's transactions** (1 day range)
  - Imports to SQLite database
  - Returns: `{ success, inserted, skipped, error }`

- ✅ `syncBank(bankId)` - Lines 590-734
  - Logs in with saved credentials
  - Fetches **yesterday's transactions** (1 day range)
  - Imports to SQLite database
  - Returns: `{ success, inserted, skipped, error }`

- ✅ `syncTax(businessNumber)` - Already working
  - Collects tax invoices
  - Imports to database

### 3. Spreadsheet Export Method (`exportToSpreadsheet()`)
- ✅ **ALREADY EXISTS** at line 835-895
- ✅ Gets last 1000 transactions from database
- ✅ Uses `getOrCreateTransactionsSpreadsheet()` from sheets-service.ts
- ✅ Updates persistent spreadsheet: `financeHub.persistentSpreadsheets['scheduler-sync']`
- ✅ Stores spreadsheet ID for reuse

## ❌ WHAT'S MISSING - INTEGRATION

### Missing Step 1: Call Spreadsheet Export After Each Sync

**Current Flow:**
```
executeEntitySync() → syncCard() → [Database Import] → DONE ❌
```

**Needed Flow:**
```
executeEntitySync() → syncCard() → [Database Import] → exportToSpreadsheet() → DONE ✅
```

**Where to add:** Line 410 in `executeEntitySync()`, after success check

### Missing Step 2: File Cleanup

**Files that accumulate:**
- `output/kb-card/downloads/*.xls`
- `output/nh-card/downloads/*.xls`
- `output/bc-card/downloads/*.zip` + extracted folders in `/tmp`
- `output/shinhan-card/downloads/*.xls`
- `output/hana-card/downloads/*.xls`
- Bank download folders

**Need to add:** `cleanupDownloadedFiles(entityType, entityId)` method

**Where to call:** After spreadsheet export succeeds

## FINAL IMPLEMENTATION NEEDED

### Step 1: Modify `executeEntitySync()` (Line 366-445)

**Add after line 410:**
```typescript
// After sync succeeds, export to spreadsheet
if (success && this.settings.spreadsheetSyncEnabled) {
  console.log(`[FinanceHubScheduler] Exporting ${entityKey} to spreadsheet...`);
  const exportResult = await this.exportToSpreadsheet();

  if (exportResult.success) {
    console.log(`[FinanceHubScheduler] ✅ Spreadsheet updated: ${exportResult.spreadsheetUrl}`);

    // Cleanup downloaded files only if both database + spreadsheet succeeded
    await this.cleanupDownloadedFiles(entityType, entityId);
  } else {
    console.warn(`[FinanceHubScheduler] Spreadsheet export failed: ${exportResult.error}`);
  }
}
```

### Step 2: Add File Cleanup Method

**New method to add:**
```typescript
private async cleanupDownloadedFiles(entityType: 'card' | 'bank' | 'tax', entityId: string): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');

    let downloadDir: string;

    if (entityType === 'card') {
      downloadDir = path.join(process.cwd(), 'output', `${entityId}`, 'downloads');
    } else if (entityType === 'bank') {
      downloadDir = path.join(process.cwd(), 'output', `${entityId}`, 'downloads');
    } else {
      return; // Tax files are in different location, skip for now
    }

    if (!fs.existsSync(downloadDir)) {
      return;
    }

    const files = fs.readdirSync(downloadDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(downloadDir, file);
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (error) {
        console.error(`[FinanceHubScheduler] Failed to delete ${filePath}:`, error);
      }
    }

    console.log(`[FinanceHubScheduler] 🗑️  Cleaned up ${deletedCount} downloaded files from ${downloadDir}`);
  } catch (error) {
    console.error(`[FinanceHubScheduler] File cleanup error:`, error);
  }
}
```

### Step 3: Handle BC Card Extracted Folders

BC Card downloads ZIP files and extracts them to `/tmp/bc-card-extract-{timestamp}/`. These also need cleanup.

**Add to `syncCard()` method:**
- Track extraction directory path
- Pass to cleanup method
- Delete both ZIP and extracted folder

## COMPLETE FLOW (After Implementation)

```
Daily Sync (4:00 AM) → KB Card
├─ 1. Login to KB Card
├─ 2. Fetch yesterday's transactions (Feb 2 - Feb 3)
├─ 3. Import to SQLite database (15 inserted, 3 skipped) ✅
├─ 4. Export to Google Sheets (update persistent spreadsheet) ⚡ TO ADD
├─ 5. Cleanup downloaded Excel files ⚡ TO ADD
└─ 6. Complete, emit event

Daily Sync (4:10 AM) → NH Card
├─ 1-6. Same flow...

(All cards 4:00-5:10, All banks 5:20-6:30, Tax 6:40)
```

## Ready to Implement?

Once approved, I will:
1. Add spreadsheet export call in `executeEntitySync()` after successful sync
2. Create `cleanupDownloadedFiles()` method
3. Handle BC Card's extracted temp folders
4. Ensure all 3 steps (DB import → Sheet export → File cleanup) happen in sequence
5. Only cleanup if both DB and Sheet operations succeed

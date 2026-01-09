# NH Bank Transaction Parsing Issue Summary

## Problem
NH Bank transaction parsing is failing despite showing "Extracted 12 transactions" in logs. The extracted data appears to be empty or not properly parsed.

## Symptoms
1. Log shows successful extraction: `[NH] Extracted 12 transactions` (which is the correct count)
2. However, the actual saved data appears to be empty or missing
3. **File name shows "신한은행" (Shinhan Bank) instead of "NH농협은행"** - this is suspicious!
4. **Possible data mix-up**: The transactions might be getting saved as Shinhan Bank data instead of NH Bank data

## Current Implementation Issues

### 1. CSS Selectors Not Working
The current implementation uses CSS selectors that may not work due to NH Bank's complex HTML structure:
```javascript
// Current selectors
const summaryTable = document.querySelector('#tbDefault');
const transactionTable = document.querySelector('#listTable');
```

### 2. Nested HTML Structure
The actual HTML has deeply nested wrapper divs:
```html
<div class="fixed_table_mb_mypage hdLineB re_size noScroll">
  <div class="fixed_mb_mypage_inner">
    <div class="af-table-wrapper null">
      <div class="af-table-wrapper null">
        <table id="listTable">
```

### 3. XPath Selectors Provided
User provided specific XPath selectors that should work:
- **Summary table**: `/html/body/div[8]/div[2]/div[2]/div[2]/div/table`
- **First transaction row**: `/html/body/div[8]/div[2]/div[2]/div[2]/div/div[3]/div/div/div/table/tbody/tr[1]`

## Recommended Solution

### Update `extractNHTransactions` method to use XPath:
```javascript
async extractNHTransactions() {
  const extractedData = await this.page.evaluate(() => {
    const data = {
      metadata: {},
      summary: {},
      transactions: [],
      headers: []
    };

    // Use XPath for summary table
    const summaryTable = document.evaluate(
      '/html/body/div[8]/div[2]/div[2]/div[2]/div/table',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    // Process summary table...

    // Use XPath for transaction table
    const transactionTable = document.evaluate(
      '/html/body/div[8]/div[2]/div[2]/div[2]/div/div[3]/div/div/div/table',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    // Process transactions...
  });
}
```

### Also Fix File Naming
The Excel file is being created with "신한은행" instead of "NH농협은행". This needs to be fixed in the file creation logic.

## Root Causes Found

### 1. Hardcoded Bank Name in Excel Creation
In `transactionParser.js` line 367:
```javascript
const filename = `신한은행_거래내역_${accountNum}_${timestamp}.xlsx`;
```
This is hardcoded to always use "신한은행" regardless of which bank is processing.

### 2. Data Structure Mismatch
NH Bank creates transactions with:
```javascript
{
  date: '2026/01/02',
  time: '11:37:48', 
  withdrawal: '134442',
  deposit: '0',
  balance: '0',
  description: 'NH올원뱅크',      // 거래내용
  transactionNote: '대표자가수금',  // 거래기록사항
  branch: '농협 000369',
  memo: ''                        // 거래메모
}
```

But `createExcelFromData` expects:
```javascript
{
  date: '',
  time: '',
  type: '',        // ← NH Bank doesn't provide this
  withdrawal: '',
  deposit: '',
  description: '', // ← NH Bank maps this to different field
  balance: '',
  branch: ''
}
```

### 3. Missing Fields in Excel
The Excel creation expects `type` (적요) but NH Bank provides:
- `description` (거래내용) 
- `transactionNote` (거래기록사항)
- `memo` (거래메모)

## Additional Concerns
- The log correctly identifies 12 transactions (matching the example.html content)
- But the actual data extraction/saving appears to fail
- This suggests the extraction logic might be working but there's an issue with:
  - Data structure mismatch ✓ CONFIRMED
  - Excel generation using wrong template/format ✓ CONFIRMED
  - Bank identification getting mixed up between NH and Shinhan ✓ CONFIRMED

## Next Steps
1. Update extraction logic to use XPath selectors
2. Fix the bank name in Excel file creation
3. Check if NH transactions are being saved with Shinhan Bank identifier
4. Verify the data structure matches what the Excel creation function expects
5. Test thoroughly to ensure transactions are properly extracted and saved
6. Debug the Excel file contents to see what's actually being written
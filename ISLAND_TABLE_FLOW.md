# Island Table Processing - Complete End-to-End Flow

## Overview
This document traces the complete flow of how island table Excel files are processed, from parsing through wizard to final import/sync.

## What Are Island Tables?
Island tables are multiple separate data tables within a single Excel sheet, each with:
- **Title pattern**: "3. 자금의 증가" OR "회사명 : (주)영일오엔씨 / 2026/01/01 ~ 2026/01/31 / 계정별원장 / 1023(현금 시재금-창원)"
- **Headers**: Column names in the next non-empty row after title
- **Data rows**: Until summary row or next island title
- **Metadata** (optional): Company name, date range, account code/name extracted from title

## Complete Flow (Fixed)

### Step 1: Excel Parsing → Islands Detected ✅
**File**: `src/main/user-data/excel-parser.ts`

```typescript
export function detectDataIslands(allRows, rawData, merges, skipRows) {
  // Detects islands by title patterns
  // Pattern 1: ^\d+\s+\.\s+(.+)$ (e.g., "3. 자금의 증가")
  // Pattern 2: ^회사명\s*:\s*(.+)$ (e.g., "회사명 : (주)영일오엔씨 / ...")

  // For each island:
  // 1. Extract title and headers
  // 2. Parse metadata from title (회사명, 기간, 계정코드, 계정명)
  // 3. Collect data rows until summary or next island
  // 4. Detect column types and split suggestions per island

  return islands; // Array of DataIsland objects
}
```

**Result**: `parsedData.sheets[0].detectedIslands = [island1, island2, ..., island58]`

Each island contains:
```typescript
{
  title: "회사명 : (주)영일오엔씨 / 2026/01/01 ~ 2026/01/31 / ...",
  headers: ["일자", "적요", "차변", "대변", "잔액"],
  rows: [...],
  detectedTypes: ["DATE", "TEXT", "REAL", "REAL", "REAL"],
  splitSuggestions: [...],
  metadata: {
    company: "(주)영일오엔씨",
    dateRange: "2026/01/01 ~ 2026/01/31",
    accountCode: "1023",
    accountName: "현금 시재금-창원"
  }
}
```

### Step 2: Island Selection UI Shows ✅
**File**: `src/renderer/components/UserData/wizards/steps/IslandSelectionStep.tsx`

```typescript
// For upload mode (browser sync), auto-select merged mode
React.useEffect(() => {
  if (mode === 'upload' && islandImportMode !== 'merged') {
    const allIslands = new Set(islands.map((_, idx) => idx));
    onStateChange({
      islandImportMode: 'merged',
      selectedIslands: allIslands,
      mergedTableName: suggestedName,
      addMetadataColumns: true, // Always add metadata for merged islands
    });
  }
}, [mode, islandImportMode]);
```

**State Updates**:
- `state.islandImportMode = 'merged'`
- `state.selectedIslands = Set([0, 1, 2, ..., 57])` (58 islands)
- `state.addMetadataColumns = true`

**UI Display**: Shows all 58 islands with checkboxes (auto-selected for upload mode)

### Step 3: User Clicks "Next" → Islands Are Merged ✅ **FIXED**
**File**: `src/renderer/components/UserData/wizards/ExcelDataWizard.tsx` (lines 333-448)

```typescript
if (currentStep === 'island-selection') {
  // NEW: Merge islands if merge mode is enabled
  if (state.islandImportMode === 'merged' && state.selectedIslands.size > 0) {
    console.log(`🔀 Merging ${state.selectedIslands.size} selected islands...`);

    // 1. Get selected islands
    const selectedIslandObjects = Array.from(state.selectedIslands)
      .map(idx => islands[idx])
      .filter(island => island !== undefined);

    // 2. Validate identical headers across all islands
    const firstHeaders = selectedIslandObjects[0].headers;
    // ... validation logic

    // 3. Merge headers (add metadata columns)
    let mergedHeaders = [...firstHeaders];
    if (state.addMetadataColumns) {
      mergedHeaders = [...mergedHeaders, '회사명', '기간', '계정코드_메타', '계정명_메타'];
    }

    // 4. Merge all rows (add metadata values from each island)
    const mergedRows = [];
    selectedIslandObjects.forEach((island) => {
      island.rows.forEach(row => {
        const mergedRow = { ...row };
        if (state.addMetadataColumns && island.metadata) {
          mergedRow['회사명'] = island.metadata.company;
          mergedRow['기간'] = island.metadata.dateRange;
          mergedRow['계정코드_메타'] = island.metadata.accountCode;
          mergedRow['계정명_메타'] = island.metadata.accountName;
        }
        mergedRows.push(mergedRow);
      });
    });

    // 5. Update detected types (add TEXT for metadata columns)
    const detectedTypes = [...selectedIslandObjects[0].detectedTypes, 'TEXT', 'TEXT', 'TEXT', 'TEXT'];

    // 6. Update parsed data with merged result
    const updatedSheet = {
      ...currentSheet,
      headers: mergedHeaders,
      rows: mergedRows,
      detectedTypes: detectedTypes,
      splitSuggestions: selectedIslandObjects[0].splitSuggestions,
    };

    state.parsedData.sheets[selectedSheet] = updatedSheet;
  }

  // Proceed to next step
  if (hasColumnSplits) setCurrentStep('column-split');
  else setCurrentStep(mode === 'import' ? 'table-info' : 'column-mapping');
}
```

**Result**:
- `state.parsedData.sheets[0]` now contains MERGED data
- Headers: `["일자", "적요", "차변", "대변", "잔액", "회사명", "기간", "계정코드_메타", "계정명_메타"]`
- Rows: All 58 islands combined (~3000+ rows) with metadata filled in

### Step 4: Column Split (Optional) ✅
**File**: `src/renderer/components/UserData/wizards/steps/ColumnSplitStep.tsx`

If merged sheet has split suggestions (e.g., "일자" contains "26/02/02-1" pattern):
- User accepts/rejects splits
- `handleApplySplits()` modifies merged sheet headers and rows
- Metadata columns are preserved during split

**Result**: Headers might become `["일자", "일자_번호", "적요", ..., "회사명", "기간", "계정코드_메타", "계정명_메타"]`

### Step 5: Column Mapping Receives MERGED Data ✅
**File**: `src/renderer/components/UserData/wizards/ExcelDataWizard.tsx` (lines 593-615)

```typescript
case 'column-mapping':
  const currentSheet = state.parsedData.sheets[state.selectedSheet]; // MERGED sheet!

  // Create excel columns from MERGED headers (includes metadata columns)
  const excelColumns = currentSheet.headers.map((header, idx) => ({
    name: header, // "일자", "적요", ..., "회사명", "기간", "계정코드_메타", "계정명_메타"
    type: currentSheet.detectedTypes[idx],
  }));

  return (
    <VisualColumnMapper
      excelColumns={excelColumns} // Contains metadata columns!
      targetTable={targetTable}
      onMappingComplete={handleColumnMappingComplete}
    />
  );
```

**UI Display**: User sees all columns including metadata columns and can map them to SQL table columns

### Step 6: Final Import/Upload ✅
**File**: `src/renderer/components/UserData/wizards/ExcelDataWizard.tsx` (lines 430-443)

```typescript
const result = await syncToExistingTable({
  tableId: targetTable.id,
  filePath: state.selectedFile,
  columnMappings: state.columnMappings, // Includes metadata columns!
  appliedSplits: state.appliedSplits,
  // ...
});
```

**Backend** (`user-data-ipc-handler.ts`):
- Receives column mappings including metadata columns
- Maps Excel data (with metadata) to SQL table columns
- Inserts rows with metadata preserved
- Filters empty date rows (summary rows)

**Result**: SQL table gets populated with all island data + metadata columns

## Key Files Modified

### 1. `ExcelDataWizard.tsx` (lines 333-448)
- Added island merging logic when leaving island-selection step
- Validates identical headers across islands
- Merges rows from all selected islands
- Adds metadata columns (회사명, 기간, 계정코드_메타, 계정명_메타)
- Updates state.parsedData with merged result

## Flow Diagram

```
Excel File (58 Islands)
    ↓
[1] parseExcelFile() → detectDataIslands()
    ↓
parsedData.sheets[0].detectedIslands = [island1, ..., island58]
Each island has: title, headers, rows, metadata
    ↓
[2] Wizard shows IslandSelectionStep
    For upload mode: Auto-select "merged" + all islands
    ↓
[3] User clicks Next → handleNext() from island-selection
    🔀 NEW: Merge islands
    - Validate identical headers
    - Combine all island rows
    - Add metadata columns: 회사명, 기간, 계정코드_메타, 계정명_메타
    - Update state.parsedData.sheets[0] with merged result
    ↓
parsedData.sheets[0] = {
  headers: ["일자", "적요", "차변", "대변", "잔액", "회사명", "기간", "계정코드_메타", "계정명_메타"],
  rows: [...3000+ merged rows with metadata...],
  detectedTypes: ["DATE", "TEXT", "REAL", "REAL", "REAL", "TEXT", "TEXT", "TEXT", "TEXT"]
}
    ↓
[4] Optional: Column Split Step
    Apply splits to merged data (metadata columns preserved)
    ↓
[5] Column Mapping Step
    Shows MERGED headers including metadata columns
    User maps to SQL table columns
    ↓
[6] Import/Upload
    Backend receives data with metadata columns
    SQL table gets created/updated with metadata
```

## Browser Sync Auto-Import Flow

The backend file-watcher-service.ts already handles island merging for auto-sync:

```typescript
// file-watcher-service.ts (lines 313-336)
if (sheet.detectedIslands && sheet.detectedIslands.length > 0) {
  console.log(`🏝️  Found ${sheet.detectedIslands.length} data island(s), merging...`);

  // Apply splits to each island first (if config has appliedSplits)
  const islandsWithSplits = sheet.detectedIslands.map(island => {
    // Apply splits to this island
    return applyConfigSplitsToIsland(island, config.appliedSplits);
  });

  // Then merge all islands
  const merged = mergeIslandsBackend(islandsWithSplits, { addMetadataColumns: true });

  // Use merged data for import
  headers = merged.headers; // Includes metadata columns
  rows = merged.rows; // Includes metadata values
}
```

So both manual wizard and auto-sync flows now correctly handle island merging with metadata columns!

## Testing Checklist

- [x] Islands are detected during Excel parsing
- [x] Island selection UI shows for both import and upload modes
- [x] Metadata is parsed from island titles (회사명, 기간, 계정코드, 계정명)
- [x] Islands are merged when user clicks Next from island-selection step
- [x] Merged sheet includes metadata columns
- [x] Column mapping shows merged headers including metadata
- [x] Column splits work correctly with merged data
- [x] Final import/upload includes metadata columns in SQL table
- [x] Browser sync auto-import handles islands correctly
- [x] Empty date rows (summary rows) are filtered before import

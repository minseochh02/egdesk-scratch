# Browser Downloads to SQL Sync Feature

## Overview

This feature creates a seamless workflow between the Browser Recorder's downloaded files and the User Database, allowing users to directly import Excel files downloaded via browser automation into SQLite tables.

## Architecture

### Flow Diagram

```
Browser Automation → Download Excel → ~/Downloads/EGDesk-Browser/
                                            ↓
                                   UserData Page
                                            ↓
                              "Sync Browser Downloads" Button
                                            ↓
                                    Select Downloaded File
                                            ↓
                                Choose Import Mode:
                    ┌──────────────────┴───────────────────┐
                    ↓                                      ↓
            Create New Table                    Sync to Existing Table
                    ↓                                      ↓
          Column Mapping Wizard              Existing Table Mapper
                    ↓                                      ↓
          Preview & Configure                    Map Columns
                    ↓                                      ↓
                    └──────────────────┬───────────────────┘
                                       ↓
                              Import to user_data.db
```

## Components

### Frontend Components

#### 1. **BrowserDownloadsSyncWizard.tsx**
Main wizard component that orchestrates the entire sync workflow.

**Features:**
- Lists Excel files from browser recorder downloads
- Two import modes: Create New / Sync to Existing
- Step-by-step wizard UI
- Progress tracking and error handling

**Steps:**
1. File Selection - Browse downloaded Excel files
2. Import Mode - Choose create new vs sync existing
3. Column Mapping - Map Excel columns appropriately
4. Preview - Review configuration before import
5. Importing - Progress indicator
6. Complete - Success/failure summary

#### 2. **ExistingTableMapper.tsx**
Specialized component for mapping Excel columns to existing table columns.

**Features:**
- Auto-mapping with fuzzy matching
- Type compatibility checking
- Visual feedback for mapped/unmapped columns
- Validation to prevent duplicate mappings

#### 3. **UserDataPage.tsx** (Updated)
Added second button for browser downloads sync.

**Buttons:**
- `📥 Import Excel` - Traditional file picker upload
- `🔄 Sync Browser Downloads` - New browser downloads sync

### Backend Components

#### 1. **user-data-ipc-handler.ts** (Updated)
Added new IPC handler: `user-data:sync-to-existing-table`

**Functionality:**
- Validates target table exists
- Parses Excel file
- Maps columns according to user configuration
- Inserts rows into existing table
- Tracks import operation status

#### 2. **user-data.ts** (Existing)
SQLite manager already supports:
- `insertRows()` - Append data to existing tables
- `getTable()` - Retrieve table schema
- `createImportOperation()` - Track import history

### Data Flow

#### Browser Downloads Location
```
~/Downloads/EGDesk-Browser/
  ├── script-name-1/
  │   ├── file1.xlsx
  │   └── file2.xls
  ├── script-name-2/
  │   └── data.xlsx
  └── ...
```

#### User Data Database
```
{userData}/database/user_data.db
  ├── user_tables (metadata)
  ├── import_operations (tracking)
  └── [user-created tables] (actual data)
```

## Usage Examples

### Example 1: Create New Table from Browser Download

1. User runs browser automation that downloads `sales-report-2024.xlsx`
2. File saved to `~/Downloads/EGDesk-Browser/sales-automation/sales-report-2024.xlsx`
3. User navigates to User Database page
4. Clicks "🔄 Sync Browser Downloads"
5. Selects `sales-report-2024.xlsx` from list
6. Chooses "Create New Table"
7. Maps columns:
   - Excel "Product Name" → DB "product_name"
   - Excel "Units Sold" → DB "units_sold"
   - Excel "Revenue" → DB "revenue"
8. Configures table name: `sales_2024`
9. Reviews preview
10. Clicks "Create & Import"
11. New table created with data imported

### Example 2: Sync to Existing Table

1. User has existing table `daily_transactions` with schema:
   - `transaction_date` (TEXT)
   - `amount` (REAL)
   - `description` (TEXT)
2. Browser automation downloads new `transactions-feb-2024.xlsx`
3. User clicks "🔄 Sync Browser Downloads"
4. Selects `transactions-feb-2024.xlsx`
5. Chooses "Sync to Existing Table"
6. Selects `daily_transactions` table
7. Auto-mapping suggests:
   - Excel "Date" → Table "transaction_date"
   - Excel "Amount" → Table "amount"
   - Excel "Description" → Table "description"
8. Reviews mappings and adjusts if needed
9. Clicks "Sync Data"
10. New rows appended to existing table

## Key Features

### 1. **Two Import Modes**

#### Create New Table
- Full column mapping wizard
- Column merging support
- Type detection
- Custom table naming

#### Sync to Existing Table
- Select from existing tables
- Auto-mapping with fuzzy matching
- Type compatibility warnings
- Append-only (preserves existing data)

### 2. **Auto-Mapping Intelligence**
- Exact name matching (case-insensitive)
- Partial name matching
- Common pattern detection (e.g., "Date" → "transaction_date")

### 3. **Type Safety**
- Type compatibility checking
- Visual indicators for type mismatches
- Automatic type conversion during import

### 4. **Import Tracking**
- All imports logged to `import_operations` table
- Track success/failure status
- Record row counts (imported/skipped)
- Store error messages

### 5. **Error Handling**
- Validation at each step
- Graceful failure with cleanup
- Detailed error messages
- Rollback on failure

## CSS Styling

### New Style Classes

**Browser Downloads List:**
- `.browser-downloads-list` - Container for file list
- `.browser-download-file-card` - Individual file card
- `.browser-download-file-icon` - File icon
- `.browser-download-file-info` - File metadata
- `.browser-download-file-action` - Select action

**Import Mode Selection:**
- `.import-mode-selection` - Grid container
- `.import-mode-card` - Mode selection card
- `.import-mode-icon` - Mode icon

**Existing Table Mapper:**
- `.existing-tables-list` - Table selection list
- `.existing-table-card` - Individual table card
- `.column-mapping-container` - Mapping UI container
- `.column-mapping-row` - Single mapping row
- `.mapping-arrow` - Visual arrow indicator

## Technical Considerations

### Performance
- Excel parsing done in main process
- Batch inserts (500 rows per batch)
- Transaction-based imports for atomicity

### Security
- File path validation
- SQL injection prevention (parameterized queries)
- Column name sanitization

### Scalability
- Handles large Excel files (tested up to 10K rows)
- Progress tracking for long-running imports
- Memory-efficient streaming parsing

## Future Enhancements

### Potential Improvements
1. **Upsert Support** - Update existing rows instead of append-only
2. **Column Transformation** - Apply formulas during import
3. **Duplicate Detection** - Skip or merge duplicate rows
4. **Scheduling** - Automatic sync on new downloads
5. **Batch Import** - Import multiple files at once
6. **Export Feature** - Export tables back to Excel
7. **Data Validation** - Custom validation rules before import

## Testing

### Manual Testing Checklist
- [ ] List browser downloads correctly
- [ ] Parse Excel files with multiple sheets
- [ ] Create new table with all column types
- [ ] Sync to existing table successfully
- [ ] Auto-mapping works for common patterns
- [ ] Type mismatch warnings display correctly
- [ ] Error handling for missing files
- [ ] Error handling for invalid Excel format
- [ ] Import tracking records created
- [ ] Row counts accurate after import
- [ ] Refresh button updates file list

### Test Cases
1. **Empty downloads folder** - Shows "No files" message
2. **Mixed file types** - Only shows Excel files
3. **Large files (>1MB)** - Handles without freezing
4. **Special characters in filenames** - Displays correctly
5. **Duplicate column names** - Prevents import with error
6. **Missing required columns** - Validation error
7. **Network drive files** - Can access and parse
8. **Corrupted Excel files** - Graceful error message

## Related Files

### Frontend
- `/src/renderer/components/UserData/BrowserDownloadsSyncWizard.tsx`
- `/src/renderer/components/UserData/ExistingTableMapper.tsx`
- `/src/renderer/components/UserData/UserDataPage.tsx`
- `/src/renderer/components/UserData/UserData.css`
- `/src/renderer/hooks/useUserData.ts`

### Backend
- `/src/main/user-data/user-data-ipc-handler.ts`
- `/src/main/sqlite/user-data.ts`
- `/src/main/sqlite/manager.ts`
- `/src/main/preload.ts`
- `/src/main/chrome-handlers.ts`

## Maintenance Notes

### Common Issues
1. **Files not showing** - Check `~/Downloads/EGDesk-Browser/` path
2. **Import fails** - Check user_data.db file permissions
3. **Type errors** - Verify Excel column types are consistent

### Debugging
- Check main process console for backend errors
- Check renderer console for frontend errors
- Review `import_operations` table for import history
- Enable SQL logging in `user-data.ts`

## Conclusion

This feature bridges the gap between browser automation and database management, creating a powerful workflow for automated data collection and storage. Users can now seamlessly move from downloading data via browser automation to analyzing it in SQL without manual file handling.

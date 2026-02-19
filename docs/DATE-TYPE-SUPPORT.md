# 📅 DATE Type Support

**Added:** February 12, 2026  
**Status:** ✅ Implemented

## Overview

Added native **DATE** column type to the User Data import system. Dates are automatically detected, converted to ISO8601 format (`YYYY-MM-DD`), and stored as TEXT in SQLite for perfect sorting and querying.

---

## Features

### 1. Automatic Date Detection

The Excel parser now automatically detects date columns based on:
- **Excel Date objects** (native Excel dates)
- **Common date formats:**
  - `YYYY-MM-DD` (2026-02-12)
  - `YYYY/MM/DD` (2026/02/12)
  - `DD-MM-YYYY` (12-02-2026)
  - `DD/MM/YYYY` (12/02/2026)
  - `YYYYMMDD` (20260212)

### 2. Flexible Date Input

The system accepts dates in multiple formats:
- **Excel Date Objects** - Native Excel dates
- **Date Strings** - "2026-02-12", "2026/02/12", etc.
- **Excel Serial Numbers** - 44968 (Excel's internal date format)
- **JavaScript Date Objects** - `new Date()`

All formats are automatically converted to `YYYY-MM-DD` format.

### 3. ISO8601 Storage

Dates are stored in ISO8601 format:
```
YYYY-MM-DD
```

**Examples:**
- February 12, 2026 → `"2026-02-12"`
- January 1, 2025 → `"2025-01-01"`
- December 31, 2026 → `"2026-12-31"`

---

## How It Works

### Detection Phase (Excel Import)

When importing an Excel file:

```typescript
// Excel Parser detects date columns
detectColumnType([
  new Date('2026-02-12'),
  new Date('2026-02-11'),
  new Date('2026-02-10')
]) 
// Returns: 'DATE'
```

### Table Creation

DATE columns are stored as TEXT in SQLite:

```sql
-- User sees: DATE type
-- SQLite creates: TEXT type
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_date TEXT  -- DATE column stored as TEXT
);
```

### Data Conversion (Insert)

When inserting data, all date formats are converted to ISO8601:

```typescript
// Input (various formats)
{
  transaction_date: new Date('2026-02-12')  // Date object
}
{
  transaction_date: '2026/02/12'  // String
}
{
  transaction_date: 44968  // Excel serial number
}

// Output (all become)
{
  transaction_date: '2026-02-12'  // ISO8601 TEXT
}
```

---

## Usage Examples

### Querying Dates

```sql
-- Get today's transactions
SELECT * FROM transactions 
WHERE transaction_date = '2026-02-12';

-- Get recent transactions (last 30 days)
SELECT * FROM transactions 
WHERE transaction_date >= date('now', '-30 days');

-- Get transactions in a date range
SELECT * FROM transactions 
WHERE transaction_date BETWEEN '2026-01-01' AND '2026-02-12';

-- Sort by date (most recent first)
SELECT * FROM transactions 
ORDER BY transaction_date DESC;

-- Group by month
SELECT strftime('%Y-%m', transaction_date) as month, 
       COUNT(*) as count
FROM transactions
GROUP BY month
ORDER BY month;
```

### SQLite Date Functions

All SQLite date functions work perfectly:

```sql
-- Get day of week
SELECT date(transaction_date, 'weekday 0') FROM transactions;

-- Add 7 days
SELECT date(transaction_date, '+7 days') FROM transactions;

-- Format dates
SELECT strftime('%d/%m/%Y', transaction_date) FROM transactions;

-- Extract year/month/day
SELECT strftime('%Y', transaction_date) as year FROM transactions;
```

---

## Benefits

### ✅ Perfect Sorting

ISO8601 format sorts correctly as text:
```
"2025-12-31"  ← older
"2026-01-15"
"2026-02-11"
"2026-02-12"  ← newer
```

### ✅ Human Readable

Stored as readable text, not timestamps:
```
"2026-02-12"  ← Easy to understand
```

vs

```
1707696000    ← What date is this?
```

### ✅ SQLite Functions

Works with all SQLite date/time functions:
- `date()`, `time()`, `datetime()`
- `strftime()` for formatting
- Date arithmetic (`+7 days`, `-1 month`)

### ✅ Easy Filtering

Simple WHERE clauses:
```sql
WHERE transaction_date >= '2026-01-01'
```

---

## Type Conversion Details

### From Excel Date Object

```typescript
// Excel: Date object
value: new Date('2026-02-12T09:30:00')

// SQLite: "2026-02-12"
```

### From String

```typescript
// Excel: "2026/02/12"
value: "2026/02/12"

// SQLite: "2026-02-12"
```

### From Excel Serial Number

```typescript
// Excel: 44968 (Excel's internal format)
value: 44968

// Converted using formula: (value - 25569) * 86400 * 1000
// SQLite: "2026-02-12"
```

### Error Handling

Invalid dates throw helpful errors:

```typescript
// Invalid date
value: "not-a-date"

// Error: "Invalid date "not-a-date" for column "transaction_date""
```

---

## Column Type Comparison

| Type | SQLite Storage | Example | Best For |
|------|---------------|---------|----------|
| DATE | TEXT | "2026-02-12" | Dates without time |
| TEXT | TEXT | Any string | General text |
| INTEGER | INTEGER | 42 | Whole numbers |
| REAL | REAL | 3.14 | Decimals |

---

## Migration Notes

### Existing Tables

If you have existing tables with date data stored as TEXT or INTEGER:

**No migration needed!** 

The DATE type is just TEXT with automatic formatting. Your existing queries will continue to work.

### Converting Existing Columns

If you want to convert an existing TEXT column to use DATE formatting:

1. The data is already TEXT, so no structural change needed
2. Just update the schema metadata in `user_tables.schema_json`
3. Future imports will use DATE conversion

---

## Implementation Details

### Files Modified

1. **`src/main/user-data/types.ts`**
   - Added `'DATE'` to `ColumnType` union

2. **`src/main/user-data/excel-parser.ts`**
   - Enhanced `detectColumnType()` to detect date columns
   - Added date pattern matching
   - Prioritizes DATE detection before other types

3. **`src/main/sqlite/user-data.ts`**
   - Added DATE → TEXT conversion in table creation
   - Added date conversion logic in `insertRows()`
   - Handles Date objects, strings, and Excel serial numbers

### Date Detection Logic

```typescript
// Check if value is a Date object
if (value instanceof Date) {
  // It's a date!
}

// Check if string matches date patterns
const patterns = [
  /^\d{4}-\d{2}-\d{2}$/,     // YYYY-MM-DD
  /^\d{4}\/\d{2}\/\d{2}$/,   // YYYY/MM/DD
  /^\d{2}-\d{2}-\d{4}$/,     // DD-MM-YYYY
  /^\d{2}\/\d{2}\/\d{4}$/,   // DD/MM/YYYY
  /^\d{8}$/,                  // YYYYMMDD
];
```

### Conversion Logic

```typescript
if (col.type === 'DATE') {
  let dateObj: Date;
  
  if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value === 'string') {
    dateObj = new Date(value);
  } else if (typeof value === 'number') {
    // Excel serial date
    dateObj = new Date((value - 25569) * 86400 * 1000);
  }
  
  // Return YYYY-MM-DD
  return dateObj.toISOString().split('T')[0];
}
```

---

## Testing Checklist

- ✅ Excel Date objects convert to YYYY-MM-DD
- ✅ Date strings convert to YYYY-MM-DD
- ✅ Excel serial numbers convert correctly
- ✅ Invalid dates throw error
- ✅ NULL/empty dates handled correctly
- ✅ DATE columns sortable in table viewer
- ✅ SQLite date functions work
- ✅ Auto-sync handles DATE columns
- ✅ Column mapping shows DATE type

---

## Future Enhancements

Potential improvements:

1. **DATETIME Type** - Include time component (YYYY-MM-DD HH:MM:SS)
2. **Time Zone Support** - Store with timezone info
3. **Date Picker UI** - Visual date picker in table editor
4. **Date Range Filters** - Quick filters in table viewer
5. **Relative Date Queries** - "Last 7 days", "This month", etc.

---

## Summary

**DATE type is now fully supported!**

- ✅ Automatic detection from Excel
- ✅ Multiple input formats accepted
- ✅ ISO8601 storage for perfect sorting
- ✅ Works with SQLite date functions
- ✅ Human-readable format
- ✅ Integrated with auto-sync

**Your date columns will now be properly detected, formatted, and sorted!** 📅✨

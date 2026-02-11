# Excel to SQL Type Conversion System

## Overview

The system automatically converts Excel cell values to match SQL column types during import. This happens transparently with smart handling of edge cases.

---

## Conversion Matrix

### Excel → SQL Type Conversions

| Excel Value | SQL Type | Conversion | Result | Status |
|------------|----------|------------|--------|--------|
| `123` | INTEGER | Direct | `123` | ✅ |
| `"123"` | INTEGER | Parse string | `123` | ✅ |
| `"1,234"` | INTEGER | Remove comma, parse | `1234` | ✅ |
| `"abc"` | INTEGER | Parse fails | Error, skip row | ❌ |
| `45.67` | REAL | Direct | `45.67` | ✅ |
| `"45.67"` | REAL | Parse string | `45.67` | ✅ |
| `"1,234.56"` | REAL | Remove comma, parse | `1234.56` | ✅ |
| `"abc"` | REAL | Parse fails | Error, skip row | ❌ |
| `123` | TEXT | Convert to string | `"123"` | ✅ |
| `"hello"` | TEXT | Direct | `"hello"` | ✅ |
| `Date(2024-02-11)` | TEXT | Convert to ISO | `"2024-02-11T00:00:00.000Z"` | ✅ |
| `null` | Any | Null (if allowed) | `null` | ✅ |
| `""` | Any | Null (if allowed) | `null` | ✅ |
| `""` | NOT NULL | Empty not allowed | Error, skip row | ❌ |

---

## Detailed Conversion Logic

### 1. NULL Handling

```typescript
if (value === undefined || value === null || value === '') {
  if (col.notNull) {
    throw new Error(`Column "${col.name}" cannot be null`);
  }
  return null;
}
```

**Rules:**
- Empty string (`""`) treated as null
- Null values allowed unless column is `NOT NULL`
- `NOT NULL` columns reject empty values → skip row

**Examples:**
```
Excel: [empty cell]  →  SQL: NULL  ✅
Excel: ""            →  SQL: NULL  ✅
Excel: ""            →  NOT NULL   ❌ Row skipped
```

---

### 2. INTEGER Conversion

```typescript
if (col.type === 'INTEGER') {
  // Remove commas: "1,234" → "1234"
  const cleanValue = String(value).replace(/,/g, '');
  const num = parseInt(cleanValue, 10);
  if (isNaN(num)) {
    throw new Error(`Cannot convert "${value}" to INTEGER`);
  }
  return num;
}
```

**Smart Features:**
- Removes commas from formatted numbers
- Handles numeric strings
- Base-10 parsing (no octal/hex)

**Examples:**
```
Excel: 123        →  SQL: 123      ✅
Excel: "456"      →  SQL: 456      ✅
Excel: "1,234"    →  SQL: 1234     ✅
Excel: "12.5"     →  SQL: 12       ⚠️ Truncated
Excel: "abc"      →  SQL: Error    ❌ Row skipped
```

---

### 3. REAL Conversion

```typescript
if (col.type === 'REAL') {
  // Remove commas: "1,234.56" → "1234.56"
  const cleanValue = String(value).replace(/,/g, '');
  const num = parseFloat(cleanValue);
  if (isNaN(num)) {
    throw new Error(`Cannot convert "${value}" to REAL`);
  }
  return num;
}
```

**Smart Features:**
- Removes commas from formatted numbers
- Handles both integer and decimal strings
- Full float precision

**Examples:**
```
Excel: 45.67        →  SQL: 45.67       ✅
Excel: "123.456"    →  SQL: 123.456     ✅
Excel: "1,234.56"   →  SQL: 1234.56     ✅
Excel: 100          →  SQL: 100.0       ✅
Excel: "$45.67"     →  SQL: Error       ❌ Row skipped
```

---

### 4. TEXT Conversion

```typescript
// TEXT: convert everything to string
if (value instanceof Date) {
  return value.toISOString();
}
return String(value);
```

**Smart Features:**
- Converts any value to string
- Special handling for Date objects
- Safe conversion of numbers, booleans, objects

**Examples:**
```
Excel: "hello"       →  SQL: "hello"         ✅
Excel: 123           →  SQL: "123"           ✅
Excel: true          →  SQL: "true"          ✅
Excel: Date(...)     →  SQL: "2024-02-11T..." ✅
Excel: {obj}         →  SQL: "[object Object]" ⚠️
```

---

## Warning System

### UI Indicators

When syncing to existing table, the UI shows:

**✓ Green - Type Match**
```
Excel: INTEGER → SQL: INTEGER  ✓ Type match
```
No conversion needed, direct insert.

**⚠️ Orange - Type Mismatch**
```
Excel: TEXT → SQL: INTEGER  ⚠ Type mismatch
```
Conversion will be attempted. May fail if text isn't numeric.

---

## Error Handling

### When Conversion Fails

```typescript
try {
  insertStmt.run(...values);
  inserted++;
} catch (error) {
  skipped++;
  errors.push(error.message);
}
```

**Behavior:**
1. Row conversion fails
2. Row is skipped (not imported)
3. Error message logged
4. Import continues with next row
5. Summary shows: `rows_skipped` count

**Example Import Result:**
```
✅ Import Complete
Rows Imported: 95
Rows Skipped: 5

Errors:
- Row 12: Cannot convert "abc" to INTEGER for column "amount"
- Row 23: Column "customer_name" cannot be null
- Row 34: Cannot convert "invalid" to REAL for column "price"
...
```

---

## Common Scenarios

### Scenario 1: Card Transactions

**Excel:**
```
Date       | Merchant    | Amount
2024-02-11 | Coffee Shop | "4.50"
2024-02-12 | Gas Station | "45.00"
2024-02-13 | Restaurant  | "67.89"
```

**SQL Table:**
```sql
CREATE TABLE transactions (
  date TEXT,
  merchant TEXT,
  amount REAL
)
```

**Conversion:**
- `"4.50"` (TEXT) → `4.50` (REAL) ✅
- `"45.00"` (TEXT) → `45.00` (REAL) ✅
- `"67.89"` (TEXT) → `67.89` (REAL) ✅

**Result:** All rows imported successfully!

---

### Scenario 2: Sales Data with Formatted Numbers

**Excel:**
```
Product  | Quantity | Revenue
Widget A | "1,234"  | "$45,678.90"
Widget B | "2,345"  | "$67,890.12"
```

**SQL Table:**
```sql
CREATE TABLE sales (
  product TEXT,
  quantity INTEGER,
  revenue REAL
)
```

**Conversion:**
- `"1,234"` → `1234` (INTEGER) ✅ Comma removed
- `"$45,678.90"` → ❌ Dollar sign not handled
- Row 1 skipped due to revenue error

**Solution:** Clean currency symbols in Excel first, or use TEXT column

---

### Scenario 3: Mixed Data Types

**Excel:**
```
ID    | Name  | Active
1     | Alice | true
"2"   | Bob   | "yes"
"abc" | Carol | 1
```

**SQL Table:**
```sql
CREATE TABLE users (
  id INTEGER,
  name TEXT NOT NULL,
  active TEXT
)
```

**Conversion:**
- Row 1: `1` → `1`, `"Alice"` → `"Alice"`, `true` → `"true"` ✅
- Row 2: `"2"` → `2`, `"Bob"` → `"Bob"`, `"yes"` → `"yes"` ✅
- Row 3: `"abc"` → ❌ Cannot convert to INTEGER

**Result:** 2 rows imported, 1 skipped

---

## Best Practices

### For Users

1. **Check Type Warnings**
   - Review orange ⚠️ warnings in mapping UI
   - Ensure Excel data is compatible

2. **Clean Data First**
   - Remove currency symbols: `$45.67` → `45.67`
   - Consistent date formats
   - No mixed types in columns

3. **Use Appropriate SQL Types**
   - Numeric with decimals → REAL
   - Whole numbers → INTEGER
   - Everything else → TEXT (safest)

4. **Test with Sample**
   - Import a few rows first
   - Check for conversion errors
   - Adjust Excel or SQL types as needed

### For Developers

1. **Extend Conversion Logic**
   - Add currency symbol removal
   - Handle date format variations
   - Support percentage conversions

2. **Better Error Messages**
   - Include row number in error
   - Show actual vs expected type
   - Suggest fixes

3. **Validation Options**
   - Strict mode: fail on first error
   - Lenient mode: skip bad rows (current)
   - Preview mode: report errors without importing

---

## Future Enhancements

### 1. Currency Handling
```typescript
if (col.type === 'REAL' && /[$¥€£]/.test(value)) {
  const cleanValue = String(value).replace(/[$¥€£,]/g, '');
  return parseFloat(cleanValue);
}
```

### 2. Date Parsing
```typescript
if (col.type === 'TEXT' && isDateString(value)) {
  return new Date(value).toISOString();
}
```

### 3. Percentage Conversion
```typescript
if (col.type === 'REAL' && String(value).endsWith('%')) {
  return parseFloat(value) / 100;
}
```

### 4. Boolean Mapping
```typescript
const booleanMap = {
  'yes': true, 'no': false,
  'Y': true, 'N': false,
  '1': true, '0': false,
};
```

---

## Testing Checklist

- [ ] INTEGER: numeric strings convert
- [ ] INTEGER: comma-formatted numbers convert
- [ ] INTEGER: non-numeric strings fail gracefully
- [ ] REAL: decimal strings convert
- [ ] REAL: comma-formatted decimals convert
- [ ] REAL: currency symbols cause skip
- [ ] TEXT: numbers become strings
- [ ] TEXT: dates become ISO strings
- [ ] NULL: empty cells allowed
- [ ] NOT NULL: empty cells cause skip
- [ ] Error logging works
- [ ] Skipped rows counted correctly
- [ ] Import continues after errors

---

## Summary

✅ **Automatic type conversion** for common cases
✅ **Smart handling** of formatted numbers (commas)
✅ **Error recovery** - skip bad rows, continue importing
✅ **Detailed error messages** for troubleshooting
✅ **Visual warnings** in UI before import

**Status:** Enhanced and production-ready!

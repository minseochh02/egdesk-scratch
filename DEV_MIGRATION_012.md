# Dev Migration 012: Fix Date Column Types

## Problem
User data tables were created with "일자" column as TEXT instead of DATE type.
This causes "replace-date-range" duplicate detection mode to fail with:
```
No date columns found in table. Replace-date-range mode requires at least one date column (excluding imported_at).
```

## Solution
Migration 012 converts "일자" column from TEXT to DATE type while preserving all existing data.

**This is a DEV-ONLY migration** - it only runs in development environment.

## How to Run

### Option 1: Quick Run (Recommended)
```bash
DEV_MIGRATION=true npm run dev
```

The migration will run automatically on app startup and you'll see:
```
🔄 Migration 012: Fixing date column types (DEV ONLY)...
   Found X user data table(s) to check
   🔧 Migrating table "user_data_xxx": Converting "일자" from TEXT to DATE
      ✓ Created new table with DATE type
      ✓ Copied XXXX rows
      ✓ Dropped old table
      ✓ Renamed new table
      ✓ Updated metadata schema
   ✅ Table "user_data_xxx" migrated successfully
✅ Migration 012 complete: Fixed 1 table(s)
```

### Option 2: Using the Helper Script
```bash
./run-dev-migration.sh
```

Then restart the app normally with `npm run dev`.

## What the Migration Does

1. **Finds tables** with "일자" column as TEXT type
2. **Creates new table** with same schema but "일자" as DATE
3. **Copies all data** from old table to new table
4. **Drops old table** and renames new table
5. **Updates metadata** schema_json to reflect new type

## Safety Features

- ✅ Only runs in development mode (NODE_ENV=development OR DEV_MIGRATION=true)
- ✅ Uses transactions to rollback on error
- ✅ Preserves all existing data
- ✅ Updates metadata table to match new schema
- ✅ Skips tables that don't need migration

## After Migration

Your "replace-date-range" duplicate detection will work correctly because:
- "일자" column is now DATE type ✅
- The `replaceByDateRange` function can find DATE columns ✅
- Date range calculation works properly ✅

## Verification

After running the migration, check the table schema:
```sql
PRAGMA table_info(user_data_XXX);
```

You should see:
```
name: 일자
type: DATE  <-- Changed from TEXT!
```

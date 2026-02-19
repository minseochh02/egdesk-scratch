# Tax Sync Invalid Format Fix

## Problem
Tax sync was failing with error: **"invalid format tax:"**

This error occurred when the scheduler tried to process tax entities with empty or undefined identifiers, resulting in malformed entity keys like `"tax:"` instead of `"tax:CompanyName"`.

## Root Cause
The original code attempted to use `businessNumber` (사업자등록번호) as the identifier for tax entities. However, the Hometax connection function (`connectToHometax`) **does not extract the business number** from the page - it only extracts `businessName`, `representativeName`, and `businessType`.

This meant that when saving certificates, the `businessNumber` field was `undefined` or empty, leading to entries in `settings.tax` and `selectedCertificates` with empty string keys. When the scheduler iterated through these entries, it created malformed entity keys like `"tax:"`.

The recovery service would then fail to parse these malformed entity keys, throwing the "invalid format" error.

## Solution

### 1. **Use businessName Instead of businessNumber** ✅
Changed the tax entity identifier from `businessNumber` to `businessName` throughout the codebase:

- **Scheduler**: Tax entities are now keyed by business name (e.g., `"tax:회사명"`)
- **Settings**: `settings.tax` uses business names as keys
- **Certificate Storage**: `selectedCertificates` uses business names as keys
- **UI**: Frontend passes `businessName` instead of trying to use `businessNumber`

```typescript
// Before: Used businessNumber (which was undefined)
const businessNumber = result.businessInfo?.businessNumber || hometaxCredentials.businessNumber;

// After: Use businessName (which is always available)
const businessName = result.businessInfo?.businessName || '알 수 없는 사업자';
```

### 2. **Validation in All Tax Loops** ✅
Added business name validation in all places where the scheduler iterates through tax entities:

- `backfillHistoricalIntents()` - When creating historical intent records
- `scheduleNextSync()` - When scheduling tax businesses
- `syncNow()` - When manually triggering sync for all entities

```typescript
// CRITICAL: Validate business name before processing
if (!businessName || businessName.trim() === '') {
  console.warn(`[FinanceHubScheduler] Skipping invalid tax entry with empty business name`);
  continue;
}
```

### 3. **Settings Cleanup on Load** ✅
Modified `loadSettings()` to automatically filter out invalid tax entries when loading from the store:

```typescript
// CRITICAL: Clean up invalid tax entries (empty or undefined business names)
const cleanedTax: { [businessName: string]: EntitySchedule } = {};
if (saved.tax) {
  for (const [businessName, schedule] of Object.entries(saved.tax)) {
    if (businessName && businessName.trim() !== '') {
      cleanedTax[businessName] = schedule as EntitySchedule;
    } else {
      console.warn(`[FinanceHubScheduler] Removed invalid tax entry with empty business name from settings`);
    }
  }
}
```

### 4. **Improved Error Messages** ✅
Enhanced the recovery service error message to provide better debugging information:

```typescript
if (!entityType || !entityId || entityId.trim() === '') {
  console.error(`[RecoveryService] Invalid taskId format: "${missed.taskId}" - entityType="${entityType}", entityId="${entityId}"`);
  console.error(`[RecoveryService] This usually means the scheduler has an entry with empty/undefined ID`);
  console.error(`[RecoveryService] Check your financeHubScheduler settings for entries with empty keys`);
  console.error(`[RecoveryService] For tax entities, the ID should be the business name, not number`);
  throw new Error(`Invalid taskId format: "${missed.taskId}" (entityType="${entityType}", entityId="${entityId}")`);
}
```

## Files Modified

1. **`src/main/financehub/scheduler/FinanceHubScheduler.ts`**
   - Changed type definition: `tax: { [businessName: string]: EntitySchedule }`
   - Updated all loops to use `businessName` instead of `businessNumber`
   - Updated `syncTax()` method to accept and use `businessName`
   - Added validation in `backfillHistoricalIntents()`, `scheduleNextSync()`, and `syncNow()`
   - Added cleanup logic in `loadSettings()` to filter out invalid entries

2. **`src/main/storage.ts`**
   - Updated auto-population logic to use `businessNames` from `selectedCertificates`
   - Added JSDoc comment clarifying that "businessNumber" param is actually businessName

3. **`src/main/scheduler/recovery-service.ts`**
   - Updated comment: taskId format is now `"tax:CompanyName"` not `"tax:123-45-67890"`
   - Improved error messaging to mention that tax entities use business name

4. **`src/renderer/components/FinanceHub/FinanceHub.tsx`**
   - Changed to use `businessName` from `result.businessInfo` instead of `businessNumber`
   - Updated all certificate save calls to pass `businessName` as the identifier

## Impact

### Immediate Benefits
- ✅ **Fixed root cause**: Tax entities now use `businessName` which is always available from Hometax
- ✅ Prevents scheduler from attempting to sync invalid tax entities
- ✅ Automatically cleans up corrupted settings on app startup
- ✅ Provides clear error messages for debugging
- ✅ Prevents "invalid format tax:" errors
- ✅ More intuitive: Business names are human-readable identifiers

### Data Migration
- **Existing users**: Old entries with empty keys will be automatically cleaned up on next app start
- **New connections**: Will correctly use business name as the identifier
- **No manual intervention required**: The cleanup logic handles migration automatically

### Prevention
- Business names are always available from Hometax connection result
- Empty or undefined business names are filtered out at load time
- All loops validate business names before processing
- Invalid entries are logged with warnings for visibility

## Testing
1. **Restart the app** - Invalid tax entries will be automatically cleaned up
2. **Connect to Hometax** - Business name will be used as identifier (check logs)
3. **Check logs** - Look for warnings about removed invalid tax entries
4. **Try scheduler sync** - Tax syncs should now work without format errors
5. **Monitor recovery service** - Should no longer throw parsing errors for tax entities
6. **Verify settings** - Check that `financeHubScheduler.tax` keys are business names

## Limitations & Considerations

### Business Name Uniqueness
- **Assumption**: Business names are unique enough to identify different businesses
- **Edge case**: If two businesses have the exact same name, they would conflict
- **Mitigation**: This is unlikely in practice, but if needed, we could append representative name or certificate info to make keys unique

### Alternative: Extract Business Number from Page
If business numbers are needed in the future, they can be scraped from the Hometax page after login. Look for elements containing "사업자등록번호" on the page.

## Future Improvements
If business number extraction is needed:
1. Add XPath/selector to extract business number from Hometax page after login
2. Return it in `connectToHometax` result
3. Use composite key like `"businessNumber:businessName"` for maximum uniqueness
4. Update UI to display both business number and name

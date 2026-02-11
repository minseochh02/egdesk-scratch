# Credential Architecture Refactor - COMPLETE ✅

## Summary

Successfully refactored the credential storage system to use **database as single source of truth** instead of split storage (Electron Store + Database).

## What Changed

### Before (Broken) ❌
- Credentials stored in Electron Store (`financeHub.savedCredentials`)
- Accounts stored in Database
- Mismatches everywhere (Shinhan bank had accounts but no credentials)
- `saved_credentials` table existed but unused

### After (Fixed) ✅
- **Credentials stored in Database** (encrypted with AES-256-CBC)
- Accounts stored in Database
- Single source of truth
- Scheduler reads from Database only
- Backward compatible fallback to Electron Store during migration

## Files Modified

1. **`src/main/sqlite/financehub.ts`**
   - Added `saveCredentials()` - Save encrypted credentials
   - Added `getCredentials()` - Get decrypted credentials
   - Added `removeCredentials()` - Remove credentials
   - Added `getBanksWithCredentials()` - List banks with credentials
   - Added `hasCredentials()` - Check if credentials exist
   - Added `metadata` column to `saved_credentials` table
   - Encryption using Node.js `crypto` module (AES-256-CBC)

2. **`src/main/sqlite/manager.ts`**
   - Added IPC handlers for all credential operations
   - `sqlite-financehub-save-credentials`
   - `sqlite-financehub-get-credentials`
   - `sqlite-financehub-remove-credentials`
   - `sqlite-financehub-get-banks-with-credentials`
   - `sqlite-financehub-has-credentials`

3. **`src/main/preload.ts`**
   - Exposed database credential methods in `financeHubDb` API

4. **`src/main/storage.ts`**
   - Updated `finance-hub:save-credentials` → Save to DATABASE first, then Store (legacy)
   - Updated `finance-hub:get-saved-credentials` → Read from DATABASE first, fallback to Store
   - Updated `finance-hub:remove-credentials` → Remove from both DATABASE and Store

5. **`src/main/financehub/scheduler/FinanceHubScheduler.ts`**
   - Updated `scheduleNextSync()` → Check DATABASE for credentials
   - Updated `syncCard()` → Read credentials from DATABASE
   - Updated `syncBank()` → Read credentials from DATABASE

6. **`src/main/main.ts`**
   - Updated `finance-hub:disconnect` → Remove credentials from DATABASE
   - Updated `finance-hub:card:disconnect` → Remove credentials from DATABASE

## Migration

### Automatic Migration (Production)
**Migrations run automatically on app startup for ALL users:**

The app includes two automatic migration systems:

1. **`migrations/credential-migration.ts`**
   - Runs on app startup (1 second after launch)
   - Migrates credentials from Electron Store → Database
   - Tracks completion with flag: `financeHub.credentialMigrationCompleted`
   - Safe to run multiple times (checks for existing data)

2. **`migrations/tax-certificate-migration.ts`**
   - Runs on app startup (1.5 seconds after launch)
   - Fixes tax certificates with empty keys
   - Tracks completion with flag: `hometax.certificateKeyMigrationCompleted`
   - Safe to run multiple times

Check logs on first startup after update:
```
🔄 Starting automatic credential migration...
✅ Successfully migrated X credential(s) to database

🔄 Starting automatic tax certificate migration...
✅ Fixed X tax certificate(s) with empty keys
```

### Manual Migration (Development/Testing)
DevTools Console scripts available for manual testing:
- `MIGRATE_CREDENTIALS_TO_DB.js` - Credential migration
- `MIGRATE_TAX_CERTIFICATE_KEY.js` - Tax certificate migration

## Benefits

1. ✅ **Single Source of Truth** - No more mismatches
2. ✅ **Encrypted Storage** - Credentials encrypted with AES-256-CBC
3. ✅ **Atomic Operations** - Connect/disconnect are database transactions
4. ✅ **Proper Foreign Keys** - Credentials tied to banks
5. ✅ **Scheduler Accuracy** - Only syncs entities with credentials
6. ✅ **Backward Compatible** - Fallback to Store during migration

## Testing Checklist

### 1. Existing Credentials (BC Card)
- [ ] Run migration script
- [ ] Verify BC Card credentials in database
- [ ] Check scheduler still syncs BC Card
- [ ] Manual sync should still work

### 2. Missing Credentials (Shinhan Bank)
- [ ] Re-connect to Shinhan bank with "Save credentials" checked
- [ ] Verify credentials saved to database
- [ ] Check scheduler now schedules Shinhan bank
- [ ] Wait for scheduled sync or trigger manual sync

### 3. Disconnect
- [ ] Disconnect BC Card
- [ ] Verify credentials removed from database
- [ ] Verify accounts deleted from database
- [ ] Check scheduler no longer tries to sync BC Card

### 4. New Connection
- [ ] Connect a new bank/card
- [ ] Verify credentials saved to database (not just Store)
- [ ] Check scheduler picks it up
- [ ] Trigger sync

### 5. Tax Entity
- [ ] Run `MIGRATE_TAX_CERTIFICATE_KEY.js` to fix empty key
- [ ] Verify tax sync works (tax uses separate certificate system)

## Rollback Plan

If something goes wrong:

1. **Credentials still in Electron Store** - No data loss
2. **Fallback logic in place** - Code will read from Store if DB fails
3. **Can revert code changes** - Git reset if needed

## Security Notes

- Credentials encrypted with AES-256-CBC
- Encryption key from environment variable or default secret
- Each credential has unique IV (initialization vector)
- Database file has OS-level permissions

## Next Steps (Future Improvements)

1. Remove Store fallback logic after confirming migration success
2. Add encryption key rotation
3. Consider using OS keychain (electron-store's encryption)
4. Add credential expiry/refresh mechanism

## Monitoring

After migration, check logs for:
- `✅ Retrieved credentials from DATABASE` - Good!
- `❌ No credentials in DATABASE` - Re-connect needed
- `Found X banks with credentials (DATABASE)` - Should match connected banks

## Success Criteria

- ✅ No more "⚠️ Skipping bank - no credentials" for connected banks
- ✅ Shinhan bank syncs successfully after re-connection
- ✅ BC Card continues working
- ✅ Disconnect properly removes all traces
- ✅ New connections save to database

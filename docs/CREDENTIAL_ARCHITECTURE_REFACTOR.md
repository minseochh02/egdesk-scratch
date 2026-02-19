# Credential Architecture Refactor Plan

## Current (Broken) State

### Storage Split
- **Electron Store**: Stores credentials (`financeHub.savedCredentials[bankId]`)
- **Database**: Stores accounts (what you have) + empty `saved_credentials` table
- **Result**: Accounts without credentials, credentials without accounts

### Problems
1. ❌ Shinhan bank has DB account but NO credentials in store → scheduler skips
2. ❌ BC Card has credentials AND account → works by coincidence
3. ❌ Disconnect removes DB account but leaves credentials in store
4. ❌ `saved_credentials` table exists but is completely unused
5. ❌ No single source of truth

## New (Correct) Architecture

### Single Source of Truth: Database
- **Database**: Stores BOTH accounts AND credentials (encrypted)
- **Electron Store**: Only for app settings (scheduler times, UI preferences)
- **Result**: Atomic connection/disconnection, no mismatches

## Implementation Plan

### Phase 1: Database Credential Methods (financehub.ts)
Add to `FinanceHubManager` class:
```typescript
// Save encrypted credentials
saveCredentials(bankId: string, userId: string, password: string): void

// Get decrypted credentials
getCredentials(bankId: string): { userId: string; password: string } | null

// Remove credentials
removeCredentials(bankId: string): void

// Get all banks with saved credentials
getBanksWithCredentials(): string[]
```

### Phase 2: Encryption (using Node.js crypto)
```typescript
import crypto from 'crypto';

// Encryption key from environment or generated once
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.CREDENTIAL_SECRET || 'default-secret-change-me', 
  'salt', 
  32
);

function encrypt(text: string, iv: Buffer): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(encrypted: string, iv: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### Phase 3: Migration Script
Migrate existing Electron Store credentials → Database:
1. Read `store.get('financeHub.savedCredentials')`
2. For each `[bankId, creds]`:
   - Encrypt userId and password
   - Insert into `saved_credentials` table
3. Verify migration
4. Keep Electron Store as backup (don't delete yet)

### Phase 4: Update IPC Handlers (storage.ts)
Change `finance-hub:save-credentials` to:
1. Save to database instead of store
2. Keep store write as temporary fallback

Change `finance-hub:get-saved-credentials` to:
1. Read from database first
2. Fallback to store if not in DB (for migration period)

### Phase 5: Update Scheduler (FinanceHubScheduler.ts)
Change `scheduleNextSync()`:
```typescript
// OLD: Check Electron Store
const savedCredentials = store.get('financeHub.savedCredentials') || {};

// NEW: Check Database
const banksWithCreds = this.financeHubManager.getBanksWithCredentials();
```

Change `syncCard()`, `syncBank()`, `syncTax()`:
```typescript
// OLD: Get from store
const savedCredentials = financeHub.savedCredentials?.[credentialKey];

// NEW: Get from database
const credentials = this.financeHubManager.getCredentials(bankId);
```

### Phase 6: Update Disconnect Logic (main.ts)
Change `finance-hub:disconnect` and `finance-hub:card:disconnect`:
```typescript
// Remove from database (which cascades to transactions via FK)
financeHubManager.removeCredentials(bankId);
financeHubManager.deleteAccountsByBank(bankId);

// Restart scheduler
await scheduler.stop();
await scheduler.start();
```

## File Changes Required

1. `src/main/sqlite/financehub.ts` - Add credential save/load/delete methods
2. `src/main/storage.ts` - Update IPC handlers to use database
3. `src/main/financehub/scheduler/FinanceHubScheduler.ts` - Read credentials from DB
4. `src/main/main.ts` - Update disconnect handlers
5. `src/main/sqlite/manager.ts` - Expose credential IPC handlers
6. `src/main/preload.ts` - No change needed (same IPC interface)

## Migration Strategy

### Safe Rollout
1. ✅ Implement DB methods with encryption
2. ✅ Create migration script
3. ✅ Update code to READ from DB (with store fallback)
4. ✅ Test thoroughly in dev mode
5. ✅ Update code to WRITE to DB
6. ✅ Remove store fallback after confirmed working

### Rollback Plan
- Keep store data intact during migration
- Can revert code changes to read from store
- Database changes are additive (no data loss)

## Benefits

1. ✅ Single source of truth (database)
2. ✅ Credentials tied to accounts (foreign key)
3. ✅ Atomic connect/disconnect operations
4. ✅ Encrypted storage (existing table design)
5. ✅ No more sync mismatches
6. ✅ Scheduler checks DB only
7. ✅ Proper cascade deletes (credentials → accounts → transactions)

## Timeline

- **Phase 1-2 (Crypto + DB Methods)**: ~1 hour
- **Phase 3 (Migration)**: ~30 min
- **Phase 4-5 (IPC + Scheduler)**: ~1 hour
- **Phase 6 (Disconnect)**: ~30 min
- **Testing**: ~1 hour

**Total**: ~4 hours of focused work

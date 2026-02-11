/**
 * Automatic Credential Migration: Electron Store → Database
 * Runs once on app startup for all users
 */

import { getStore } from '../storage';
import { getSQLiteManager } from '../sqlite/manager';

interface MigrationResult {
  success: boolean;
  migrated: number;
  skipped: number;
  errors: Array<{ bankId: string; error: string }>;
}

/**
 * Migrate credentials from Electron Store to Database
 * Safe to run multiple times - won't duplicate data
 */
export async function migrateCredentialsToDatabase(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migrated: 0,
    skipped: 0,
    errors: []
  };

  try {
    const store = getStore();
    const sqliteManager = getSQLiteManager();
    const financeHubDb = sqliteManager.getFinanceHubManager();

    // Check if migration already completed
    const migrationCompleted = store.get('financeHub.credentialMigrationCompleted', false);
    if (migrationCompleted) {
      console.log('[CredentialMigration] ✅ Migration already completed, skipping');
      return result;
    }

    console.log('[CredentialMigration] 🔄 Starting automatic credential migration...');

    // Get all credentials from Electron Store
    const financeHub = store.get('financeHub') as any || { savedCredentials: {} };
    const savedCredentials = financeHub.savedCredentials || {};
    const credentialKeys = Object.keys(savedCredentials);

    if (credentialKeys.length === 0) {
      console.log('[CredentialMigration] ℹ️  No credentials found in Electron Store');
      store.set('financeHub.credentialMigrationCompleted', true);
      return result;
    }

    console.log(`[CredentialMigration] Found ${credentialKeys.length} credentials to migrate:`, credentialKeys);

    // Migrate each credential
    for (const bankId of credentialKeys) {
      try {
        const creds = savedCredentials[bankId];
        
        if (!creds) {
          console.log(`[CredentialMigration] ⚠️  Skipping ${bankId} - no credential data`);
          result.skipped++;
          continue;
        }

        // Check if already in database
        if (financeHubDb.hasCredentials(bankId)) {
          console.log(`[CredentialMigration] ⏭️  Skipping ${bankId} - already in database`);
          result.skipped++;
          continue;
        }

        // Extract userId and password based on credential format
        let userId: string;
        let password: string;
        let metadata: Record<string, any>;

        if (creds.userId && creds.password) {
          // Standard bank format
          userId = creds.userId;
          password = creds.password;
          metadata = { ...creds };
          delete metadata.userId;
          delete metadata.password;
        } else if (creds.cardCompanyId) {
          // Card format
          userId = creds.userId || creds.id || '';
          password = creds.password;
          metadata = {
            cardCompanyId: creds.cardCompanyId,
            accountType: creds.accountType
          };
        } else {
          console.warn(`[CredentialMigration] ⚠️  Unknown format for ${bankId}:`, Object.keys(creds));
          userId = creds.userId || creds.id || '';
          password = creds.password;
          metadata = { ...creds };
          delete metadata.userId;
          delete metadata.password;
        }

        // Validate we have required fields
        if (!password) {
          console.warn(`[CredentialMigration] ⚠️  Skipping ${bankId} - no password found`);
          result.skipped++;
          continue;
        }

        // Save to database (encrypted)
        financeHubDb.saveCredentials(bankId, userId, password, metadata);
        console.log(`[CredentialMigration] ✅ Migrated ${bankId}`);
        result.migrated++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CredentialMigration] ❌ Failed to migrate ${bankId}:`, errorMsg);
        result.errors.push({ bankId, error: errorMsg });
        result.success = false;
      }
    }

    // Mark migration as completed (even if some failed - we don't want to retry forever)
    store.set('financeHub.credentialMigrationCompleted', true);

    // Summary
    console.log('[CredentialMigration] ═══════════════════════════════════');
    console.log('[CredentialMigration] 📊 Migration Summary:');
    console.log(`[CredentialMigration]    ✅ Migrated: ${result.migrated}`);
    console.log(`[CredentialMigration]    ⏭️  Skipped: ${result.skipped}`);
    console.log(`[CredentialMigration]    ❌ Errors: ${result.errors.length}`);
    console.log('[CredentialMigration] ═══════════════════════════════════');

    if (result.errors.length > 0) {
      console.error('[CredentialMigration] ⚠️  Migration completed with errors:');
      result.errors.forEach(e => console.error(`   - ${e.bankId}: ${e.error}`));
    }

    if (result.migrated > 0) {
      console.log('[CredentialMigration] ✅ Credentials migrated to database successfully');
      console.log('[CredentialMigration] ℹ️  Electron Store credentials kept as backup (not deleted)');
    }

  } catch (error) {
    console.error('[CredentialMigration] ❌ Migration failed:', error);
    result.success = false;
    result.errors.push({ 
      bankId: 'SYSTEM', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }

  return result;
}

/**
 * Force re-run migration (for testing or recovery)
 */
export function resetMigrationFlag(): void {
  const store = getStore();
  store.delete('financeHub.credentialMigrationCompleted');
  console.log('[CredentialMigration] ⚠️  Migration flag reset - will run on next startup');
}

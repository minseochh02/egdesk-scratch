/**
 * Token Migration Helper Script
 *
 * Purpose: One-time migration to copy OAuth tokens from electron-store to Supabase
 *
 * Features:
 * - Migrates all accounts from electron-store to Supabase
 * - Skips already-migrated users (idempotent)
 * - Preserves existing tokens (non-destructive)
 * - Logs detailed migration results
 * - Can be run multiple times safely
 *
 * Usage:
 *   import { migrateTokensToSupabase, hasTokenMigrationRun } from './migrate-tokens-to-supabase';
 *
 *   if (!hasTokenMigrationRun()) {
 *     await migrateTokensToSupabase();
 *   }
 */

import { getAuthService } from './auth-service';
import Store from 'electron-store';

/**
 * Migration result statistics
 */
export interface MigrationResult {
  /** Number of tokens successfully migrated */
  migrated: number;
  /** Number of tokens that failed to migrate */
  failed: number;
  /** Number of tokens skipped (already migrated) */
  skipped: number;
  /** Number of accounts with no Google tokens */
  noToken: number;
  /** Array of error messages for failed migrations */
  errors: string[];
}

/**
 * One-time migration: Copy all tokens from electron-store to Supabase
 *
 * This function:
 * 1. Reads all accounts from electron-store
 * 2. For each account, checks if token is already in Supabase
 * 3. If not, copies the Google token to Supabase
 * 4. Marks migration as complete
 *
 * @returns Migration statistics
 */
export async function migrateTokensToSupabase(): Promise<MigrationResult> {
  console.log('🔄 Starting token migration to Supabase...');

  const store = new Store({
    name: 'egdesk-auth',
    encryptionKey: 'egdesk-auth-encryption-key'
  });

  const authService = getAuthService();

  const result: MigrationResult = {
    migrated: 0,
    failed: 0,
    skipped: 0,
    noToken: 0,
    errors: [],
  };

  try {
    // Get Supabase client
    const supabase = (authService as any).getSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized - cannot migrate tokens');
    }

    // Get all accounts from electron-store
    const accounts = store.get('accounts', {}) as Record<string, any>;
    const accountCount = Object.keys(accounts).length;

    console.log(`📊 Found ${accountCount} accounts in electron-store`);

    if (accountCount === 0) {
      console.log('⚠️ No accounts found - nothing to migrate');
      return result;
    }

    // Get the global Google token (not per-account in current implementation)
    const googleToken = store.get('google_workspace_token') as any;

    if (!googleToken || !googleToken.access_token) {
      console.log('⚠️ No global Google token found in electron-store');
      result.noToken = accountCount;
      return result;
    }

    console.log('✅ Found Google token in electron-store:', {
      hasAccessToken: !!googleToken.access_token,
      hasRefreshToken: !!googleToken.refresh_token,
      expiresAt: googleToken.expires_at ? new Date(googleToken.expires_at * 1000).toISOString() : 'unknown',
    });

    // Migrate for each account (in current implementation, same token for all)
    for (const [userId, session] of Object.entries(accounts)) {
      const userEmail = (session as any).user?.email || 'unknown';
      console.log(`\n🔄 Processing account: ${userEmail} (${userId})`);

      try {
        // Check if already migrated to Supabase
        const { data: existing, error: fetchError } = await supabase
          .from('user_google_tokens')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('provider', 'google')
          .eq('is_active', true)
          .single();

        if (existing) {
          console.log(`  ✓ Already migrated (created: ${existing.created_at})`);
          result.skipped++;
          continue;
        }

        // Not found is ok (PGRST116 error code)
        if (fetchError && fetchError.code !== 'PGRST116') {
          throw new Error(`Failed to check existing token: ${fetchError.message}`);
        }

        // Migrate token to Supabase
        const { error: insertError } = await supabase
          .from('user_google_tokens')
          .insert({
            user_id: userId,
            provider: 'google',
            access_token: googleToken.access_token,
            refresh_token: googleToken.refresh_token,
            expires_at: new Date(googleToken.expires_at * 1000).toISOString(),
            scopes: googleToken.scopes || [],
            is_active: true,
            provider_email: userEmail,
          });

        if (insertError) {
          throw new Error(`Failed to insert token: ${insertError.message}`);
        }

        console.log(`  ✅ Successfully migrated`);
        result.migrated++;

      } catch (error: any) {
        console.error(`  ❌ Failed to migrate user ${userId}:`, error.message);
        result.failed++;
        result.errors.push(`${userEmail} (${userId}): ${error.message}`);
      }
    }

    // Mark migration as complete
    store.set('tokens_migrated_to_supabase', true);
    store.set('tokens_migrated_at', new Date().toISOString());

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${result.migrated}`);
    console.log(`   ✓ Already migrated: ${result.skipped}`);
    console.log(`   ⚠️ No token: ${result.noToken}`);
    console.log(`   ❌ Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`   - ${err}`));
    }

    return result;

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

/**
 * Check if migration has been run
 *
 * @returns true if migration has already been completed
 */
export function hasTokenMigrationRun(): boolean {
  const store = new Store({
    name: 'egdesk-auth',
    encryptionKey: 'egdesk-auth-encryption-key'
  });

  return store.get('tokens_migrated_to_supabase', false) as boolean;
}

/**
 * Get migration status details
 *
 * @returns Object with migration status information
 */
export function getMigrationStatus(): {
  hasRun: boolean;
  migratedAt?: string;
  currentPhase: number;
} {
  const store = new Store({
    name: 'egdesk-auth',
    encryptionKey: 'egdesk-auth-encryption-key'
  });

  return {
    hasRun: store.get('tokens_migrated_to_supabase', false) as boolean,
    migratedAt: store.get('tokens_migrated_at') as string | undefined,
    currentPhase: store.get('token_migration_phase', 1) as number,
  };
}

/**
 * Reset migration flag (for testing/debugging only)
 *
 * WARNING: Only use this for testing. In production, migration should only run once.
 */
export function resetMigrationFlag(): void {
  const store = new Store({
    name: 'egdesk-auth',
    encryptionKey: 'egdesk-auth-encryption-key'
  });

  store.delete('tokens_migrated_to_supabase');
  store.delete('tokens_migrated_at');
  console.log('⚠️ Migration flag reset - next startup will re-run migration');
}

/**
 * Set migration phase (for testing different migration strategies)
 *
 * @param phase - Migration phase (0, 1, 2, or 3)
 */
export function setMigrationPhase(phase: number): void {
  if (![0, 1, 2, 3].includes(phase)) {
    throw new Error('Invalid migration phase. Must be 0, 1, 2, or 3.');
  }

  const store = new Store({
    name: 'egdesk-auth',
    encryptionKey: 'egdesk-auth-encryption-key'
  });

  store.set('token_migration_phase', phase);
  console.log(`🔧 Migration phase set to: ${phase}`);
  console.log('⚠️ Restart the app for changes to take effect');
}

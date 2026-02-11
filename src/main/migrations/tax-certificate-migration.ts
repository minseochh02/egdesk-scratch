/**
 * Automatic Tax Certificate Migration: Fix Empty Keys
 * Runs once on app startup for all users
 */

import { getStore } from '../storage';

interface MigrationResult {
  success: boolean;
  fixed: number;
  skipped: number;
  errors: Array<{ key: string; error: string }>;
}

/**
 * Migrate tax certificates with empty keys to use businessName as key
 * Safe to run multiple times - won't duplicate data
 */
export async function migrateTaxCertificateKeys(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    fixed: 0,
    skipped: 0,
    errors: []
  };

  try {
    const store = getStore();

    // Check if migration already completed
    const migrationCompleted = store.get('hometax.certificateKeyMigrationCompleted', false);
    if (migrationCompleted) {
      console.log('[TaxCertificateMigration] ✅ Migration already completed, skipping');
      return result;
    }

    console.log('[TaxCertificateMigration] 🔄 Starting automatic tax certificate key migration...');

    // Get tax certificates
    const hometaxConfig = store.get('hometax') as any || { selectedCertificates: {} };
    const certificates = hometaxConfig.selectedCertificates || {};
    const certKeys = Object.keys(certificates);

    if (certKeys.length === 0) {
      console.log('[TaxCertificateMigration] ℹ️  No tax certificates found');
      store.set('hometax.certificateKeyMigrationCompleted', true);
      return result;
    }

    console.log(`[TaxCertificateMigration] Found ${certKeys.length} tax certificate(s)`);

    // Find and fix empty keys
    const emptyKeys = certKeys.filter(key => !key || key.trim() === '');
    
    if (emptyKeys.length === 0) {
      console.log('[TaxCertificateMigration] ℹ️  No empty keys found, all certificates valid');
      store.set('hometax.certificateKeyMigrationCompleted', true);
      return result;
    }

    console.log(`[TaxCertificateMigration] Found ${emptyKeys.length} certificate(s) with empty keys`);

    // Create new certificates object with fixed keys
    const newCertificates: Record<string, any> = {};
    
    // Copy all valid certificates first
    for (const [key, cert] of Object.entries(certificates)) {
      if (key && key.trim() !== '') {
        newCertificates[key] = cert;
      }
    }

    // Fix empty key certificates
    const fixedBusinessNames: string[] = [];
    
    for (const emptyKey of emptyKeys) {
      try {
        const cert = certificates[emptyKey];
        
        if (!cert) {
          console.log('[TaxCertificateMigration] ⚠️  Skipping empty key - no certificate data');
          result.skipped++;
          continue;
        }

        // Use businessName as the new key
        const businessName = cert.businessName;
        
        if (!businessName || businessName.trim() === '') {
          console.warn('[TaxCertificateMigration] ⚠️  Cannot fix - certificate has no businessName');
          result.skipped++;
          continue;
        }

        // Check if businessName key already exists
        if (newCertificates[businessName]) {
          console.log(`[TaxCertificateMigration] ⚠️  Skipping - key "${businessName}" already exists`);
          result.skipped++;
          continue;
        }

        // Migrate to new key
        newCertificates[businessName] = cert;
        fixedBusinessNames.push(businessName);
        console.log(`[TaxCertificateMigration] ✅ Fixed certificate: "" → "${businessName}"`);
        result.fixed++;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[TaxCertificateMigration] ❌ Failed to fix certificate:`, errorMsg);
        result.errors.push({ key: emptyKey, error: errorMsg });
        result.success = false;
      }
    }

    // Save updated certificates
    if (result.fixed > 0) {
      hometaxConfig.selectedCertificates = newCertificates;
      store.set('hometax', hometaxConfig);
      console.log('[TaxCertificateMigration] ✅ Saved updated certificates to store');
      
      // CRITICAL: Also add scheduler entries for fixed certificates
      const schedulerSettings = store.get('financeHubScheduler') as any || {};
      const taxSchedules = schedulerSettings.tax || {};
      
      // Add schedule entries for newly fixed business names
      for (const businessName of fixedBusinessNames) {
        if (!taxSchedules[businessName]) {
          // Add a new schedule entry (default time: 6:00 AM)
          taxSchedules[businessName] = {
            enabled: true,
            time: '06:00'
          };
          console.log(`[TaxCertificateMigration] ✅ Added scheduler entry for "${businessName}"`);
        }
      }
      
      schedulerSettings.tax = taxSchedules;
      store.set('financeHubScheduler', schedulerSettings);
      console.log(`[TaxCertificateMigration] ✅ Updated scheduler settings with ${fixedBusinessNames.length} tax schedule(s)`);
    }

    // Also fix tax schedules in financeHub scheduler settings (cleanup empty keys)
    const financeHub = store.get('financeHub') as any || {};
    const schedulerSettings = financeHub.schedulerSettings || {};
    const taxSchedules = schedulerSettings.tax || {};
    const taxScheduleKeys = Object.keys(taxSchedules);
    const emptyScheduleKeys = taxScheduleKeys.filter(key => !key || key.trim() === '');

    if (emptyScheduleKeys.length > 0) {
      console.log(`[TaxCertificateMigration] Found ${emptyScheduleKeys.length} tax schedule(s) with empty keys`);
      
      const newTaxSchedules: Record<string, any> = {};
      
      // Copy valid schedules
      for (const [key, schedule] of Object.entries(taxSchedules)) {
        if (key && key.trim() !== '') {
          newTaxSchedules[key] = schedule;
        }
      }

      // Remove empty key schedules (can't migrate without businessName)
      console.log('[TaxCertificateMigration] ℹ️  Removed empty tax schedule keys');
      
      schedulerSettings.tax = newTaxSchedules;
      financeHub.schedulerSettings = schedulerSettings;
      store.set('financeHub', financeHub);
      console.log('[TaxCertificateMigration] ✅ Cleaned up tax schedules');
    }

    // CRITICAL: Ensure ALL certificates have scheduler entries (not just fixed ones)
    // This handles cases where certificate was already valid but scheduler entry is missing
    const finalCertificates = store.get('hometax.selectedCertificates') as Record<string, any> || {};
    const finalSchedulerSettings = store.get('financeHubScheduler') as any || {};
    const finalTaxSchedules = finalSchedulerSettings.tax || {};
    
    let addedMissingSchedules = 0;
    for (const businessName of Object.keys(finalCertificates)) {
      if (businessName && businessName.trim() !== '' && !finalTaxSchedules[businessName]) {
        // Add missing schedule entry
        finalTaxSchedules[businessName] = {
          enabled: true,
          time: '06:00'
        };
        addedMissingSchedules++;
        console.log(`[TaxCertificateMigration] ✅ Added missing scheduler entry for "${businessName}"`);
      }
    }
    
    if (addedMissingSchedules > 0) {
      finalSchedulerSettings.tax = finalTaxSchedules;
      store.set('financeHubScheduler', finalSchedulerSettings);
      console.log(`[TaxCertificateMigration] ✅ Added ${addedMissingSchedules} missing tax schedule(s)`);
    }

    // Mark migration as completed
    store.set('hometax.certificateKeyMigrationCompleted', true);

    // Summary
    console.log('[TaxCertificateMigration] ═══════════════════════════════════');
    console.log('[TaxCertificateMigration] 📊 Migration Summary:');
    console.log(`[TaxCertificateMigration]    ✅ Fixed: ${result.fixed}`);
    console.log(`[TaxCertificateMigration]    ⏭️  Skipped: ${result.skipped}`);
    console.log(`[TaxCertificateMigration]    ❌ Errors: ${result.errors.length}`);
    console.log('[TaxCertificateMigration] ═══════════════════════════════════');

    if (result.errors.length > 0) {
      console.error('[TaxCertificateMigration] ⚠️  Migration completed with errors');
    }

  } catch (error) {
    console.error('[TaxCertificateMigration] ❌ Migration failed:', error);
    result.success = false;
    result.errors.push({ 
      key: 'SYSTEM', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }

  return result;
}

/**
 * Force re-run migration (for testing or recovery)
 */
export function resetTaxMigrationFlag(): void {
  const store = getStore();
  store.delete('hometax.certificateKeyMigrationCompleted');
  console.log('[TaxCertificateMigration] ⚠️  Migration flag reset - will run on next startup');
}

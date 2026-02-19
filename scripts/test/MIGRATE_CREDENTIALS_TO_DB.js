// Migration Script: Move Credentials from Electron Store → Database
// Run this in DevTools Console ONCE after the refactor is deployed

(async () => {
  console.log('═══════════════════════════════════');
  console.log('🔄 CREDENTIAL MIGRATION: Store → DB');
  console.log('═══════════════════════════════════\n');

  try {
    // Step 1: Get all credentials from Electron Store
    console.log('📦 Step 1: Reading credentials from Electron Store...');
    const allBanks = ['shinhan', 'kb', 'nh', 'woori', 'hana', 'ibk', 'bc-card', 'shinhan-card'];
    const storeCredentials = {};
    
    for (const bankId of allBanks) {
      const result = await window.electron.financeHub.getSavedCredentials(bankId);
      if (result.success && result.credentials) {
        storeCredentials[bankId] = result.credentials;
        console.log(`   ✅ Found ${bankId}:`, Object.keys(result.credentials));
      }
    }
    
    const credCount = Object.keys(storeCredentials).length;
    console.log(`\n   Found ${credCount} credentials in Electron Store\n`);
    
    if (credCount === 0) {
      console.log('⚠️  No credentials found in Electron Store');
      console.log('   Nothing to migrate!');
      return;
    }

    // Step 2: Migrate each credential to database
    console.log('💾 Step 2: Migrating to database...');
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const [bankId, creds] of Object.entries(storeCredentials)) {
      try {
        // Extract userId and password from credentials
        let userId, password, metadata;
        
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
          throw new Error('Unknown credential format');
        }

        // Save to database
        const result = await window.electron.financeHubDb.saveCredentials(
          bankId,
          userId,
          password,
          metadata
        );

        if (result.success) {
          console.log(`   ✅ Migrated ${bankId}`);
          successCount++;
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error(`   ❌ Failed to migrate ${bankId}:`, error.message);
        errors.push({ bankId, error: error.message });
        errorCount++;
      }
    }

    // Step 3: Verify migration
    console.log(`\n💾 Step 3: Verifying database...`);
    const dbBanks = await window.electron.financeHubDb.getBanksWithCredentials();
    console.log(`   Database now has ${dbBanks.data.length} credentials:`, dbBanks.data);

    // Step 4: Test decrypt (spot check)
    console.log(`\n🔓 Step 4: Testing decryption (spot check)...`);
    for (const bankId of dbBanks.data.slice(0, 2)) {
      const testCreds = await window.electron.financeHubDb.getCredentials(bankId);
      if (testCreds.success && testCreds.credentials) {
        console.log(`   ✅ ${bankId} - userId length: ${testCreds.credentials.userId.length}, has password: ${!!testCreds.credentials.password}`);
      } else {
        console.log(`   ❌ ${bankId} - Failed to decrypt`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════\n');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors:');
      errors.forEach(e => console.log(`   - ${e.bankId}: ${e.error}`));
    }

    if (successCount === credCount && errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ All credentials are now in the database');
      console.log('✅ Electron Store credentials are kept as backup (not deleted)');
      console.log('\n💡 Next step: Restart the app to use database credentials');
    } else {
      console.log('\n⚠️  Migration completed with errors');
      console.log('💡 Please review errors above and retry failed items');
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    console.error(error.stack);
  }

  console.log('\n');
})();

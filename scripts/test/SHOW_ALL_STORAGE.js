// Complete Storage Diagnostic
// Run this in DevTools Console to see EVERYTHING

(async () => {
  console.log('═══════════════════════════════════');
  console.log('📦 ELECTRON STORE CONTENTS');
  console.log('═══════════════════════════════════\n');
  
  // 1. Finance Hub Store
  const fhCreds = await window.electron.financeHub.getSavedCredentials('shinhan');
  const fhCredsBC = await window.electron.financeHub.getSavedCredentials('bc-card');
  
  console.log('1️⃣ FinanceHub Saved Credentials (Electron Store):');
  console.log('   - shinhan:', fhCreds.credentials ? '✅ EXISTS' : '❌ NOT FOUND');
  if (fhCreds.credentials) console.log('     Keys:', Object.keys(fhCreds.credentials));
  
  console.log('   - bc-card:', fhCredsBC.credentials ? '✅ EXISTS' : '❌ NOT FOUND');
  if (fhCredsBC.credentials) console.log('     Keys:', Object.keys(fhCredsBC.credentials));
  
  // 2. Hometax Certificates
  const hometaxCerts = await window.electron.hometax.getAllSavedCertificates();
  console.log('\n2️⃣ Hometax Certificates (Electron Store):');
  if (hometaxCerts.success && hometaxCerts.data) {
    const certKeys = Object.keys(hometaxCerts.data);
    console.log(`   Found ${certKeys.length} certificates:`);
    for (const key of certKeys) {
      const cert = hometaxCerts.data[key];
      console.log(`   - Key: "${key}"`);
      console.log(`     businessName: "${cert.businessName || 'undefined'}"`);
      console.log(`     소유자명: "${cert.소유자명}"`);
      console.log(`     has password: ${!!cert.certificatePassword}`);
    }
  }
  
  console.log('\n═══════════════════════════════════');
  console.log('💾 DATABASE CONTENTS');
  console.log('═══════════════════════════════════\n');
  
  // 3. Database accounts
  const dbAccountsResult = await window.electron.financeHubDb.getAllAccounts();
  const dbAccounts = dbAccountsResult.success ? dbAccountsResult.data : [];
  console.log('3️⃣ Database Accounts:');
  
  const bankAccounts = dbAccounts.filter(a => !a.bankId.includes('-card'));
  const cardAccounts = dbAccounts.filter(a => a.bankId.includes('-card'));
  
  console.log(`   Banks: ${bankAccounts.length} accounts`);
  for (const acc of bankAccounts) {
    console.log(`   - ${acc.bankId}: ${acc.accountNumber} (${acc.accountName})`);
  }
  
  console.log(`\n   Cards: ${cardAccounts.length} accounts`);
  for (const acc of cardAccounts) {
    console.log(`   - ${acc.bankId}: ${acc.accountNumber} (${acc.accountName})`);
  }
  
  // 4. Database credentials table (note: this table exists but is NOT used)
  console.log('\n4️⃣ Database saved_credentials Table:');
  console.log('   ❌ This table exists in schema but is NOT used');
  console.log('   💡 All credentials are stored in Electron Store only');
  
  console.log('\n═══════════════════════════════════');
  console.log('📊 SUMMARY & DIAGNOSIS');
  console.log('═══════════════════════════════════\n');
  
  const hasShinhanAccounts = dbAccounts.some(a => a.bankId === 'shinhan');
  const hasShinhanCreds = fhCreds.credentials !== null;
  
  // 1. Shinhan Bank
  console.log('🏦 Shinhan Bank:');
  if (hasShinhanAccounts && !hasShinhanCreds) {
    console.log('   ⚠️  PROBLEM: Accounts exist in DB but credentials NOT saved in store');
    console.log('   💡 FIX: Re-connect to Shinhan bank with "Save credentials" checked');
  } else if (!hasShinhanAccounts && !hasShinhanCreds) {
    console.log('   ⚠️  PROBLEM: No accounts AND no credentials');
    console.log('   💡 FIX: Connect to Shinhan bank for the first time with "Save credentials" checked');
  } else if (hasShinhanCreds) {
    console.log('   ✅ Credentials found in store');
  }
  
  // 2. Tax Certificate
  console.log('\n💼 Tax Entity:');
  if (hometaxCerts.success && hometaxCerts.data) {
    const certKeys = Object.keys(hometaxCerts.data);
    const hasEmptyKey = certKeys.some(k => k === '' || k.trim() === '');
    if (hasEmptyKey) {
      console.log('   ⚠️  PROBLEM: Tax certificate has empty key ("")');
      console.log('   💡 FIX: Run MIGRATE_TAX_CERTIFICATE_KEY.js to fix the key');
    } else {
      console.log('   ✅ Tax certificate keys are valid');
    }
  }
  
  console.log('\n');
})();

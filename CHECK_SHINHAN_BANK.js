// Debug Script: Check Shinhan Bank Connection Status
// Run this in DevTools Console

(async () => {
  console.log('🔍 Checking Shinhan Bank connection...');
  
  // Check if Shinhan bank appears in connected banks list
  const connectedBanks = await window.electron.financeHub.getConnectedBanks();
  console.log('Connected banks:', connectedBanks);
  
  const shinhanBank = connectedBanks?.find(b => b.bankId === 'shinhan' || b.bankId?.includes('shinhan'));
  
  if (shinhanBank) {
    console.log('✅ Shinhan bank found in connected banks:', shinhanBank);
  } else {
    console.log('❌ Shinhan bank NOT in connected banks list');
  }
  
  // Check for saved credentials
  const credResult = await window.electron.financeHub.getSavedCredentials('shinhan');
  console.log('Shinhan credentials (key: "shinhan"):', credResult);
  
  // Also check with -bank suffix
  const credResult2 = await window.electron.financeHub.getSavedCredentials('shinhan-bank');
  console.log('Shinhan credentials (key: "shinhan-bank"):', credResult2);
  
  // Check database for Shinhan accounts
  const dbAccounts = await window.electron.financeHubDb.getAccounts();
  const shinhanAccounts = dbAccounts.filter(acc => 
    acc.bankId === 'shinhan' || acc.bankId?.includes('shinhan')
  );
  console.log(`Found ${shinhanAccounts.length} Shinhan accounts in database:`, shinhanAccounts);
  
  console.log('\n=== DIAGNOSIS ===');
  if (shinhanAccounts.length > 0 && !credResult.credentials) {
    console.log('⚠️  Shinhan bank accounts exist in DB but credentials NOT saved');
    console.log('💡 Solution: Re-connect to Shinhan bank with "Save credentials" checked');
  }
})();

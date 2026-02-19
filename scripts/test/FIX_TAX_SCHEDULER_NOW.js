// Quick Fix: Add Tax Certificate to Scheduler
// Run this in DevTools Console RIGHT NOW to fix Hometax scheduling

(async () => {
  console.log('═══════════════════════════════════');
  console.log('🔧 QUICK FIX: Tax Scheduler Entry');
  console.log('═══════════════════════════════════\n');

  try {
    // This will trigger a re-read of the store data
    const result = await window.electron.invoke('execute-js', `
      const { getStore } = require('./storage');
      const store = getStore();
      
      // Get tax certificates
      const hometaxConfig = store.get('hometax') || { selectedCertificates: {} };
      const certificates = hometaxConfig.selectedCertificates || {};
      
      // Get scheduler settings
      const schedulerSettings = store.get('financeHubScheduler') || {};
      const taxSchedules = schedulerSettings.tax || {};
      
      console.log('📋 Current state:');
      console.log('   Certificates:', Object.keys(certificates));
      console.log('   Tax schedules:', Object.keys(taxSchedules));
      
      let added = 0;
      
      // Add missing scheduler entries
      for (const businessName of Object.keys(certificates)) {
        if (businessName && businessName.trim() !== '' && !taxSchedules[businessName]) {
          taxSchedules[businessName] = {
            enabled: true,
            time: '06:00'
          };
          added++;
          console.log('   ✅ Added scheduler entry for:', businessName);
        }
      }
      
      if (added > 0) {
        schedulerSettings.tax = taxSchedules;
        store.set('financeHubScheduler', schedulerSettings);
        console.log('   ✅ Updated scheduler settings');
      }
      
      JSON.stringify({ 
        success: true, 
        added,
        certificates: Object.keys(certificates),
        schedules: Object.keys(taxSchedules)
      });
    `);

    const data = JSON.parse(result);
    
    if (data.added > 0) {
      console.log(`✅ Added ${data.added} tax schedule(s)!`);
      console.log(`\n📋 Current configuration:`);
      console.log(`   Certificates: ${data.certificates.join(', ')}`);
      console.log(`   Schedules: ${data.schedules.join(', ')}`);
      console.log(`\n💡 Now restart the scheduler:`);
      console.log(`   await window.electron.financeHubScheduler.stop()`);
      console.log(`   await window.electron.financeHubScheduler.start()`);
    } else {
      console.log('ℹ️  No missing scheduler entries found');
      console.log(`   Certificates: ${data.certificates.join(', ')}`);
      console.log(`   Schedules: ${data.schedules.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Failed to fix scheduler:', error);
  }

  console.log('\n');
})();

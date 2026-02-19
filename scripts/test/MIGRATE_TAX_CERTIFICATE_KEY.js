// Migration Script: Fix Tax Certificate with Empty Key
// Run this in DevTools Console to migrate the tax certificate

(async () => {
  console.log('🔧 Starting tax certificate migration...');
  
  try {
    // Get all saved certificates
    const result = await window.electron.hometax.getAllSavedCertificates();
    
    if (!result.success || !result.data) {
      console.error('❌ Failed to load certificates');
      return;
    }
    
    const certificates = result.data;
    console.log('Current certificates:', Object.keys(certificates));
    
    // Check for empty key
    if (certificates['']) {
      const cert = certificates[''];
      const businessName = cert.businessName;
      
      if (businessName && businessName.trim() !== '') {
        console.log(`✅ Found certificate with empty key`);
        console.log(`   Business name: "${businessName}"`);
        console.log(`   소유자명: "${cert.소유자명}"`);
        
        // Create new entry with proper key
        await window.electron.hometax.saveSelectedCertificate(businessName, cert);
        console.log(`✅ Saved certificate with proper key: "${businessName}"`);
        
        // Remove the old empty-key entry
        await window.electron.hometax.removeCredentials('');
        console.log('✅ Removed old empty-key certificate');
        
        // Restart scheduler to pick up the new certificate
        const scheduler = window.electron.financeHubScheduler;
        await scheduler.stop();
        await scheduler.start();
        console.log('✅ Scheduler restarted');
        
        console.log('🎉 Migration complete!');
        console.log(`Tax entity will now be scheduled as: tax:${businessName}`);
      } else {
        console.error('❌ Certificate has empty business name - cannot migrate');
      }
    } else {
      console.log('ℹ️  No certificate with empty key found');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
})();

// Immediate Fix: Add Tax Scheduler Entry
// Run this in DevTools Console to fix Hometax scheduling RIGHT NOW

(async () => {
  console.log('🔧 Adding tax scheduler entry...');
  
  // Get current scheduler settings
  const settings = await window.electron.financeHubScheduler.getSettings();
  
  console.log('Current tax schedules:', Object.keys(settings.tax || {}));
  
  // Add "주식회사 쿠스" if missing
  if (!settings.tax) settings.tax = {};
  
  if (!settings.tax['주식회사 쿠스']) {
    settings.tax['주식회사 쿠스'] = {
      enabled: true,
      time: '06:00'
    };
    
    // Update settings
    await window.electron.financeHubScheduler.updateSettings(settings);
    console.log('✅ Added tax schedule for "주식회사 쿠스"');
    
    // Restart scheduler
    await window.electron.financeHubScheduler.stop();
    await window.electron.financeHubScheduler.start();
    console.log('✅ Scheduler restarted');
    
    console.log('\n🎉 Done! Hometax will now sync at 6:00 AM daily');
  } else {
    console.log('ℹ️  Tax schedule already exists');
  }
})();

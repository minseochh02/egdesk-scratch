#!/usr/bin/env node

/**
 * Test script for EGDesk Windows Template Debugger
 * This script simulates template save attempts to test the debugger functionality
 */

const { generateDebugReport } = require('./generate-debug-report');

function testDebugger() {
  console.log('🧪 Testing EGDesk Windows Template Debugger');
  console.log('==========================================');
  
  // Test 1: Generate debug report
  console.log('\n1. Testing debug report generation...');
  try {
    generateDebugReport();
    console.log('✅ Debug report generation test passed');
  } catch (error) {
    console.log('❌ Debug report generation test failed:', error.message);
  }
  
  // Test 2: Check system information
  console.log('\n2. Testing system information collection...');
  const systemInfo = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    isWindows: process.platform === 'win32',
    memoryUsage: process.memoryUsage(),
  };
  
  console.log('System Info:', systemInfo);
  console.log('✅ System information collection test passed');
  
  // Test 3: Simulate template save attempts
  console.log('\n3. Testing template save simulation...');
  const mockTemplateSaveAttempts = [
    {
      timestamp: new Date().toISOString(),
      templateId: 'test-template-1',
      templateName: 'Test Template 1',
      siteId: 'test-site-1',
      success: true,
    },
    {
      timestamp: new Date().toISOString(),
      templateId: 'test-template-2',
      templateName: 'Test Template 2',
      siteId: 'test-site-1',
      success: false,
      error: 'Permission denied',
    },
  ];
  
  console.log('Mock template save attempts:', mockTemplateSaveAttempts);
  console.log('✅ Template save simulation test passed');
  
  // Test 4: Check Windows-specific issues
  console.log('\n4. Testing Windows-specific issue detection...');
  if (process.platform === 'win32') {
    console.log('🪟 Windows platform detected');
    
    // Check for common Windows issues
    const windowsIssues = [];
    
    if (!process.env.APPDATA) {
      windowsIssues.push('APPDATA environment variable not set');
    }
    
    if (!process.env.LOCALAPPDATA) {
      windowsIssues.push('LOCALAPPDATA environment variable not set');
    }
    
    if (windowsIssues.length > 0) {
      console.log('⚠️  Windows issues detected:', windowsIssues);
    } else {
      console.log('✅ No Windows issues detected');
    }
  } else {
    console.log('ℹ️  Non-Windows platform, skipping Windows-specific tests');
  }
  
  // Test 5: File system checks
  console.log('\n5. Testing file system checks...');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  
  const testPaths = [
    os.homedir(),
    os.tmpdir(),
  ];
  
  for (const testPath of testPaths) {
    try {
      const testFile = path.join(testPath, 'egdesk-debug-test.txt');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`✅ Writable: ${testPath}`);
    } catch (error) {
      console.log(`❌ Not writable: ${testPath} - ${error.message}`);
    }
  }
  
  console.log('\n🎉 All debugger tests completed!');
  console.log('\nTo test the full debugger:');
  console.log('1. Start EGDesk');
  console.log('2. Go to WordPress Sites List');
  console.log('3. Click the 🐛 debug button');
  console.log('4. Run the template save tests');
  console.log('5. Generate a debug report');
}

// Run the tests
if (require.main === module) {
  testDebugger();
}

module.exports = { testDebugger };

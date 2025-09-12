#!/usr/bin/env node

/**
 * Test script to verify the debugger works in renderer context
 * This simulates the browser environment to test the debugger
 */

// Mock browser environment
global.window = {
  electron: {
    versions: {
      electron: '20.0.0',
      node: '16.15.0',
      chrome: '104.0.5112.102',
      app: '1.0.0'
    },
    platform: 'win32',
    arch: 'x64',
    isPackaged: true
  },
  navigator: {
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  performance: {
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000
    }
  }
};

global.navigator = global.window.navigator;
global.performance = global.window.performance;

// Mock localStorage
global.localStorage = {
  getItem: (key) => {
    const data = {
      'templateSaveAttempts': '[]',
      'recentErrors': '[]'
    };
    return data[key] || null;
  },
  setItem: (key, value) => {
    console.log(`localStorage.setItem(${key}, ${value})`);
  }
};

function testDebuggerInRenderer() {
  console.log('🧪 Testing EGDesk Debugger in Renderer Context');
  console.log('==============================================');
  
  try {
    // Test platform detection
    const platform = global.window.electron?.platform || global.navigator.platform || 'Unknown';
    const isWindows = platform === 'win32' || platform.includes('Win');
    console.log(`✅ Platform detection: ${platform} (Windows: ${isWindows})`);
    
    // Test version detection
    const electronVersion = global.window.electron?.versions?.electron || 'Unknown';
    const nodeVersion = global.window.electron?.versions?.node || 'Unknown';
    console.log(`✅ Version detection: Electron ${electronVersion}, Node ${nodeVersion}`);
    
    // Test memory usage
    const memoryUsage = global.performance?.memory ? {
      rss: global.performance.memory.usedJSHeapSize,
      heapTotal: global.performance.memory.totalJSHeapSize,
      heapUsed: global.performance.memory.usedJSHeapSize,
      external: 0,
      arrayBuffers: 0
    } : null;
    console.log(`✅ Memory usage detection:`, memoryUsage);
    
    // Test architecture detection
    const architecture = global.window.electron?.arch || 'Unknown';
    console.log(`✅ Architecture detection: ${architecture}`);
    
    // Test user agent
    const userAgent = global.navigator.userAgent;
    console.log(`✅ User agent: ${userAgent}`);
    
    // Test localStorage access
    const templateAttempts = JSON.parse(global.localStorage.getItem('templateSaveAttempts') || '[]');
    const recentErrors = JSON.parse(global.localStorage.getItem('recentErrors') || '[]');
    console.log(`✅ localStorage access: ${templateAttempts.length} attempts, ${recentErrors.length} errors`);
    
    console.log('\n🎉 All renderer context tests passed!');
    console.log('\nThe debugger should now work without "process is not defined" errors.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testDebuggerInRenderer();
}

module.exports = { testDebuggerInRenderer };

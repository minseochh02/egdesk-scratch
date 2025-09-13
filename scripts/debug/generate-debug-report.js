#!/usr/bin/env node

/**
 * Debug Report Generator for EGDesk
 * This script helps generate debug reports for Windows template saving issues
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateDebugReport() {
  log('🔍 EGDesk Debug Report Generator', 'cyan');
  log('================================', 'cyan');
  
  const timestamp = new Date().toISOString();
  const report = {
    generatedAt: timestamp,
    generatedBy: 'EGDesk Debug Report Generator',
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      isWindows: process.platform === 'win32',
      isMac: process.platform === 'darwin',
      isLinux: process.platform === 'linux',
    },
    environment: {
      userHome: os.homedir(),
      tempDir: os.tmpdir(),
      userDataDir: process.env.APPDATA || process.env.HOME,
      nodeEnv: process.env.NODE_ENV || 'development',
      electronVersion: process.versions.electron || 'Not available',
      chromeVersion: process.versions.chrome || 'Not available',
    },
    memory: process.memoryUsage(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };

  // Check for common Windows issues
  if (process.platform === 'win32') {
    log('\n🪟 Windows-specific checks:', 'yellow');
    
    const windowsIssues = [];
    const recommendations = [];
    
    // Check for common Windows paths
    const appDataPath = process.env.APPDATA;
    const localAppDataPath = process.env.LOCALAPPDATA;
    
    if (appDataPath) {
      log(`  ✓ APPDATA: ${appDataPath}`, 'green');
    } else {
      log(`  ✗ APPDATA not found`, 'red');
      windowsIssues.push('APPDATA environment variable not set');
    }
    
    if (localAppDataPath) {
      log(`  ✓ LOCALAPPDATA: ${localAppDataPath}`, 'green');
    } else {
      log(`  ✗ LOCALAPPDATA not found`, 'red');
      windowsIssues.push('LOCALAPPDATA environment variable not set');
    }
    
    // Check for UAC issues
    const isAdmin = process.getuid && process.getuid() === 0;
    if (isAdmin) {
      log(`  ✓ Running as Administrator`, 'green');
    } else {
      log(`  ⚠ Not running as Administrator`, 'yellow');
      recommendations.push('Try running as Administrator if template saving fails');
    }
    
    // Check for antivirus interference
    const commonAntivirusPaths = [
      'C:\\Program Files\\Windows Defender',
      'C:\\Program Files (x86)\\Windows Defender',
      'C:\\Program Files\\McAfee',
      'C:\\Program Files (x86)\\McAfee',
      'C:\\Program Files\\Norton',
      'C:\\Program Files (x86)\\Norton',
    ];
    
    let antivirusDetected = false;
    for (const avPath of commonAntivirusPaths) {
      if (fs.existsSync(avPath)) {
        antivirusDetected = true;
        break;
      }
    }
    
    if (antivirusDetected) {
      log(`  ⚠ Antivirus software detected`, 'yellow');
      recommendations.push('Check if antivirus is blocking file operations');
    } else {
      log(`  ✓ No common antivirus software detected`, 'green');
    }
    
    report.windowsIssues = windowsIssues;
    report.recommendations = recommendations;
  }
  
  // Check file system permissions
  log('\n📁 File system checks:', 'yellow');
  
  const testPaths = [
    os.homedir(),
    os.tmpdir(),
    process.env.APPDATA || process.env.HOME,
  ];
  
  const fileSystemChecks = [];
  
  for (const testPath of testPaths) {
    if (testPath) {
      try {
        const testFile = path.join(testPath, 'egdesk-debug-test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        log(`  ✓ Writable: ${testPath}`, 'green');
        fileSystemChecks.push({ path: testPath, writable: true, error: null });
      } catch (error) {
        log(`  ✗ Not writable: ${testPath} - ${error.message}`, 'red');
        fileSystemChecks.push({ path: testPath, writable: false, error: error.message });
      }
    }
  }
  
  report.fileSystemChecks = fileSystemChecks;
  
  // Generate report file
  const reportPath = path.join(os.homedir(), `egdesk-debug-report-${timestamp.split('T')[0]}.json`);
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n✅ Debug report generated: ${reportPath}`, 'green');
  } catch (error) {
    log(`\n❌ Failed to generate report: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Display summary
  log('\n📊 Summary:', 'cyan');
  log(`  Platform: ${process.platform}`, 'blue');
  log(`  Architecture: ${process.arch}`, 'blue');
  log(`  Node Version: ${process.version}`, 'blue');
  log(`  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`, 'blue');
  log(`  Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`, 'blue');
  
  if (report.windowsIssues && report.windowsIssues.length > 0) {
    log(`\n⚠️  Windows Issues Found:`, 'yellow');
    report.windowsIssues.forEach(issue => {
      log(`    • ${issue}`, 'red');
    });
  }
  
  if (report.recommendations && report.recommendations.length > 0) {
    log(`\n💡 Recommendations:`, 'cyan');
    report.recommendations.forEach(rec => {
      log(`    • ${rec}`, 'green');
    });
  }
  
  log('\n🎯 Next Steps:', 'cyan');
  log('  1. Share the generated report file with the EGDesk support team', 'blue');
  log('  2. Try the template saving feature and note any error messages', 'blue');
  log('  3. Check the Windows Event Viewer for any related errors', 'blue');
  log('  4. Run EGDesk as Administrator if issues persist', 'blue');
  
  log('\n✨ Debug report generation complete!', 'green');
}

// Run the generator
if (require.main === module) {
  generateDebugReport();
}

module.exports = { generateDebugReport };

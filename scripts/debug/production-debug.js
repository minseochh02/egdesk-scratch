#!/usr/bin/env node

/**
 * Production Debug Script for WordPress Sites List Issue
 * 
 * This script helps debug production build issues by:
 * 1. Checking for missing dependencies
 * 2. Validating import paths
 * 3. Testing component rendering
 * 4. Analyzing webpack bundle
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src', 'renderer');
const DIST_DIR = path.join(PROJECT_ROOT, 'release', 'app', 'dist');

console.log('🔍 Production Debug Script for WordPress Sites List');
console.log('=' .repeat(60));

// Check if production build exists
function checkProductionBuild() {
  console.log('\n📦 Checking production build...');
  
  const buildFiles = [
    'renderer.js',
    'style.css',
    'index.html'
  ];
  
  const missingFiles = buildFiles.filter(file => {
    const filePath = path.join(DIST_DIR, file);
    return !fs.existsSync(filePath);
  });
  
  if (missingFiles.length > 0) {
    console.log('❌ Missing production build files:', missingFiles);
    console.log('   Run: npm run build');
    return false;
  }
  
  console.log('✅ Production build files found');
  return true;
}

// Check for missing imports
function checkImports() {
  console.log('\n🔗 Checking import dependencies...');
  
  const wordpressSitesFile = path.join(SRC_DIR, 'components', 'WordPressSitesList.tsx');
  const content = fs.readFileSync(wordpressSitesFile, 'utf8');
  
  // Extract all imports
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  const missingImports = [];
  
  imports.forEach(importPath => {
    // Skip node_modules imports
    if (importPath.startsWith('@') || importPath.startsWith('react') || importPath.startsWith('electron')) {
      return;
    }
    
    // Check relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fullPath = path.resolve(path.dirname(wordpressSitesFile), importPath);
      const extensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];
      
      const found = extensions.some(ext => {
        return fs.existsSync(fullPath + ext) || fs.existsSync(fullPath + '/index' + ext);
      });
      
      if (!found) {
        missingImports.push(importPath);
      }
    }
  });
  
  if (missingImports.length > 0) {
    console.log('❌ Missing import files:', missingImports);
    return false;
  }
  
  console.log('✅ All imports resolved');
  return true;
}

// Check webpack bundle for errors
function checkWebpackBundle() {
  console.log('\n📊 Analyzing webpack bundle...');
  
  try {
    const bundlePath = path.join(DIST_DIR, 'renderer.js');
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    
    // Check for common webpack errors
    const errorPatterns = [
      /Module not found/gi,
      /Cannot resolve module/gi,
      /Error: Cannot find module/gi,
      /webpackMissingModule/gi
    ];
    
    const errors = [];
    errorPatterns.forEach(pattern => {
      const matches = bundleContent.match(pattern);
      if (matches) {
        errors.push(...matches);
      }
    });
    
    if (errors.length > 0) {
      console.log('❌ Webpack bundle errors found:', errors.slice(0, 5));
      return false;
    }
    
    console.log('✅ Webpack bundle appears clean');
    return true;
  } catch (error) {
    console.log('❌ Could not analyze webpack bundle:', error.message);
    return false;
  }
}

// Test component dependencies
function testComponentDependencies() {
  console.log('\n🧪 Testing component dependencies...');
  
  const dependencies = [
    'components/AIKeysManager/store/aiKeysStore.ts',
    'components/AIKeysManager/types.ts',
    'components/ScheduledPosts.tsx',
    'components/WordPressSitesList/WordPressPostScheduler.tsx',
    'components/SchedulerManager/SchedulerManager.tsx',
    'components/DebugButton.tsx',
    'utils/fontAwesomeIcons.ts',
    'services/schedulerService.ts'
  ];
  
  const missingDeps = dependencies.filter(dep => {
    const fullPath = path.join(SRC_DIR, dep);
    return !fs.existsSync(fullPath);
  });
  
  if (missingDeps.length > 0) {
    console.log('❌ Missing component dependencies:', missingDeps);
    return false;
  }
  
  console.log('✅ All component dependencies found');
  return true;
}

// Generate debug report
function generateDebugReport() {
  console.log('\n📋 Generating debug report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    srcDir: SRC_DIR,
    distDir: DIST_DIR,
    checks: {
      productionBuild: checkProductionBuild(),
      imports: checkImports(),
      webpackBundle: checkWebpackBundle(),
      componentDependencies: testComponentDependencies()
    }
  };
  
  const reportPath = path.join(PROJECT_ROOT, 'debug-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`✅ Debug report saved to: ${reportPath}`);
  
  // Summary
  const allPassed = Object.values(report.checks).every(check => check === true);
  
  if (allPassed) {
    console.log('\n🎉 All checks passed! The issue might be runtime-related.');
    console.log('   Try the following:');
    console.log('   1. Check browser console for JavaScript errors');
    console.log('   2. Verify Electron main process is running correctly');
    console.log('   3. Check if all required environment variables are set');
  } else {
    console.log('\n⚠️  Some checks failed. Fix the issues above and rebuild.');
  }
  
  return report;
}

// Main execution
function main() {
  try {
    const report = generateDebugReport();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkProductionBuild,
  checkImports,
  checkWebpackBundle,
  testComponentDependencies,
  generateDebugReport
};

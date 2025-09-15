#!/usr/bin/env node

/**
 * Test script to verify path resolution for scheduler
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Path Resolution for Scheduler');
console.log('========================================');

// Test the path resolution logic
const scriptPath = './scripts/content/generate-and-upload-blog.js';

console.log(`\n📄 Script path: ${scriptPath}`);

// Simulate development mode path resolution
const projectRoot = path.join(__dirname, '..', '..');
const resolvedPath = path.resolve(projectRoot, scriptPath);

console.log(`📁 Project root: ${projectRoot}`);
console.log(`📄 Resolved path: ${resolvedPath}`);
console.log(`📄 Script exists: ${fs.existsSync(resolvedPath)}`);

if (fs.existsSync(resolvedPath)) {
  console.log(`✅ Path resolution works correctly!`);
  
  // Try to require the module
  try {
    const scriptModule = require(resolvedPath);
    console.log(`✅ Module loaded successfully`);
    console.log(`📦 Exported functions: ${Object.keys(scriptModule).join(', ')}`);
    
    if (scriptModule.main) {
      console.log(`✅ main function is available`);
    } else {
      console.log(`❌ main function is NOT available`);
    }
  } catch (error) {
    console.error(`❌ Error loading module: ${error.message}`);
  }
} else {
  console.log(`❌ Script file not found at resolved path`);
  
  // Show what's in the project root
  console.log(`\n📁 Project root contents:`);
  if (fs.existsSync(projectRoot)) {
    const contents = fs.readdirSync(projectRoot);
    console.log(`  ${contents.join(', ')}`);
  }
  
  // Show what's in scripts directory
  const scriptsDir = path.join(projectRoot, 'scripts');
  console.log(`\n📁 Scripts directory: ${scriptsDir}`);
  console.log(`  Exists: ${fs.existsSync(scriptsDir)}`);
  
  if (fs.existsSync(scriptsDir)) {
    const scriptsContents = fs.readdirSync(scriptsDir);
    console.log(`  Contents: ${scriptsContents.join(', ')}`);
    
    // Check content subdirectory
    const contentDir = path.join(scriptsDir, 'content');
    console.log(`\n📁 Content directory: ${contentDir}`);
    console.log(`  Exists: ${fs.existsSync(contentDir)}`);
    
    if (fs.existsSync(contentDir)) {
      const contentContents = fs.readdirSync(contentDir);
      console.log(`  Contents: ${contentContents.join(', ')}`);
    }
  }
}

console.log('\n✅ Path resolution test completed!');

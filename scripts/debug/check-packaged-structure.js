#!/usr/bin/env node

/**
 * Debug script to check the actual directory structure in a packaged Electron app
 * This script should be run from within the packaged app to see where files are located
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

console.log('🔍 Checking Packaged App Directory Structure');
console.log('=============================================');

console.log(`📁 App is packaged: ${app.isPackaged}`);
console.log(`📁 App path: ${app.getAppPath()}`);
console.log(`📁 Process resources path: ${process.resourcesPath}`);

if (app.isPackaged) {
  console.log('\n📂 Resources directory structure:');
  if (fs.existsSync(process.resourcesPath)) {
    const resourcesContents = fs.readdirSync(process.resourcesPath);
    console.log(`  Contents: ${resourcesContents.join(', ')}`);
    
    // Check for app.asar.unpacked
    const asarUnpackedDir = path.join(process.resourcesPath, 'app.asar.unpacked');
    console.log(`\n📂 App.asar.unpacked directory: ${asarUnpackedDir}`);
    console.log(`  Exists: ${fs.existsSync(asarUnpackedDir)}`);
    
    if (fs.existsSync(asarUnpackedDir)) {
      const asarUnpackedContents = fs.readdirSync(asarUnpackedDir);
      console.log(`  Contents: ${asarUnpackedContents.join(', ')}`);
      
      // Check for scripts directory
      const scriptsDir = path.join(asarUnpackedDir, 'scripts');
      console.log(`\n📂 Scripts directory: ${scriptsDir}`);
      console.log(`  Exists: ${fs.existsSync(scriptsDir)}`);
      
      if (fs.existsSync(scriptsDir)) {
        const scriptsContents = fs.readdirSync(scriptsDir);
        console.log(`  Contents: ${scriptsContents.join(', ')}`);
        
        // Check for content subdirectory
        const contentDir = path.join(scriptsDir, 'content');
        console.log(`\n📂 Content directory: ${contentDir}`);
        console.log(`  Exists: ${fs.existsSync(contentDir)}`);
        
        if (fs.existsSync(contentDir)) {
          const contentContents = fs.readdirSync(contentDir);
          console.log(`  Contents: ${contentContents.join(', ')}`);
          
          // Check for the specific script
          const targetScript = path.join(contentDir, 'generate-and-upload-blog.js');
          console.log(`\n📄 Target script: ${targetScript}`);
          console.log(`  Exists: ${fs.existsSync(targetScript)}`);
        }
      }
    }
    
    // Check if scripts is directly in resources
    const directScriptsDir = path.join(process.resourcesPath, 'scripts');
    console.log(`\n📂 Direct scripts directory: ${directScriptsDir}`);
    console.log(`  Exists: ${fs.existsSync(directScriptsDir)}`);
    
    if (fs.existsSync(directScriptsDir)) {
      const directScriptsContents = fs.readdirSync(directScriptsDir);
      console.log(`  Contents: ${directScriptsContents.join(', ')}`);
    }
  }
} else {
  console.log('\n📂 Development mode - checking current directory:');
  const currentDir = process.cwd();
  console.log(`  Current directory: ${currentDir}`);
  console.log(`  Contents: ${fs.readdirSync(currentDir).join(', ')}`);
}

console.log('\n✅ Directory structure check completed!');


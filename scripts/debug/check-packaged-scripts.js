#!/usr/bin/env node

/**
 * Debug script to check where scripts are located in the packaged app
 * Run this from within the packaged app to see the directory structure
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

console.log('🔍 Checking Packaged App Script Locations');
console.log('==========================================');

console.log(`📁 App is packaged: ${app.isPackaged}`);
console.log(`📁 App path: ${app.getAppPath()}`);
console.log(`📁 Process resources path: ${process.resourcesPath}`);

if (app.isPackaged) {
  console.log('\n📂 Resources directory structure:');
  if (fs.existsSync(process.resourcesPath)) {
    const resourcesContents = fs.readdirSync(process.resourcesPath);
    console.log(`  Contents: ${resourcesContents.join(', ')}`);
    
    // Check for scripts directory
    const scriptsDir = path.join(process.resourcesPath, 'scripts');
    console.log(`\n📂 Scripts directory: ${scriptsDir}`);
    console.log(`  Exists: ${fs.existsSync(scriptsDir)}`);
    
    if (fs.existsSync(scriptsDir)) {
      console.log(`  Contents: ${fs.readdirSync(scriptsDir).join(', ')}`);
      
      // Check for content subdirectory
      const contentDir = path.join(scriptsDir, 'content');
      console.log(`\n📂 Content directory: ${contentDir}`);
      console.log(`  Exists: ${fs.existsSync(contentDir)}`);
      
      if (fs.existsSync(contentDir)) {
        console.log(`  Contents: ${fs.readdirSync(contentDir).join(', ')}`);
        
        // Check for the specific script
        const targetScript = path.join(contentDir, 'generate-and-upload-blog.js');
        console.log(`\n📄 Target script: ${targetScript}`);
        console.log(`  Exists: ${fs.existsSync(targetScript)}`);
      }
    }
    
    // Check app.asar.unpacked directory
    const asarUnpackedDir = path.join(process.resourcesPath, 'app.asar.unpacked');
    console.log(`\n📂 App.asar.unpacked directory: ${asarUnpackedDir}`);
    console.log(`  Exists: ${fs.existsSync(asarUnpackedDir)}`);
    
    if (fs.existsSync(asarUnpackedDir)) {
      console.log(`  Contents: ${fs.readdirSync(asarUnpackedDir).join(', ')}`);
    }
  }
} else {
  console.log('\n📂 Development mode - checking current directory:');
  const currentDir = process.cwd();
  console.log(`  Current directory: ${currentDir}`);
  console.log(`  Contents: ${fs.readdirSync(currentDir).join(', ')}`);
  
  const scriptsDir = path.join(currentDir, 'scripts');
  console.log(`\n📂 Scripts directory: ${scriptsDir}`);
  console.log(`  Exists: ${fs.existsSync(scriptsDir)}`);
  
  if (fs.existsSync(scriptsDir)) {
    console.log(`  Contents: ${fs.readdirSync(scriptsDir).join(', ')}`);
  }
}

console.log('\n✅ Script location check completed!');

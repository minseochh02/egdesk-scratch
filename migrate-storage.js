#!/usr/bin/env node

/**
 * Storage Migration Script for EGDesk
 * 
 * This script migrates WordPress connections from the old "electron-react-boilerplate" 
 * storage location to the new "egdesk" storage location.
 * 
 * Run this script after renaming the application to restore your WordPress connections.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get the old and new storage paths
const getStoragePath = (appName) => {
  const platform = process.platform;
  let basePath;
  
  switch (platform) {
    case 'win32':
      basePath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
      break;
    case 'darwin':
      basePath = path.join(os.homedir(), 'Library', 'Application Support', appName);
      break;
    default:
      basePath = path.join(os.homedir(), '.config', appName);
  }
  
  return basePath;
};

const oldStoragePath = getStoragePath('electron-react-boilerplate');
const newStoragePath = getStoragePath('egdesk');

console.log('🔄 EGDesk Storage Migration Script');
console.log('==================================');
console.log(`Old storage path: ${oldStoragePath}`);
console.log(`New storage path: ${newStoragePath}`);

// Check if old storage exists
if (!fs.existsSync(oldStoragePath)) {
  console.log('❌ Old storage directory not found. Nothing to migrate.');
  process.exit(0);
}

// Check if new storage exists
if (!fs.existsSync(newStoragePath)) {
  console.log('📁 Creating new storage directory...');
  fs.mkdirSync(newStoragePath, { recursive: true });
}

// Copy the config.json file (which contains encrypted WordPress connections)
const oldConfigPath = path.join(oldStoragePath, 'config.json');
const newConfigPath = path.join(newStoragePath, 'config.json');

if (fs.existsSync(oldConfigPath)) {
  console.log('📋 Found old config.json, copying to new location...');
  
  try {
    // Read the old config
    const oldConfig = fs.readFileSync(oldConfigPath);
    
    // Write to new location
    fs.writeFileSync(newConfigPath, oldConfig);
    
    console.log('✅ Successfully migrated config.json');
    console.log('🎉 Your WordPress connections should now be restored!');
    
    // Optional: Create a backup of the old config
    const backupPath = path.join(oldStoragePath, 'config.json.backup');
    fs.copyFileSync(oldConfigPath, backupPath);
    console.log(`💾 Created backup at: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error migrating config:', error.message);
    process.exit(1);
  }
} else {
  console.log('❌ No config.json found in old storage directory.');
}

// Copy other important files if they exist
const filesToMigrate = [
  'database',
  'Cookies',
  'Cookies-journal',
  'Preferences',
  'Local Storage',
  'Session Storage'
];

console.log('\n📁 Migrating other storage files...');

filesToMigrate.forEach(fileName => {
  const oldFilePath = path.join(oldStoragePath, fileName);
  const newFilePath = path.join(newStoragePath, fileName);
  
  if (fs.existsSync(oldFilePath)) {
    try {
      if (fs.statSync(oldFilePath).isDirectory()) {
        // Copy directory recursively
        copyDirRecursive(oldFilePath, newFilePath);
        console.log(`✅ Migrated directory: ${fileName}`);
      } else {
        // Copy file
        fs.copyFileSync(oldFilePath, newFilePath);
        console.log(`✅ Migrated file: ${fileName}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not migrate ${fileName}: ${error.message}`);
    }
  }
});

console.log('\n🎉 Migration completed!');
console.log('📝 Next steps:');
console.log('1. Start EGDesk application');
console.log('2. Check if your WordPress connections are restored');
console.log('3. If everything works, you can safely delete the old storage directory');
console.log(`   Old directory: ${oldStoragePath}`);

// Helper function to copy directories recursively
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

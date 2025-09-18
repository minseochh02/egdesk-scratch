#!/usr/bin/env node

/**
 * Cleanup Old Storage Script
 * This script removes old file-based storage files after migration to Electron Store
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Clean up old storage files
 */
function cleanupOldStorage() {
  try {
    console.log('🧹 Starting cleanup of old storage files...');
    
    const oldSchedulerDir = path.join(os.homedir(), '.egdesk-scheduler');
    const electronStorePath = path.join(os.homedir(), 'Library', 'Application Support', 'EGDesk', 'config.json');
    
    // Check if Electron Store exists (migration completed)
    if (!fs.existsSync(electronStorePath)) {
      console.log('⚠️  Electron Store not found. Migration may not be complete.');
      console.log('   Skipping cleanup to avoid data loss.');
      return;
    }
    
    console.log('✅ Electron Store found. Proceeding with cleanup...');
    
    // Check if old scheduler directory exists
    if (fs.existsSync(oldSchedulerDir)) {
      console.log(`📁 Found old scheduler directory: ${oldSchedulerDir}`);
      
      // List files in the directory
      const files = fs.readdirSync(oldSchedulerDir);
      console.log(`📋 Files to clean up: ${files.join(', ')}`);
      
      // Remove each file
      files.forEach(file => {
        const filePath = path.join(oldSchedulerDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Removed: ${file}`);
        } catch (error) {
          console.error(`❌ Error removing ${file}:`, error.message);
        }
      });
      
      // Remove the directory itself
      try {
        fs.rmdirSync(oldSchedulerDir);
        console.log(`🗑️  Removed directory: ${oldSchedulerDir}`);
      } catch (error) {
        console.error(`❌ Error removing directory:`, error.message);
      }
      
      console.log('✅ Old storage cleanup completed successfully!');
    } else {
      console.log('ℹ️  No old storage directory found. Nothing to clean up.');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

/**
 * Main execution function
 */
function main() {
  console.log('🚀 EGDesk Storage Cleanup Tool');
  console.log('================================');
  
  cleanupOldStorage();
  
  console.log('\n✨ Cleanup process completed!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { cleanupOldStorage };

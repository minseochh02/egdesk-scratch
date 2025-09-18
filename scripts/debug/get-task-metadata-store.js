#!/usr/bin/env node

/**
 * Task Metadata Retrieval Script (Electron Store Version)
 * This script retrieves task metadata from the Electron Store
 * Used by other scripts to get topic and configuration data
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get task metadata by task ID from Electron Store
 * @param {string} taskId - The task ID to retrieve metadata for
 * @returns {Object|null} - The task metadata or null if not found
 */
function getTaskMetadataFromStore(taskId) {
  try {
    // Look for the Electron Store config file
    const storePath = path.join(os.homedir(), 'Library', 'Application Support', 'EGDesk', 'config.json');
    
    console.log(`🔍 Looking for Electron Store config at: ${storePath}`);
    
    if (!fs.existsSync(storePath)) {
      console.error(`❌ Electron Store config not found at: ${storePath}`);
      return null;
    }
    
    const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    
    if (!storeData.scheduledTasks) {
      console.error(`❌ No scheduledTasks found in store`);
      return null;
    }
    
    const tasks = storeData.scheduledTasks;
    console.log(`📊 Found ${tasks.length} tasks in store`);
    
    // Find the task by ID
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      console.error(`❌ Task with ID ${taskId} not found`);
      return null;
    }
    
    console.log(`✅ Found task: ${task.name}`);
    
    return task.metadata || null;
    
  } catch (error) {
    console.error(`❌ Error retrieving task metadata:`, error.message);
    return null;
  }
}

/**
 * Main execution function
 */
function main() {
  const taskId = process.argv[2];
  
  if (!taskId) {
    console.error('❌ Usage: node get-task-metadata-store.js <taskId>');
    process.exit(1);
  }
  
  console.log(`🔍 Retrieving metadata for task: ${taskId}`);
  
  const metadata = getTaskMetadataFromStore(taskId);
  
  if (metadata) {
    console.log('\n📋 Task Metadata:');
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    console.log('\n❌ No metadata found');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { getTaskMetadataFromStore };

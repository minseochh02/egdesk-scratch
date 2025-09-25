#!/usr/bin/env node

/**
 * Task Metadata Retrieval Script
 * This script retrieves task metadata from the scheduler system
 * Used by other scripts to get topic and configuration data
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { default: Store } = require('electron-store');

/**
 * Get task metadata by task ID
 * @param {string} taskId - The task ID to retrieve metadata for
 * @returns {Object|null} - The task metadata or null if not found
 */
function getTaskMetadata(taskId) {
  try {
    // Initialize Electron Store with the same encryption key as the main app
    const store = new Store({
      encryptionKey: 'your-encryption-key-here',
      projectName: 'egdesk'
    });
    
    console.log(`🔍 Accessing Electron Store for task: ${taskId}`);
    
    // Debug: List all keys in the store
    const allKeys = store.store;
    console.log(`🔍 All keys in store:`, Object.keys(allKeys));
    
    const tasks = store.get('scheduledTasks', []);
    console.log(`📊 Found ${tasks.length} tasks in store`);
    
    // Find the task by ID
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      console.error(`❌ Task with ID ${taskId} not found`);
      console.log(`📋 Available task IDs: ${tasks.map(t => t.id).join(', ')}`);
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
 * List all tasks in the store
 */
function listAllTasks() {
  try {
    const store = new Store({
      encryptionKey: 'your-encryption-key-here',
      projectName: 'egdesk'
    });
    
    console.log(`🔍 Accessing Electron Store...`);
    
    const allKeys = store.store;
    console.log(`🔍 All keys in store:`, Object.keys(allKeys));
    
    const tasks = store.get('scheduledTasks', []);
    console.log(`📊 Found ${tasks.length} tasks in store`);
    
    if (tasks.length > 0) {
      console.log('\n📋 Available tasks:');
      tasks.forEach((task, index) => {
        console.log(`${index + 1}. ID: ${task.id}`);
        console.log(`   Name: ${task.name}`);
        console.log(`   Schedule: ${task.schedule}`);
        console.log(`   Enabled: ${task.enabled}`);
        console.log(`   Command: ${task.command}`);
        console.log('');
      });
    }
    
    return tasks;
  } catch (error) {
    console.error(`❌ Error listing tasks:`, error.message);
    return [];
  }
}

/**
 * Main execution function
 */
function main() {
  const taskId = process.argv[2];
  
  if (!taskId) {
    console.error('❌ Task ID is required');
    console.log('Usage: node get-task-metadata.js <taskId>');
    console.log('To list all tasks: node get-task-metadata.js list');
    process.exit(1);
  }
  
  if (taskId === 'list') {
    console.log(`🚀 Listing all tasks...`);
    listAllTasks();
    return;
  }
  
  console.log(`🚀 Retrieving metadata for task: ${taskId}`);
  
  const metadata = getTaskMetadata(taskId);
  
  if (metadata) {
    // Output the metadata as JSON for other scripts to consume
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    console.error('❌ Failed to retrieve task metadata');
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { getTaskMetadata };

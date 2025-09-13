#!/usr/bin/env node

/**
 * Task Metadata Retrieval Script
 * This script retrieves task metadata from the scheduler system
 * Used by other scripts to get topic and configuration data
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get task metadata by task ID
 * @param {string} taskId - The task ID to retrieve metadata for
 * @returns {Object|null} - The task metadata or null if not found
 */
function getTaskMetadata(taskId) {
  try {
    // Look for the tasks file in the correct location
    const tasksFilePath = path.join(os.homedir(), '.egdesk-scheduler', 'tasks.json');
    
    console.log(`🔍 Looking for tasks file at: ${tasksFilePath}`);
    
    if (!fs.existsSync(tasksFilePath)) {
      console.error(`❌ Tasks file not found at: ${tasksFilePath}`);
      return null;
    }
    
    const tasks = JSON.parse(fs.readFileSync(tasksFilePath, 'utf8'));
    
    console.log(`📊 Found ${tasks.length} tasks in file`);
    
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
    console.error('❌ Task ID is required');
    console.log('Usage: node get-task-metadata.js <taskId>');
    process.exit(1);
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

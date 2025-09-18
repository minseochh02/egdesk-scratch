#!/usr/bin/env node

/**
 * Task Metadata Update Script
 * This script updates task metadata by calling the main app's IPC handler
 * Used for testing and debugging metadata updates
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * Update task metadata by calling the main app
 * @param {string} taskId - The task ID to update
 * @param {Object} metadata - The metadata to update
 */
async function updateTaskMetadata(taskId, metadata) {
  return new Promise((resolve, reject) => {
    // Create a simple script that will be executed by the main app
    const updateScript = `
      const { ipcRenderer } = require('electron');
      
      async function updateMetadata() {
        try {
          const result = await ipcRenderer.invoke('scheduler-update-task-metadata', '${taskId}', ${JSON.stringify(metadata)});
          console.log('Update result:', result);
          process.exit(result.success ? 0 : 1);
        } catch (error) {
          console.error('Error updating metadata:', error);
          process.exit(1);
        }
      }
      
      updateMetadata();
    `;
    
    // Write the script to a temporary file
    const tempScriptPath = path.join(os.tmpdir(), `update-metadata-${Date.now()}.js`);
    require('fs').writeFileSync(tempScriptPath, updateScript);
    
    // Execute the script using node
    const child = spawn('node', [tempScriptPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    child.on('close', (code) => {
      // Clean up the temporary file
      try {
        require('fs').unlinkSync(tempScriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main execution function
 */
async function main() {
  const taskId = process.argv[2];
  const metadataJson = process.argv[3];
  
  if (!taskId || !metadataJson) {
    console.error('❌ Usage: node update-task-metadata.js <taskId> <metadataJson>');
    console.error('   Example: node update-task-metadata.js "task-123" \'{"topics":[{"topic":"AI","count":1}]}\'');
    process.exit(1);
  }
  
  try {
    const metadata = JSON.parse(metadataJson);
    console.log(`🔄 Updating metadata for task: ${taskId}`);
    console.log(`📊 Metadata:`, JSON.stringify(metadata, null, 2));
    
    await updateTaskMetadata(taskId, metadata);
    console.log('✅ Metadata updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating metadata:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { updateTaskMetadata };

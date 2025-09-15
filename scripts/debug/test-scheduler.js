#!/usr/bin/env node

/**
 * Test script for scheduler functionality
 * This script tests the scheduler manager's ability to execute tasks
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('🧪 Testing Scheduler Functionality');
console.log('==================================');

// Test 1: Check if we can access the script that would be executed
const scriptPath = './scripts/content/generate-and-upload-blog.js';
const resolvedPath = path.resolve(process.cwd(), scriptPath);

console.log(`\n📁 Current working directory: ${process.cwd()}`);
console.log(`📄 Script path: ${scriptPath}`);
console.log(`📄 Resolved path: ${resolvedPath}`);
console.log(`📄 Script exists: ${fs.existsSync(resolvedPath)}`);

// Test 2: Check if we can access the tasks file
const tasksPath = path.join(os.homedir(), '.egdesk-scheduler', 'tasks.json');
console.log(`\n📁 Tasks file path: ${tasksPath}`);
console.log(`📄 Tasks file exists: ${fs.existsSync(tasksPath)}`);

if (fs.existsSync(tasksPath)) {
  try {
    const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    console.log(`📊 Number of tasks: ${tasks.length}`);
    
    // Check for tasks with ELECTRON_SCRIPT commands
    const scriptTasks = tasks.filter(task => 
      task.command && task.command.startsWith('ELECTRON_SCRIPT:')
    );
    console.log(`📊 Script tasks: ${scriptTasks.length}`);
    
    if (scriptTasks.length > 0) {
      console.log('\n🔍 Script tasks found:');
      scriptTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.name}`);
        console.log(`     Command: ${task.command}`);
        console.log(`     Schedule: ${task.schedule}`);
        console.log(`     Enabled: ${task.enabled}`);
      });
    }
  } catch (error) {
    console.error(`❌ Error reading tasks file: ${error.message}`);
  }
}

// Test 3: Check environment variables
console.log('\n🔧 Environment Variables:');
const requiredVars = [
  'NODE_ENV',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Not set'}`);
});

console.log('\n✅ Scheduler test completed!');

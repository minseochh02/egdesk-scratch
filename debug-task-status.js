#!/usr/bin/env node

/**
 * Debug script to check task execution status
 * This will help you see what's happening with your running task
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Checking task execution status...\n');

// Check if the main process is running and get task executions
async function checkTaskStatus() {
  try {
    // Try to get task executions from the main process
    // This assumes the Electron app is running
    console.log('📊 Attempting to get task executions from main process...');
    
    // Check running processes
    console.log('\n🔄 Checking running Node.js processes...');
    const psProcess = spawn('ps', ['aux'], { stdio: 'pipe' });
    
    let psOutput = '';
    psProcess.stdout.on('data', (data) => {
      psOutput += data.toString();
    });
    
    psProcess.on('close', (code) => {
      if (code === 0) {
        const lines = psOutput.split('\n');
        const nodeProcesses = lines.filter(line => 
          line.includes('node') && 
          (line.includes('scripts/content/generate-blog-content') || line.includes('task-1757448394796'))
        );
        
        console.log('📋 Found Node.js processes:');
        if (nodeProcesses.length > 0) {
          nodeProcesses.forEach(process => {
            console.log(`  ${process}`);
          });
        } else {
          console.log('  No matching Node.js processes found');
        }
      }
    });
    
    // Check for any log files that might have been created
    console.log('\n📁 Checking for log files...');
    const fs = require('fs');
    const os = require('os');
    
    const possibleLogDirs = [
      path.join(os.homedir(), '.egdesk', 'logs'),
      path.join(os.tmpdir(), 'egdesk-logs'),
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), 'output'),
      path.join(process.cwd(), 'error')
    ];
    
    possibleLogDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        console.log(`📂 Found log directory: ${dir}`);
        try {
          const files = fs.readdirSync(dir);
          const recentFiles = files.filter(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            const now = new Date();
            const fileTime = new Date(stats.mtime);
            return (now - fileTime) < 24 * 60 * 60 * 1000; // Last 24 hours
          });
          
          if (recentFiles.length > 0) {
            console.log(`  Recent files: ${recentFiles.join(', ')}`);
          }
        } catch (error) {
          console.log(`  Error reading directory: ${error.message}`);
        }
      }
    });
    
    // Check if the script is still running by looking for the specific task ID
    console.log('\n🎯 Looking for specific task: task-1757448394796-ovmubi0wn-1757448425736');
    
    // Try to find the process by name pattern
    const grepProcess = spawn('pgrep', ['-f', 'task-1757448394796'], { stdio: 'pipe' });
    
    let grepOutput = '';
    grepProcess.stdout.on('data', (data) => {
      grepOutput += data.toString();
    });
    
    grepProcess.on('close', (code) => {
      if (code === 0 && grepOutput.trim()) {
        console.log(`✅ Found running process with PID: ${grepOutput.trim()}`);
        
        // Get more details about this process
        const pid = grepOutput.trim();
        const psDetailProcess = spawn('ps', ['-p', pid, '-o', 'pid,ppid,etime,command'], { stdio: 'pipe' });
        
        let psDetailOutput = '';
        psDetailProcess.stdout.on('data', (data) => {
          psDetailOutput += data.toString();
        });
        
        psDetailProcess.on('close', (code) => {
          if (code === 0) {
            console.log('📊 Process details:');
            console.log(psDetailOutput);
          }
        });
      } else {
        console.log('❌ Task process not found - it may have completed or failed');
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking task status:', error.message);
  }
}

// Check system resources
function checkSystemResources() {
  console.log('\n💻 System Resources:');
  const os = require('os');
  
  console.log(`  CPU Usage: ${os.loadavg()}`);
  console.log(`  Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB`);
  console.log(`  Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
  console.log(`  Uptime: ${Math.round(os.uptime())} seconds`);
}

// Check if the generate-blog-content.js script exists and is executable
function checkScriptFile() {
  console.log('\n📄 Checking script file...');
  const fs = require('fs');
  const scriptPath = path.join(process.cwd(), 'scripts', 'content', 'generate-blog-content.js');
  
  if (fs.existsSync(scriptPath)) {
    console.log(`✅ Script exists: ${scriptPath}`);
    
    const stats = fs.statSync(scriptPath);
    console.log(`  Size: ${stats.size} bytes`);
    console.log(`  Modified: ${stats.mtime}`);
    console.log(`  Executable: ${(stats.mode & parseInt('111', 8)) !== 0}`);
    
    // Check if it's a valid Node.js script
    const content = fs.readFileSync(scriptPath, 'utf8');
    if (content.includes('#!/usr/bin/env node')) {
      console.log('  ✅ Has proper shebang');
    } else {
      console.log('  ⚠️  Missing shebang');
    }
    
    if (content.includes('generateAIContent')) {
      console.log('  ✅ Contains expected functions');
    } else {
      console.log('  ⚠️  Missing expected functions');
    }
  } else {
    console.log(`❌ Script not found: ${scriptPath}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 EGDesk Task Debug Tool');
  console.log('========================\n');
  
  checkSystemResources();
  checkScriptFile();
  await checkTaskStatus();
  
  console.log('\n💡 Debugging Tips:');
  console.log('1. Check the Electron app\'s Scheduler Manager for detailed execution logs');
  console.log('2. Look for any error messages in the console output above');
  console.log('3. If the task is stuck, you can try stopping it and restarting');
  console.log('4. Check if all required environment variables are set');
  console.log('5. Verify your AI API key and WordPress credentials are correct');
  
  console.log('\n🔧 To stop a stuck task:');
  console.log('1. Go to the Scheduler Manager in the Electron app');
  console.log('2. Find your task and click "Stop" if it\'s running');
  console.log('3. Or restart the entire Electron application');
}

main().catch(console.error);


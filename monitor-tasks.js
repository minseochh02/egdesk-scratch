#!/usr/bin/env node

/**
 * Task Monitor - Real-time monitoring of EGDesk tasks
 * This script helps you monitor and debug running tasks
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TaskMonitor {
  constructor() {
    this.runningTasks = new Map();
    this.monitoring = false;
  }

  start() {
    console.log('🚀 Starting Task Monitor...\n');
    this.monitoring = true;
    this.monitorLoop();
  }

  stop() {
    console.log('\n🛑 Stopping Task Monitor...');
    this.monitoring = false;
  }

  async monitorLoop() {
    while (this.monitoring) {
      await this.checkTasks();
      await this.sleep(5000); // Check every 5 seconds
    }
  }

  async checkTasks() {
    try {
      // Get all Node.js processes running generate-blog-content.js
      const processes = await this.getRunningProcesses();
      
      if (processes.length === 0) {
        console.log('✅ No generate-blog-content processes running');
        return;
      }

      console.log(`\n📊 Found ${processes.length} running process(es):`);
      
      for (const proc of processes) {
        const status = await this.getProcessStatus(proc.pid);
        const runtime = this.calculateRuntime(proc.startTime);
        
        console.log(`  PID ${proc.pid}: Running for ${runtime}`);
        console.log(`    State: ${status.state}`);
        console.log(`    CPU: ${status.cpu}%`);
        console.log(`    Memory: ${status.memory} MB`);
        
        // Check if process is stuck (running too long)
        if (this.isProcessStuck(proc, status)) {
          console.log(`    ⚠️  WARNING: Process appears to be stuck!`);
          console.log(`    💡 Consider killing with: kill -9 ${proc.pid}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error monitoring tasks:', error.message);
    }
  }

  async getRunningProcesses() {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['aux'], { stdio: 'pipe' });
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', () => {
        const lines = output.split('\n');
        const processes = [];
        
        for (const line of lines) {
          if (line.includes('scripts/content/generate-blog-content.js') && !line.includes('grep')) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
              processes.push({
                pid: parseInt(parts[1]),
                user: parts[0],
                cpu: parseFloat(parts[2]),
                memory: parseFloat(parts[3]),
                startTime: parts[8],
                command: parts.slice(10).join(' ')
              });
            }
          }
        }
        
        resolve(processes);
      });
    });
  }

  async getProcessStatus(pid) {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['-p', pid, '-o', 'pid,state,pcpu,pmem,etime'], { stdio: 'pipe' });
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', () => {
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].trim().split(/\s+/);
          resolve({
            state: parts[1] || 'unknown',
            cpu: parseFloat(parts[2]) || 0,
            memory: parseFloat(parts[3]) || 0,
            runtime: parts[4] || 'unknown'
          });
        } else {
          resolve({ state: 'unknown', cpu: 0, memory: 0, runtime: 'unknown' });
        }
      });
    });
  }

  calculateRuntime(startTime) {
    // This is a simplified calculation - in reality you'd parse the start time properly
    return startTime;
  }

  isProcessStuck(proc, status) {
    // Consider a process stuck if:
    // 1. It's been running for more than 10 minutes
    // 2. It's in an uninterruptible sleep state (D, U, etc.)
    // 3. It's using 0% CPU for a long time
    
    const stuckStates = ['D', 'U', 'UE', 'UE+'];
    const isStuckState = stuckStates.includes(status.state);
    const isLowCpu = status.cpu < 0.1;
    
    return isStuckState || isLowCpu;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

// Start monitoring
const monitor = new TaskMonitor();
monitor.start();

console.log('💡 Press Ctrl+C to stop monitoring');


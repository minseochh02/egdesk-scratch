import { ipcMain } from 'electron';
import { ScheduledTask, TaskExecution } from '../preload';
import * as schedule from 'node-schedule';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
// Note: ELECTRON_SCRIPT execution is deprecated; use ELECTRON_IPC instead

export interface CreateTaskData {
  name: string;
  description?: string;
  command: string;
  schedule: string; // Will support both cron and date-based formats
  enabled?: boolean;
  workingDirectory?: string;
  environment?: Record<string, string>;
  outputFile?: string;
  errorFile?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTaskData {
  name?: string;
  description?: string;
  command?: string;
  schedule?: string;
  enabled?: boolean;
  workingDirectory?: string;
  environment?: Record<string, string>;
  outputFile?: string;
  errorFile?: string;
  metadata?: Record<string, any>;
}

export class SchedulerManager {
  private tasks: Map<string, ScheduledTask> = new Map();
  private executions: Map<string, TaskExecution> = new Map();
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  private store: any;
  private isInitialized = false;

  constructor(store: any) {
    console.log('🏗️ Creating SchedulerManager instance...');
    this.store = store;
    this.loadTasksFromStore();
    this.registerIpcHandlers();
    this.isInitialized = true;
    console.log('✅ SchedulerManager instance created and initialized');
  }

  private loadTasksFromStore(): void {
    try {
      const storedTasks = this.store.get('scheduledTasks', []);
      let hasMigration = false;
      
      storedTasks.forEach((task: any) => {
        // Convert date strings back to Date objects
        const processedTask: ScheduledTask = {
          ...task,
          createdAt: task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt),
          updatedAt: task.updatedAt instanceof Date ? task.updatedAt : new Date(task.updatedAt),
          lastRun: task.lastRun ? (task.lastRun instanceof Date ? task.lastRun : new Date(task.lastRun)) : null,
          nextRun: task.nextRun ? (task.nextRun instanceof Date ? task.nextRun : new Date(task.nextRun)) : null
        };
        
        // No automatic migration from ELECTRON_SCRIPT; enforce IPC-only at execution time
        
        this.tasks.set(processedTask.id, processedTask);
        if (processedTask.enabled && this.isValidSchedule(processedTask.schedule)) {
          this.scheduleTask(processedTask);
        }
      });
      
      // Save migrated tasks back to store
      if (hasMigration) {
        console.log('💾 Saving migrated tasks to store...');
        this.saveTasksToStore();
      }

      const storedExecutions = this.store.get('taskExecutions', []);
      storedExecutions.forEach((execution: any) => {
        // Convert date strings back to Date objects for executions
        const processedExecution: TaskExecution = {
          ...execution,
          startTime: execution.startTime instanceof Date ? execution.startTime : new Date(execution.startTime),
          createdAt: execution.createdAt instanceof Date ? execution.createdAt : new Date(execution.createdAt),
          endTime: execution.endTime ? (execution.endTime instanceof Date ? execution.endTime : new Date(execution.endTime)) : undefined
        };
        
        this.executions.set(processedExecution.id, processedExecution);
      });

      console.log(`📋 Loaded ${this.tasks.size} tasks and ${this.executions.size} executions`);
    } catch (error) {
      console.error('Failed to load tasks from store:', error);
    }
  }

  private saveTasksToStore(): void {
    try {
      const tasks = Array.from(this.tasks.values());
      const executions = Array.from(this.executions.values());
      
      this.store.set('scheduledTasks', tasks);
      this.store.set('taskExecutions', executions);
    } catch (error) {
      console.error('Failed to save tasks to store:', error);
    }
  }

  private registerIpcHandlers(): void {
    console.log('🔗 Registering scheduler IPC handlers...');
    
    ipcMain.handle('scheduler-create-task', async (event, taskData: CreateTaskData) => {
      try {
        const task = await this.createTask(taskData);
        return { success: true, task };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-update-task', async (event, taskId: string, updates: UpdateTaskData) => {
      try {
        const task = await this.updateTask(taskId, updates);
        return { success: true, task };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-delete-task', async (event, taskId: string) => {
      try {
        await this.deleteTask(taskId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-get-task', async (event, taskId: string) => {
      try {
        const task = this.getTask(taskId);
        return { success: true, task };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-get-all-tasks', async (event) => {
      try {
        const tasks = this.getAllTasks();
        return { success: true, tasks };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-get-executions', async (event, taskId?: string) => {
      try {
        const executions = this.getExecutions(taskId);
        return { success: true, executions };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-run-task-now', async (event, taskId: string) => {
      try {
        await this.runTaskNow(taskId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-stop-task', async (event, taskId: string) => {
      try {
        await this.stopTask(taskId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-get-system-info', async (event) => {
      try {
        const systemInfo = this.getSystemInfo();
        return { success: true, systemInfo };
      } catch (error) {
        console.error('❌ Error getting system info:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-get-task-metadata', async (event, taskId: string) => {
      try {
        const metadata = this.getTaskMetadata(taskId);
        return { success: true, metadata };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    ipcMain.handle('scheduler-update-task-metadata', async (event, taskId: string, metadata: Record<string, any>) => {
      try {
        const task = this.tasks.get(taskId);
        if (!task) {
          throw new Error('Task not found');
        }

        // Update task metadata
        task.metadata = { ...task.metadata, ...metadata };
        task.updatedAt = new Date();
        this.tasks.set(taskId, task);
        this.saveTasksToStore();

        console.log(`📊 Updated metadata for task: ${task.name} (${taskId})`);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
  }

  private async createTask(taskData: CreateTaskData): Promise<ScheduledTask> {
    const { v4: uuidv4 } = await import('uuid');
    const task: ScheduledTask = {
      id: uuidv4(),
      name: taskData.name,
      description: taskData.description || '',
      command: taskData.command,
      schedule: taskData.schedule,
      enabled: taskData.enabled ?? true,
      workingDirectory: taskData.workingDirectory || process.cwd(),
      environment: taskData.environment || {},
      outputFile: taskData.outputFile || '',
      errorFile: taskData.errorFile || '',
      metadata: taskData.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRun: undefined,
      nextRun: undefined,
      runCount: 0,
      successCount: 0,
      failureCount: 0
    };

    // Validate schedule format
    if (!this.isValidSchedule(task.schedule)) {
      throw new Error('Invalid schedule format');
    }

    // Calculate next run time
    task.nextRun = this.calculateNextRun(task.schedule) || undefined;

    this.tasks.set(task.id, task);
    this.saveTasksToStore();

    // Schedule the task if enabled
    if (task.enabled) {
      this.scheduleTask(task);
    }

    console.log(`✅ Created task: ${task.name} (${task.id})`);
    return task;
  }

  private async updateTask(taskId: string, updates: UpdateTaskData): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Stop current scheduling if enabled
    if (task.enabled) {
      this.unscheduleTask(taskId);
    }

    // Apply updates
    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };

    // Recalculate next run if schedule changed
    if (updates.schedule && updates.schedule !== task.schedule) {
      if (!this.isValidSchedule(updates.schedule)) {
        throw new Error('Invalid schedule format');
      }
      updatedTask.nextRun = this.calculateNextRun(updates.schedule) || undefined;
    }

    this.tasks.set(taskId, updatedTask);
    this.saveTasksToStore();

    // Reschedule if enabled
    if (updatedTask.enabled) {
      this.scheduleTask(updatedTask);
    }

    console.log(`🔄 Updated task: ${updatedTask.name} (${taskId})`);
    return updatedTask;
  }

  private async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Stop scheduling
    this.unscheduleTask(taskId);

    // Remove task and its executions
    this.tasks.delete(taskId);
    
    // Remove associated executions
    const executionsToDelete = Array.from(this.executions.values())
      .filter(exec => exec.taskId === taskId)
      .map(exec => exec.id);
    
    executionsToDelete.forEach(execId => this.executions.delete(execId));

    this.saveTasksToStore();

    console.log(`🗑️ Deleted task: ${task.name} (${taskId})`);
  }

  private getTask(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  private getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  private getExecutions(taskId?: string): TaskExecution[] {
    const allExecutions = Array.from(this.executions.values());
    if (taskId) {
      return allExecutions.filter(exec => exec.taskId === taskId);
    }
    return allExecutions;
  }

  private getTaskMetadata(taskId: string): Record<string, any> | null {
    const task = this.tasks.get(taskId);
    return task?.metadata || null;
  }

  private getSystemInfo(): any {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      totalTasks: this.tasks.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
      totalExecutions: this.executions.size
    };
  }

  private async runTaskNow(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    await this.executeTask(task);
  }

  private async stopTask(taskId: string): Promise<void> {
    this.unscheduleTask(taskId);
    
    // Find and stop any running executions
    const runningExecutions = Array.from(this.executions.values())
      .filter(exec => exec.taskId === taskId && exec.status === 'running');
    
    runningExecutions.forEach(exec => {
      exec.status = 'cancelled';
      exec.endTime = new Date();
      exec.output += '\n[Task cancelled by user]';
    });

    this.saveTasksToStore();
  }

  private isValidSchedule(scheduleStr: string): boolean {
    if (!scheduleStr) return false;

    // Support cron format: "cron:minute hour day month weekday"
    if (scheduleStr.startsWith('cron:')) {
      const cronExpression = scheduleStr.replace('cron:', '');
      // Basic cron validation - node-schedule handles more complex validation
      const parts = cronExpression.split(' ');
      return parts.length === 5;
    }

    // Support date format: "date:YYYY-MM-DD HH:MM" or "date:YYYY-MM-DD HH:MM:SS"
    if (scheduleStr.startsWith('date:')) {
      const dateString = scheduleStr.replace('date:', '');
      const date = new Date(dateString);
      return !isNaN(date.getTime()) && date > new Date();
    }

    // Support interval format: "interval:ms"
    if (scheduleStr.startsWith('interval:')) {
      const interval = parseInt(scheduleStr.replace('interval:', ''));
      return !isNaN(interval) && interval > 0;
    }

    // Support monthly format: "monthly:day:hour:minute" (e.g., "monthly:15:14:30" for 15th day of month at 2:30 PM)
    if (scheduleStr.startsWith('monthly:')) {
      const parts = scheduleStr.replace('monthly:', '').split(':');
      if (parts.length !== 3) return false;
      const [day, hour, minute] = parts.map(p => parseInt(p));
      return day >= 1 && day <= 31 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }

    // Support weekly format: "weekly:day:hour:minute" (e.g., "weekly:1:9:0" for Monday at 9:00 AM)
    if (scheduleStr.startsWith('weekly:')) {
      const parts = scheduleStr.replace('weekly:', '').split(':');
      if (parts.length !== 3) return false;
      const [day, hour, minute] = parts.map(p => parseInt(p));
      return day >= 0 && day <= 6 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }

    return false;
  }

  private calculateNextRun(scheduleStr: string): Date | null {
    const now = new Date();

    if (scheduleStr.startsWith('cron:')) {
      // For cron, we'd need a more sophisticated calculation
      // For now, return next minute as placeholder
      return new Date(now.getTime() + 60000);
    }

    if (scheduleStr.startsWith('date:')) {
      const dateString = scheduleStr.replace('date:', '');
      const targetDate = new Date(dateString);
      return targetDate > now ? targetDate : null;
    }

    if (scheduleStr.startsWith('interval:')) {
      const interval = parseInt(scheduleStr.replace('interval:', ''));
      return new Date(now.getTime() + interval);
    }

    if (scheduleStr.startsWith('monthly:')) {
      const parts = scheduleStr.replace('monthly:', '').split(':');
      const [day, hour, minute] = parts.map(p => parseInt(p));
      
      const nextRun = new Date(now);
      nextRun.setDate(day);
      nextRun.setHours(hour, minute, 0, 0);
      
      // If the date has passed this month, move to next month
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      
      return nextRun;
    }

    if (scheduleStr.startsWith('weekly:')) {
      const parts = scheduleStr.replace('weekly:', '').split(':');
      const [targetDay, hour, minute] = parts.map(p => parseInt(p));
      
      const nextRun = new Date(now);
      const currentDay = now.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      
      nextRun.setDate(now.getDate() + daysUntilTarget);
      nextRun.setHours(hour, minute, 0, 0);
      
      // If it's the same day but time has passed, move to next week
      if (daysUntilTarget === 0 && nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      
      return nextRun;
    }

    return null;
  }

  private scheduleTask(task: ScheduledTask): void {
    if (this.scheduledJobs.has(task.id)) {
      this.unscheduleTask(task.id);
    }

    if (task.schedule.startsWith('cron:')) {
      const cronExpression = task.schedule.replace('cron:', '');
      try {
        const job = schedule.scheduleJob(cronExpression, () => {
          this.executeTask(task);
        });
        if (job) {
          this.scheduledJobs.set(task.id, job);
          console.log(`📅 Scheduled cron task: ${task.name}`);
        }
      } catch (error) {
        console.error(`Failed to schedule cron task ${task.name}:`, error);
      }
    } else if (task.schedule.startsWith('date:')) {
      const dateString = task.schedule.replace('date:', '');
      const targetDate = new Date(dateString);
      
      if (targetDate > new Date()) {
        try {
          const job = schedule.scheduleJob(targetDate, () => {
            this.executeTask(task);
          });
          if (job) {
            this.scheduledJobs.set(task.id, job);
            console.log(`📅 Scheduled one-time task: ${task.name} for ${targetDate}`);
          }
        } catch (error) {
          console.error(`Failed to schedule date task ${task.name}:`, error);
        }
      }
    } else if (task.schedule.startsWith('interval:')) {
      const interval = parseInt(task.schedule.replace('interval:', ''));
      const job = schedule.scheduleJob(`*/${Math.ceil(interval / 60000)} * * * *`, () => {
        this.executeTask(task);
      });
      if (job) {
        this.scheduledJobs.set(task.id, job);
        console.log(`📅 Scheduled interval task: ${task.name} every ${interval}ms`);
      }
    } else if (task.schedule.startsWith('monthly:')) {
      const parts = task.schedule.replace('monthly:', '').split(':');
      const [day, hour, minute] = parts.map(p => parseInt(p));
      
      // Create monthly schedule: minute hour day * *
      const cronExpression = `${minute} ${hour} ${day} * *`;
      try {
        const job = schedule.scheduleJob(cronExpression, () => {
          this.executeTask(task);
        });
        if (job) {
          this.scheduledJobs.set(task.id, job);
          console.log(`📅 Scheduled monthly task: ${task.name} on day ${day} at ${hour}:${minute}`);
        }
      } catch (error) {
        console.error(`Failed to schedule monthly task ${task.name}:`, error);
      }
    } else if (task.schedule.startsWith('weekly:')) {
      const parts = task.schedule.replace('weekly:', '').split(':');
      const [day, hour, minute] = parts.map(p => parseInt(p));
      
      // Create weekly schedule: minute hour * * day
      const cronExpression = `${minute} ${hour} * * ${day}`;
      try {
        const job = schedule.scheduleJob(cronExpression, () => {
          this.executeTask(task);
        });
        if (job) {
          this.scheduledJobs.set(task.id, job);
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          console.log(`📅 Scheduled weekly task: ${task.name} on ${dayNames[day]} at ${hour}:${minute}`);
        }
      } catch (error) {
        console.error(`Failed to schedule weekly task ${task.name}:`, error);
      }
    }
  }

  private unscheduleTask(taskId: string): void {
    const job = this.scheduledJobs.get(taskId);
    if (job) {
      job.cancel();
      this.scheduledJobs.delete(taskId);
      console.log(`🚫 Unscheduled task: ${taskId}`);
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');
    const execution: TaskExecution = {
      id: uuidv4(),
      taskId: task.id,
      startTime: new Date(),
      status: 'running',
      output: '',
      createdAt: new Date()
    };

    this.executions.set(execution.id, execution);
    
    // Update task stats
    task.lastRun = new Date();
    task.runCount++;
    task.nextRun = this.calculateNextRun(task.schedule) || undefined;
    this.tasks.set(task.id, task);

    console.log(`🚀 Executing task: ${task.name} (${task.id})`);

    try {
      let command = task.command;
        const ipcCommand = command.replace('ELECTRON_IPC:', '');
        console.log(`📝 Step 1: Running IPC command: ${ipcCommand}`);
        
        // Parse environment variables for IPC parameters
        const topics = task.environment?.BLOG_TOPICS ? JSON.parse(task.environment.BLOG_TOPICS) : [];
        const topicSelectionMode = task.environment?.BLOG_TOPIC_SELECTION_MODE || 'least-used';
        const wordpressSettings = task.environment?.BLOG_WORDPRESS_SETTINGS ? JSON.parse(task.environment.BLOG_WORDPRESS_SETTINGS) : {};
        const aiSettings = task.environment?.BLOG_AI_SETTINGS ? JSON.parse(task.environment.BLOG_AI_SETTINGS) : {};
        
        // Call the appropriate IPC handler
        if (ipcCommand === 'blog-generate-and-upload') {
          const result = await this.callIpcHandler('blog-generate-and-upload', {
            topics,
            topicSelectionMode,
            wordpressSettings,
            aiSettings
          });
          
          execution.status = result.success ? 'completed' : 'failed';
          execution.output = result.success ? 
            `Blog post generated and uploaded successfully. Post ID: ${result.data?.postId || 'N/A'}` : 
            `Failed to generate and upload blog post: ${result.error || 'Unknown error'}`;
          execution.endTime = new Date();
          
          if (result.success) {
            task.successCount++;
            console.log(`✅ Blog post generated and uploaded successfully`);
          } else {
            task.failureCount++;
            console.error(`❌ Blog post generation failed: ${result.error}`);
          }
          
          this.executions.set(execution.id, execution);
          this.tasks.set(task.id, task);
          this.saveTasksToStore();
          return;
        } else {
          throw new Error(`Unknown IPC command: ${ipcCommand}`);
        }

      // Prepare environment variables with task data for scripts
      const taskEnv = {
        ...process.env,
        ...task.environment,
        // Pass task data as environment variables
        TASK_ID: task.id,
        TASK_NAME: task.name,
        TASK_DESCRIPTION: task.description || '',
        TASK_COMMAND: task.command,
        TASK_SCHEDULE: task.schedule,
        TASK_ENABLED: task.enabled.toString(),
        TASK_WORKING_DIRECTORY: task.workingDirectory || process.cwd(),
        TASK_METADATA: JSON.stringify(task.metadata || {}),
        TASK_CREATED_AT: this.safeDateToISOString(task.createdAt),
        TASK_UPDATED_AT: this.safeDateToISOString(task.updatedAt),
        TASK_RUN_COUNT: task.runCount.toString(),
        TASK_SUCCESS_COUNT: task.successCount.toString(),
        TASK_FAILURE_COUNT: task.failureCount.toString(),
        TASK_LAST_RUN: task.lastRun ? this.safeDateToISOString(task.lastRun) : '',
        TASK_NEXT_RUN: task.nextRun ? this.safeDateToISOString(task.nextRun) : ''
      };

      const result = await this.runCommand(command, {
        cwd: task.workingDirectory || process.cwd(),
        env: taskEnv
      });

      // Parse and format the output for better logging
      const formattedOutput = this.formatTaskOutput ? this.formatTaskOutput(result.output, task.name) : result.output;
      
      execution.status = 'completed';
      execution.output = formattedOutput;
      execution.exitCode = result.exitCode;
      execution.endTime = new Date();
      
      task.successCount++;
      
      console.log(`✅ Task completed: ${task.name}`);
      console.log(`📊 Summary: ${formattedOutput}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const formattedError = this.formatTaskError ? this.formatTaskError(errorMessage, task.name) : errorMessage;
      
      execution.status = 'failed';
      execution.output = formattedError;
      execution.endTime = new Date();
      execution.error = formattedError;
      
      task.failureCount++;
      
      console.error(`❌ Task failed: ${task.name}`);
      console.error(`📊 Error summary: ${formattedError}`);
    }

    this.executions.set(execution.id, execution);
    this.tasks.set(task.id, task);
    this.saveTasksToStore();
  }

  private async callIpcHandler(handlerName: string, params: any): Promise<any> {
    // This method calls the IPC handlers directly from the main process
    // Since we're already in the main process, we can call the handlers directly
    
    if (handlerName === 'blog-generate-and-upload') {
      // Import and call the blog generation handler directly
      const { generateAndUploadBlog } = require('../generate-and-upload-blog');
      
      // Set environment variables for the script
      const originalEnv = { ...process.env };
      process.env.GEMINI_API_KEY = params.aiSettings.apiKey;
      process.env.AI_PROVIDER = params.aiSettings.provider;
      process.env.AI_MODEL = params.aiSettings.model;
      process.env.IMAGE_GENERATION_ENABLED = params.aiSettings.imageGenerationEnabled ? 'true' : 'false';
      process.env.IMAGE_PROVIDER = params.aiSettings.imageProvider;
      process.env.IMAGE_QUALITY = params.aiSettings.imageQuality;
      process.env.IMAGE_SIZE = params.aiSettings.imageSize;
      process.env.IMAGE_STYLE = params.aiSettings.imageStyle;
      process.env.IMAGE_ASPECT_RATIO = params.aiSettings.imageAspectRatio;
      process.env.WORDPRESS_URL = params.wordpressSettings.url;
      process.env.WORDPRESS_USERNAME = params.wordpressSettings.username;
      process.env.WORDPRESS_PASSWORD = params.wordpressSettings.password;

      try {
        const result = await generateAndUploadBlog(params);
        
        // Restore original environment
        process.env = originalEnv;
        
        return {
          success: true,
          data: result
        };
      } catch (error) {
        // Restore original environment
        process.env = originalEnv;
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    throw new Error(`Unknown IPC handler: ${handlerName}`);
  }

  private runCommand(command: string, options: any): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      // Ensure a valid working directory and an explicit platform shell
      const requestedCwd = options?.cwd;
      const resolvedCwd = requestedCwd && fs.existsSync(requestedCwd) ? requestedCwd : process.cwd();
      const shell = process.platform === 'win32'
        ? (process.env.ComSpec || 'C\\\Windows\\\System32\\\cmd.exe')
        : '/bin/sh';

      const execOptions = { ...options, cwd: resolvedCwd, shell };

      exec(command, execOptions, (error, stdout, stderr) => {
        const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
        
        if (error) {
          const context = `\nShell: ${shell}\nCWD: ${resolvedCwd}` + (requestedCwd && requestedCwd !== resolvedCwd ? ` (requested: ${requestedCwd})` : '');
          reject(new Error(`Command failed: ${error.message}${context}\n${output}`));
        } else {
          resolve({
            output,
            exitCode: 0
          });
        }
      });
    });
  }

  private formatTaskOutput(output: string, taskName: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] Task: ${taskName}\n${output}`;
  }

  private formatTaskError(error: string, taskName: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ERROR in Task: ${taskName}\n${error}`;
  }

  private safeDateToISOString(date: Date | string | null | undefined): string {
    if (!date || date === null || date === undefined) return '';
    
    try {
      if (date instanceof Date) {
        return date.toISOString();
      } else if (typeof date === 'string') {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date string:', date);
          return '';
        }
        return parsedDate.toISOString();
      } else {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          console.warn('Invalid date value:', date);
          return '';
        }
        return parsedDate.toISOString();
      }
    } catch (error) {
      console.error('Error converting date to ISO string:', error, 'Value:', date);
      return ''; // Return empty string instead of current time for null/undefined values
    }
  }


  public cleanup(): void {
    this.destroy();
  }

  public destroy(): void {
    // Stop all scheduled tasks
    this.scheduledJobs.forEach((job, taskId) => {
      this.unscheduleTask(taskId);
    });

    console.log('🛑 Scheduler manager destroyed');
  }
}

export function createSchedulerManager(store: any): SchedulerManager {
  return new SchedulerManager(store);
}

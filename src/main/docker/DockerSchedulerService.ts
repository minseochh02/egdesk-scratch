/**
 * Docker Scheduler Service
 * 
 * This service handles the scheduling and execution of Docker container tasks
 * using node-schedule for cron-like scheduling.
 */

import * as schedule from 'node-schedule';
import { getSQLiteManager } from '../sqlite/manager';
import { dockerService } from './DockerService';
import {
  DockerScheduledTask,
  CreateDockerTaskExecutionData,
} from '../sqlite/docker-scheduler';

export class DockerSchedulerService {
  private static instance: DockerSchedulerService | null = null;
  
  private sqliteManager = getSQLiteManager();
  private isRunning = false;
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  private executionInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DockerSchedulerService {
    if (!DockerSchedulerService.instance) {
      DockerSchedulerService.instance = new DockerSchedulerService();
    }
    return DockerSchedulerService.instance;
  }

  /**
   * Start the Docker scheduler service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🐳 Docker scheduler service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🐳 Starting Docker scheduler service...');

    // Check Docker connection first
    const connectionResult = await dockerService.checkConnection();
    if (!connectionResult.connected) {
      console.warn('⚠️ Docker is not connected. Scheduler will start but tasks may fail.');
      console.warn(`   Connection error: ${connectionResult.error}`);
    } else {
      console.log('✅ Docker connection verified');
    }

    // Schedule all enabled tasks
    await this.scheduleAllTasks();

    // Set up periodic check for new/updated tasks (every minute)
    this.executionInterval = setInterval(async () => {
      try {
        await this.checkAndUpdateSchedules();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error in Docker scheduler periodic check: ${errorMessage}`);
      }
    }, 60000);

    console.log('✅ Docker scheduler service started');
  }

  /**
   * Stop the Docker scheduler service
   */
  public stop(): void {
    console.log(`🛑 Stopping Docker scheduler (${this.scheduledJobs.size} jobs)...`);

    // Cancel all scheduled jobs
    for (const [taskId, job] of this.scheduledJobs) {
      job.cancel();
      console.log(`   Cancelled job for task: ${taskId}`);
    }
    this.scheduledJobs.clear();

    // Clear the interval
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    this.isRunning = false;
    console.log('✅ Docker scheduler service stopped');
  }

  /**
   * Restart the scheduler (useful after task updates)
   */
  public async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * Check if the scheduler is running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the number of scheduled jobs
   */
  public getScheduledJobCount(): number {
    return this.scheduledJobs.size;
  }

  // ============================================
  // Scheduling Methods
  // ============================================

  /**
   * Schedule all enabled tasks
   */
  private async scheduleAllTasks(): Promise<void> {
    try {
      const dockerSchedulerManager = this.sqliteManager.getDockerSchedulerManager();
      const enabledTasks = dockerSchedulerManager.getEnabledTasks();

      console.log(`📅 Scheduling ${enabledTasks.length} enabled Docker tasks...`);

      for (const task of enabledTasks) {
        await this.scheduleTask(task);
      }

      console.log(`✅ Scheduled ${this.scheduledJobs.size} Docker tasks`);
    } catch (error) {
      console.error('❌ Error scheduling Docker tasks:', error);
    }
  }

  /**
   * Schedule a single task
   */
  private async scheduleTask(task: DockerScheduledTask): Promise<void> {
    try {
      // Cancel existing job if exists
      if (this.scheduledJobs.has(task.id)) {
        this.scheduledJobs.get(task.id)?.cancel();
        this.scheduledJobs.delete(task.id);
      }

      // Create schedule rule
      const scheduleRule = this.createScheduleRule(task);
      if (!scheduleRule) {
        console.warn(`⚠️ Invalid schedule for task: ${task.name}`);
        return;
      }

      // Schedule the job
      const job = schedule.scheduleJob(scheduleRule, async () => {
        console.log(`🐳 Executing Docker task: ${task.name}`);
        await this.executeTask(task.id);
      });

      if (job) {
        this.scheduledJobs.set(task.id, job);
        
        // Update next run time in database
        const nextInvocation = job.nextInvocation();
        if (nextInvocation) {
          const dockerSchedulerManager = this.sqliteManager.getDockerSchedulerManager();
          dockerSchedulerManager.updateNextRun(task.id, nextInvocation.toDate());
        }

        console.log(`✅ Scheduled task "${task.name}" - Next run: ${nextInvocation?.toDate().toISOString() || 'unknown'}`);
      } else {
        console.warn(`❌ Failed to schedule task "${task.name}"`);
      }
    } catch (error) {
      console.error(`❌ Error scheduling task "${task.name}":`, error);
    }
  }

  /**
   * Create a schedule rule based on task configuration
   */
  private createScheduleRule(task: DockerScheduledTask): schedule.RecurrenceRule | Date | string | null {
    const [hours, minutes] = task.scheduledTime.split(':').map(Number);

    switch (task.scheduleType) {
      case 'once': {
        // For one-time tasks, return a Date object
        if (task.scheduledDate) {
          const runDate = new Date(`${task.scheduledDate}T${task.scheduledTime}:00`);
          if (runDate > new Date()) {
            return runDate;
          }
          console.log(`⚠️ One-time task "${task.name}" is in the past, skipping`);
          return null;
        }
        return null;
      }

      case 'daily': {
        const rule = new schedule.RecurrenceRule();
        rule.hour = hours;
        rule.minute = minutes;
        rule.second = 0;
        return rule;
      }

      case 'weekly': {
        if (task.dayOfWeek !== undefined) {
          const rule = new schedule.RecurrenceRule();
          rule.dayOfWeek = task.dayOfWeek;
          rule.hour = hours;
          rule.minute = minutes;
          rule.second = 0;
          return rule;
        }
        return null;
      }

      case 'monthly': {
        if (task.dayOfMonth !== undefined) {
          const rule = new schedule.RecurrenceRule();
          rule.date = task.dayOfMonth;
          rule.hour = hours;
          rule.minute = minutes;
          rule.second = 0;
          return rule;
        }
        return null;
      }

      case 'custom': {
        // For custom interval, we use a daily check and track internally
        // The actual interval check happens in shouldExecuteCustomTask
        const rule = new schedule.RecurrenceRule();
        rule.hour = hours;
        rule.minute = minutes;
        rule.second = 0;
        return rule;
      }

      case 'cron': {
        // Direct cron expression
        return task.cronExpression || null;
      }

      default:
        console.warn(`⚠️ Unknown schedule type: ${task.scheduleType}`);
        return null;
    }
  }

  /**
   * Check if a custom interval task should execute
   */
  private shouldExecuteCustomTask(task: DockerScheduledTask): boolean {
    if (task.scheduleType !== 'custom' || !task.customIntervalDays) {
      return true; // Not a custom task, always execute
    }

    if (!task.lastRun) {
      return true; // Never run before, should execute
    }

    const lastRun = new Date(task.lastRun);
    const now = new Date();
    const daysSinceLastRun = Math.floor(
      (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastRun >= task.customIntervalDays;
  }

  /**
   * Check for schedule updates
   */
  private async checkAndUpdateSchedules(): Promise<void> {
    // This could be enhanced to detect changes in tasks
    // For now, we just log that we're checking
    if (process.env.DEBUG_DOCKER_SCHEDULER === 'true') {
      console.log('🔍 Checking Docker scheduler for updates...');
    }
  }

  // ============================================
  // Execution Methods
  // ============================================

  /**
   * Execute a task by ID (can be called manually or by scheduler)
   */
  public async executeTask(taskId: string): Promise<{
    success: boolean;
    error?: string;
    containerId?: string;
  }> {
    const startTime = new Date();
    const dockerSchedulerManager = this.sqliteManager.getDockerSchedulerManager();
    
    // Get fresh task data
    const task = dockerSchedulerManager.getTask(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Check custom interval
    if (!this.shouldExecuteCustomTask(task)) {
      console.log(`⏳ Skipping custom task "${task.name}" - interval not yet reached`);
      return { success: true }; // Not an error, just not time yet
    }

    console.log(`\n🐳 ===== EXECUTING DOCKER TASK =====`);
    console.log(`📝 Task: ${task.name}`);
    console.log(`🔧 Type: ${task.taskType}`);
    console.log(`🕐 Started at: ${startTime.toISOString()}`);

    // Create execution record
    const executionData: CreateDockerTaskExecutionData = {
      taskId: task.id,
      status: 'running',
      startedAt: startTime,
    };
    const execution = dockerSchedulerManager.createExecution(executionData);

    let containerId: string | undefined;
    let executionOutput = '';
    let errorMessage: string | undefined;
    let success = false;

    try {
      // Check Docker connection
      const connectionResult = await dockerService.checkConnection();
      if (!connectionResult.connected) {
        throw new Error(`Docker not connected: ${connectionResult.error}`);
      }

      // Execute based on task type
      switch (task.taskType) {
        case 'start_container': {
          const targetId = task.containerId || task.containerName;
          if (!targetId) {
            throw new Error('No container ID or name specified');
          }
          console.log(`▶ Starting container: ${targetId}`);
          const result = await dockerService.startContainer(targetId);
          if (!result.success) {
            throw new Error(result.error || 'Failed to start container');
          }
          executionOutput = `Container ${targetId} started successfully`;
          success = true;
          break;
        }

        case 'stop_container': {
          const targetId = task.containerId || task.containerName;
          if (!targetId) {
            throw new Error('No container ID or name specified');
          }
          console.log(`⏹ Stopping container: ${targetId}`);
          const result = await dockerService.stopContainer(targetId);
          if (!result.success) {
            throw new Error(result.error || 'Failed to stop container');
          }
          executionOutput = `Container ${targetId} stopped successfully`;
          success = true;
          break;
        }

        case 'restart_container': {
          const targetId = task.containerId || task.containerName;
          if (!targetId) {
            throw new Error('No container ID or name specified');
          }
          console.log(`🔄 Restarting container: ${targetId}`);
          const result = await dockerService.restartContainer(targetId);
          if (!result.success) {
            throw new Error(result.error || 'Failed to restart container');
          }
          executionOutput = `Container ${targetId} restarted successfully`;
          success = true;
          break;
        }

        case 'run_image': {
          if (!task.imageName) {
            throw new Error('No image name specified');
          }
          console.log(`🚀 Running image: ${task.imageName}`);
          const result = await this.runImageAsContainer(task);
          if (!result.success) {
            throw new Error(result.error || 'Failed to run image');
          }
          containerId = result.containerId;
          executionOutput = `Container ${containerId} created and started from image ${task.imageName}`;
          success = true;
          break;
        }

        default:
          throw new Error(`Unknown task type: ${task.taskType}`);
      }

      console.log(`✅ Task completed successfully`);
      console.log(`📄 Output: ${executionOutput}`);

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Task failed: ${errorMessage}`);
      success = false;
    }

    // Update execution record
    const completedAt = new Date();
    const duration = completedAt.getTime() - startTime.getTime();

    dockerSchedulerManager.updateExecution(execution.id, {
      taskId: task.id,
      status: success ? 'success' : 'failure',
      startedAt: startTime,
      completedAt,
      duration,
      errorMessage,
      containerId,
      executionOutput,
    });

    // Update task statistics
    dockerSchedulerManager.updateTaskStats(task.id, success);

    // Calculate and update next run time
    if (this.scheduledJobs.has(task.id)) {
      const job = this.scheduledJobs.get(task.id)!;
      const nextInvocation = job.nextInvocation();
      if (nextInvocation) {
        dockerSchedulerManager.updateNextRun(task.id, nextInvocation.toDate());
        console.log(`⏰ Next run: ${nextInvocation.toDate().toISOString()}`);
      }
    }

    console.log(`🕐 Completed at: ${completedAt.toISOString()}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`===== END DOCKER TASK =====\n`);

    return { success, error: errorMessage, containerId };
  }

  /**
   * Run an image as a new container
   */
  private async runImageAsContainer(task: DockerScheduledTask): Promise<{
    success: boolean;
    containerId?: string;
    error?: string;
  }> {
    if (!task.imageName) {
      return { success: false, error: 'No image name specified' };
    }

    const options = task.createOptions || {};

    // Build Docker container create options
    const createOptions: any = {
      Image: task.imageName,
      name: options.containerName,
      Cmd: options.command,
      Env: options.envVars
        ? Object.entries(options.envVars).map(([k, v]) => `${k}=${v}`)
        : undefined,
      HostConfig: {
        RestartPolicy: options.restartPolicy
          ? { Name: options.restartPolicy }
          : undefined,
        Binds: options.volumes
          ? options.volumes.map((v) => `${v.hostPath}:${v.containerPath}`)
          : undefined,
        NetworkMode: options.network,
      },
    };

    // Port bindings
    if (options.hostPort && options.containerPort) {
      createOptions.ExposedPorts = {
        [`${options.containerPort}/tcp`]: {},
      };
      createOptions.HostConfig.PortBindings = {
        [`${options.containerPort}/tcp`]: [{ HostPort: options.hostPort }],
      };
    }

    // Create container
    console.log(`📦 Creating container from image: ${task.imageName}`);
    const createResult = await dockerService.createContainer(createOptions);
    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    // Start container
    console.log(`▶ Starting container: ${createResult.containerId}`);
    const startResult = await dockerService.startContainer(createResult.containerId!);
    if (!startResult.success) {
      // Try to clean up the created container
      await dockerService.removeContainer(createResult.containerId!, { force: true });
      return { success: false, error: `Container created but failed to start: ${startResult.error}` };
    }

    return { success: true, containerId: createResult.containerId };
  }

  // ============================================
  // Task Management (for scheduler updates)
  // ============================================

  /**
   * Add or update a task in the scheduler
   */
  public async scheduleTaskById(taskId: string): Promise<void> {
    const dockerSchedulerManager = this.sqliteManager.getDockerSchedulerManager();
    const task = dockerSchedulerManager.getTask(taskId);
    
    if (task && task.enabled) {
      await this.scheduleTask(task);
    } else if (this.scheduledJobs.has(taskId)) {
      // Task disabled or deleted, remove from scheduler
      this.scheduledJobs.get(taskId)?.cancel();
      this.scheduledJobs.delete(taskId);
      console.log(`🗑 Removed task from scheduler: ${taskId}`);
    }
  }

  /**
   * Remove a task from the scheduler
   */
  public unscheduleTask(taskId: string): void {
    if (this.scheduledJobs.has(taskId)) {
      this.scheduledJobs.get(taskId)?.cancel();
      this.scheduledJobs.delete(taskId);
      console.log(`🗑 Unscheduled task: ${taskId}`);
    }
  }
}

// Export singleton instance getter
export const getDockerSchedulerService = (): DockerSchedulerService => 
  DockerSchedulerService.getInstance();


import { spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  command: string;
  schedule: string; // cron expression or interval
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
  workingDirectory?: string;
  environment?: Record<string, string>;
  outputFile?: string;
  errorFile?: string;
  metadata?: Record<string, any>; // For storing task-specific data like topics, WordPress settings, etc.
}

export interface TaskExecution {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode?: number;
  output?: string;
  error?: string;
  pid?: number;
}

export class SchedulerManager {
  private tasks: Map<string, ScheduledTask> = new Map();

  private executions: Map<string, TaskExecution> = new Map();

  private runningTasks: Map<string, any> = new Map(); // PID to process mapping

  private intervalId?: NodeJS.Timeout;

  private cronJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadTasks();
    this.startScheduler();
  }

  private loadTasks() {
    try {
      const tasksPath = path.join(
        os.homedir(),
        '.egdesk-scheduler',
        'tasks.json',
      );
      if (fs.existsSync(tasksPath)) {
        const data = fs.readFileSync(tasksPath, 'utf8');
        const tasks: ScheduledTask[] = JSON.parse(data);
        tasks.forEach((task) => {
          this.tasks.set(task.id, {
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            lastRun: task.lastRun ? new Date(task.lastRun) : undefined,
            nextRun: task.nextRun ? new Date(task.nextRun) : undefined,
          });
        });
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private saveTasks() {
    try {
      const tasksDir = path.join(os.homedir(), '.egdesk-scheduler');
      if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
      }

      const tasksPath = path.join(tasksDir, 'tasks.json');
      const tasks = Array.from(this.tasks.values());
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  private startScheduler() {
    // Check for tasks every minute
    this.intervalId = setInterval(() => {
      this.checkScheduledTasks();
    }, 60000);

    // Check immediately on startup
    this.checkScheduledTasks();
  }

  private checkScheduledTasks() {
    const now = new Date();

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) continue;

      if (this.shouldRunTask(task, now)) {
        this.executeTask(task);
      }
    }
  }

  private shouldRunTask(task: ScheduledTask, now: Date): boolean {
    if (task.schedule.startsWith('interval:')) {
      // Handle interval-based tasks (e.g., "interval:300000" for 5 minutes)
      const interval = parseInt(task.schedule.replace('interval:', ''));
      if (!task.lastRun) return true;

      const timeSinceLastRun = now.getTime() - task.lastRun.getTime();
      return timeSinceLastRun >= interval;
    }
    if (task.schedule.startsWith('cron:')) {
      // Handle cron expressions (simplified implementation)
      const cronExpression = task.schedule.replace('cron:', '');
      return this.evaluateCronExpression(cronExpression, now);
    }

    return false;
  }

  private evaluateCronExpression(cronExpression: string, now: Date): boolean {
    // Simplified cron evaluation - in a real implementation, you'd use a proper cron library
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour, day, month, weekday] = parts;

    // Check if current time matches cron expression
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentWeekday = now.getDay();

    return (
      this.matchesCronField(minute, currentMinute) &&
      this.matchesCronField(hour, currentHour) &&
      this.matchesCronField(day, currentDay) &&
      this.matchesCronField(month, currentMonth) &&
      this.matchesCronField(weekday, currentWeekday)
    );
  }

  private matchesCronField(field: string, value: number): boolean {
    if (field === '*') return true;
    if (field.includes(',')) {
      return field.split(',').map(Number).includes(value);
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return value >= start && value <= end;
    }
    if (field.includes('/')) {
      const [base, step] = field.split('/').map(Number);
      return value % step === 0;
    }
    return parseInt(field) === value;
  }

  private async executeTask(task: ScheduledTask) {
    const executionId = `${task.id}-${Date.now()}`;
    const execution: TaskExecution = {
      id: executionId,
      taskId: task.id,
      startTime: new Date(),
      status: 'running',
    };

    this.executions.set(executionId, execution);

    try {
      // Update task's last run time
      task.lastRun = new Date();
      task.updatedAt = new Date();
      this.tasks.set(task.id, task);
      this.saveTasks();

      // Prepare command and environment
      const { command } = task;
      // Use app directory as default working directory for better script resolution
      const appDir = process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, '..', '..') // Development: go up two levels from dist/main to project root
        : process.resourcesPath; // Production: use resources path
      const workingDir = task.workingDirectory || appDir;
      const env = { ...process.env, ...task.environment };

      // Execute the command
      const childProcess = spawn(command, [], {
        cwd: workingDir,
        env,
        shell: true,
        detached: false,
      });

      execution.pid = childProcess.pid;
      this.runningTasks.set(task.id, childProcess);

      // Handle output
      let output = '';
      let error = '';

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        error += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        execution.endTime = new Date();
        execution.status = code === 0 ? 'completed' : 'failed';
        execution.exitCode = code || 0;
        execution.output = output;
        execution.error = error;

        // Add debugging information
        if (code !== 0) {
          console.error(`Task ${task.name} failed with exit code ${code}`);
          console.error(`Output: ${output}`);
          console.error(`Error: ${error}`);
        }

        this.executions.set(executionId, execution);
        this.runningTasks.delete(task.id);

        // Save output to files if specified
        if (task.outputFile && output) {
          fs.writeFileSync(task.outputFile, output);
        }
        if (task.errorFile && error) {
          fs.writeFileSync(task.errorFile, error);
        }

        // Update task's next run time
        this.updateNextRunTime(task);
      });

      childProcess.on('error', (err) => {
        execution.endTime = new Date();
        execution.status = 'failed';
        execution.error = `Process error: ${err.message}\nStack: ${err.stack || 'No stack trace available'}`;
        this.executions.set(executionId, execution);
        this.runningTasks.delete(task.id);
        console.error(`Task ${task.name} failed with error:`, err);
      });
    } catch (error) {
      execution.endTime = new Date();
      execution.status = 'failed';
      execution.error = error instanceof Error 
        ? `Execution error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`
        : `Unknown error: ${String(error)}`;
      this.executions.set(executionId, execution);
      console.error(`Task ${task.name} execution failed:`, error);
    }
  }

  private updateNextRunTime(task: ScheduledTask) {
    if (task.schedule.startsWith('interval:')) {
      const interval = parseInt(task.schedule.replace('interval:', ''));
      task.nextRun = new Date(Date.now() + interval);
    } else if (task.schedule.startsWith('cron:')) {
      // For cron jobs, calculate next run time (simplified)
      task.nextRun = new Date(Date.now() + 60000); // Next minute
    }

    task.updatedAt = new Date();
    this.tasks.set(task.id, task);
    this.saveTasks();
  }

  // Public API methods
  public createTask(
    taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): ScheduledTask {
    const task: ScheduledTask = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(task.id, task);
    this.saveTasks();
    return task;
  }

  public updateTask(
    taskId: string,
    updates: Partial<ScheduledTask>,
  ): ScheduledTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask = {
      ...task,
      ...updates,
      id: taskId, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, updatedTask);
    this.saveTasks();
    return updatedTask;
  }

  public deleteTask(taskId: string): boolean {
    // Cancel running task if exists
    const runningProcess = this.runningTasks.get(taskId);
    if (runningProcess) {
      runningProcess.kill();
      this.runningTasks.delete(taskId);
    }

    // Remove cron job if exists
    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      clearTimeout(cronJob);
      this.cronJobs.delete(taskId);
    }

    // Remove task from memory
    const deleted = this.tasks.delete(taskId);
    
    // Save tasks to persist the deletion
    if (deleted) {
      this.saveTasks();
    }
    
    return deleted;
  }

  public getTask(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  public getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  public getTaskExecutions(taskId?: string): TaskExecution[] {
    const executions = Array.from(this.executions.values());
    if (taskId) {
      return executions.filter((exec) => exec.taskId === taskId);
    }
    return executions;
  }

  public runTaskNow(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.executeTask(task);
    return true;
  }

  public stopTask(taskId: string): boolean {
    const runningProcess = this.runningTasks.get(taskId);
    if (!runningProcess) return false;

    runningProcess.kill();
    this.runningTasks.delete(taskId);
    return true;
  }

  public getTaskMetadata(taskId: string): Record<string, any> | null {
    const task = this.tasks.get(taskId);
    return task?.metadata || null;
  }

  public getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      totalTasks: this.tasks.size,
      runningTasks: this.runningTasks.size,
      totalExecutions: this.executions.size,
    };
  }

  public cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Kill all running tasks
    for (const [taskId, process] of this.runningTasks.entries()) {
      process.kill();
    }
    this.runningTasks.clear();

    // Clear all cron jobs
    for (const cronJob of this.cronJobs.values()) {
      clearTimeout(cronJob);
    }
    this.cronJobs.clear();
  }
}

// Export singleton instance
export const schedulerManager = new SchedulerManager();

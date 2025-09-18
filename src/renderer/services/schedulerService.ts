import { ScheduledTask, TaskExecution } from '../../main/preload';

export interface CreateTaskData {
  name: string;
  description?: string;
  command: string;
  schedule: string;
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

export interface SchedulerServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class SchedulerService {
  private static instance: SchedulerService;

  private tasks: ScheduledTask[] = [];

  private executions: TaskExecution[] = [];

  private systemInfo: any = null;

  private constructor() {
    this.loadTasks();
    this.loadExecutions();
    this.loadSystemInfo();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  private async loadTasks(): Promise<void> {
    try {
      const response = await window.electron.scheduler.getAllTasks();
      if (response.success && response.tasks) {
        this.tasks = response.tasks;
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private async loadExecutions(): Promise<void> {
    try {
      const response = await window.electron.scheduler.getExecutions();
      if (response.success && response.executions) {
        this.executions = response.executions;
      }
    } catch (error) {
      console.error('Error loading executions:', error);
    }
  }

  private async loadSystemInfo(): Promise<void> {
    try {
      const response = await window.electron.scheduler.getSystemInfo();
      if (response.success && response.systemInfo) {
        this.systemInfo = response.systemInfo;
      }
    } catch (error) {
      console.error('Error loading system info:', error);
    }
  }

  public async createTask(
    taskData: CreateTaskData,
  ): Promise<SchedulerServiceResponse<ScheduledTask>> {
    try {
      const response = await window.electron.scheduler.createTask({
        ...taskData,
        enabled: taskData.enabled ?? true,
      });

      if (response.success && response.task) {
        this.tasks.push(response.task);
        return { success: true, data: response.task };
      }
      return {
        success: false,
        error: response.error || 'Failed to create task',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async updateTask(
    taskId: string,
    updates: UpdateTaskData,
  ): Promise<SchedulerServiceResponse<ScheduledTask>> {
    try {
      const response = await window.electron.scheduler.updateTask(
        taskId,
        updates,
      );

      if (response.success && response.task) {
        const index = this.tasks.findIndex((task) => task.id === taskId);
        if (index !== -1) {
          this.tasks[index] = response.task;
        }
        return { success: true, data: response.task };
      }
      return {
        success: false,
        error: response.error || 'Failed to update task',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async deleteTask(
    taskId: string,
  ): Promise<SchedulerServiceResponse<boolean>> {
    try {
      const response = await window.electron.scheduler.deleteTask(taskId);

      if (response.success) {
        this.tasks = this.tasks.filter((task) => task.id !== taskId);
        this.executions = this.executions.filter(
          (exec) => exec.taskId !== taskId,
        );
        return { success: true, data: true };
      }
      return {
        success: false,
        error: response.error || 'Failed to delete task',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getTask(
    taskId: string,
  ): Promise<SchedulerServiceResponse<ScheduledTask>> {
    try {
      const response = await window.electron.scheduler.getTask(taskId);

      if (response.success && response.task) {
        return { success: true, data: response.task };
      }
      return { success: false, error: response.error || 'Task not found' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getAllTasks(): Promise<
    SchedulerServiceResponse<ScheduledTask[]>
  > {
    try {
      await this.loadTasks();
      return { success: true, data: this.tasks };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getExecutions(
    taskId?: string,
  ): Promise<SchedulerServiceResponse<TaskExecution[]>> {
    try {
      await this.loadExecutions();
      const filteredExecutions = taskId
        ? this.executions.filter((exec) => exec.taskId === taskId)
        : this.executions;
      return { success: true, data: filteredExecutions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async runTaskNow(
    taskId: string,
  ): Promise<SchedulerServiceResponse<boolean>> {
    try {
      const response = await window.electron.scheduler.runTaskNow(taskId);
      return { success: response.success, error: response.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async stopTask(
    taskId: string,
  ): Promise<SchedulerServiceResponse<boolean>> {
    try {
      const response = await window.electron.scheduler.stopTask(taskId);
      return { success: response.success, error: response.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getSystemInfo(): Promise<SchedulerServiceResponse<any>> {
    try {
      await this.loadSystemInfo();
      return { success: true, data: this.systemInfo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public getTasks(): ScheduledTask[] {
    return this.tasks;
  }

  public getExecutionsForTask(taskId: string): TaskExecution[] {
    return this.executions.filter((exec) => exec.taskId === taskId);
  }

  public getRunningTasks(): ScheduledTask[] {
    return this.tasks.filter((task) => {
      const executions = this.getExecutionsForTask(task.id);
      return executions.some((exec) => exec.status === 'running');
    });
  }

  public getEnabledTasks(): ScheduledTask[] {
    return this.tasks.filter((task) => task.enabled);
  }

  public getDisabledTasks(): ScheduledTask[] {
    return this.tasks.filter((task) => !task.enabled);
  }

  public getTasksBySchedule(schedule: string): ScheduledTask[] {
    return this.tasks.filter((task) => task.schedule === schedule);
  }

  public getRecentExecutions(limit: number = 10): TaskExecution[] {
    return this.executions
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      )
      .slice(0, limit);
  }

  public getFailedExecutions(): TaskExecution[] {
    return this.executions.filter((exec) => exec.status === 'failed');
  }

  public getCompletedExecutions(): TaskExecution[] {
    return this.executions.filter((exec) => exec.status === 'completed');
  }

  public getRunningExecutions(): TaskExecution[] {
    return this.executions.filter((exec) => exec.status === 'running');
  }

  // Utility methods for schedule validation
  public validateSchedule(schedule: string): {
    valid: boolean;
    error?: string;
  } {
    if (!schedule || schedule.trim() === '') {
      return { valid: false, error: 'Schedule cannot be empty' };
    }

    if (schedule.startsWith('interval:')) {
      const interval = parseInt(schedule.replace('interval:', ''));
      if (isNaN(interval) || interval <= 0) {
        return {
          valid: false,
          error: 'Invalid interval. Must be a positive number in milliseconds.',
        };
      }
      return { valid: true };
    }

    if (schedule.startsWith('cron:')) {
      const cronExpression = schedule.replace('cron:', '');
      const parts = cronExpression.split(' ');
      if (parts.length !== 5) {
        return {
          valid: false,
          error:
            'Invalid cron expression. Must have 5 parts: minute hour day month weekday',
        };
      }
      return { valid: true };
    }

    if (schedule.startsWith('date:')) {
      const dateString = schedule.replace('date:', '');
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return {
          valid: false,
          error: 'Invalid date format. Use ISO date string.',
        };
      }
      if (date <= new Date()) {
        return {
          valid: false,
          error: 'Date must be in the future.',
        };
      }
      return { valid: true };
    }

    if (schedule.startsWith('weekly:')) {
      const parts = schedule.replace('weekly:', '').split(':');
      if (parts.length !== 3) {
        return {
          valid: false,
          error: 'Invalid weekly format. Use "weekly:day:hour:minute"',
        };
      }
      const [day, hour, minute] = parts.map(p => parseInt(p));
      if (day < 0 || day > 6 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return {
          valid: false,
          error: 'Invalid weekly values. Day: 0-6, Hour: 0-23, Minute: 0-59',
        };
      }
      return { valid: true };
    }

    if (schedule.startsWith('monthly:')) {
      const parts = schedule.replace('monthly:', '').split(':');
      if (parts.length !== 3) {
        return {
          valid: false,
          error: 'Invalid monthly format. Use "monthly:day:hour:minute"',
        };
      }
      const [day, hour, minute] = parts.map(p => parseInt(p));
      if (day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return {
          valid: false,
          error: 'Invalid monthly values. Day: 1-31, Hour: 0-23, Minute: 0-59',
        };
      }
      return { valid: true };
    }

    return {
      valid: false,
      error: 'Invalid schedule format. Use "interval:ms", "cron:expression", "date:ISO", "weekly:day:hour:minute", or "monthly:day:hour:minute"',
    };
  }

  public formatSchedule(schedule: string): string {
    if (schedule.startsWith('interval:')) {
      const interval = parseInt(schedule.replace('interval:', ''));
      const seconds = Math.floor(interval / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days} day(s)`;
      if (hours > 0) return `${hours} hour(s)`;
      if (minutes > 0) return `${minutes} minute(s)`;
      return `${seconds} second(s)`;
    }

    if (schedule.startsWith('cron:')) {
      return `Cron: ${schedule.replace('cron:', '')}`;
    }

    if (schedule.startsWith('date:')) {
      const dateString = schedule.replace('date:', '');
      const date = new Date(dateString);
      return `특정 날짜: ${date.toLocaleString('ko-KR')}`;
    }

    if (schedule.startsWith('weekly:')) {
      const parts = schedule.replace('weekly:', '').split(':');
      const [day, hour, minute] = parts.map(p => parseInt(p));
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      return `매주 ${dayNames[day]}요일 ${timeStr}`;
    }

    if (schedule.startsWith('monthly:')) {
      const parts = schedule.replace('monthly:', '').split(':');
      const [day, hour, minute] = parts.map(p => parseInt(p));
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      return `매월 ${day}일 ${timeStr}`;
    }

    return schedule;
  }

  public getNextRunTime(task: ScheduledTask): Date | null {
    if (!task.enabled) return null;

    if (task.schedule.startsWith('interval:')) {
      const interval = parseInt(task.schedule.replace('interval:', ''));
      const lastRun = task.lastRun || task.createdAt;
      return new Date(lastRun.getTime() + interval);
    }

    if (task.schedule.startsWith('cron:')) {
      // Simplified next run calculation for cron
      return new Date(Date.now() + 60000); // Next minute
    }

    return null;
  }

  public isTaskRunning(taskId: string): boolean {
    const executions = this.getExecutionsForTask(taskId);
    return executions.some((exec) => exec.status === 'running');
  }

  public refreshData(): Promise<void> {
    return Promise.all([
      this.loadTasks(),
      this.loadExecutions(),
      this.loadSystemInfo(),
    ]).then(() => {});
  }
}

export default SchedulerService;

# Docker Container Scheduler Plan

## Overview

This document outlines the design for a scheduler that can start/stop Docker containers at specified scheduled times. The implementation follows the same patterns as the existing SNS plan scheduler used for blog post automation.

## Reference: Existing SNS Scheduler Architecture

### Library Used
- **`node-schedule`**: npm package for cron-like job scheduling in Node.js
- **`better-sqlite3`**: SQLite database for persistent storage

### Key Patterns from SNS Scheduler
```typescript
import * as schedule from 'node-schedule';

// Job map to track scheduled jobs
private scheduledJobs: Map<string, schedule.Job> = new Map();

// Schedule using cron expressions
const job = schedule.scheduleJob(cronExpression, async () => {
  await this.executeTask(taskId);
});
```

### Cron Expression Generation
```typescript
// Daily at HH:MM
`${minutes} ${hours} * * *`

// Weekly on specific day at HH:MM
`${minutes} ${hours} * * ${dayOfWeek}`

// Monthly on specific day at HH:MM
`${minutes} ${hours} ${dayOfMonth} * *`
```

---

## Docker Scheduler Design

### 1. Data Schema (SQLite)

#### `docker_scheduled_tasks` Table
```sql
CREATE TABLE IF NOT EXISTS docker_scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('start_container', 'stop_container', 'restart_container', 'run_image')),
  
  -- Target identification
  container_id TEXT,           -- For existing containers
  container_name TEXT,         -- For existing containers
  image_name TEXT,             -- For run_image task type
  
  -- Container creation options (for run_image)
  create_options_json TEXT,    -- JSON: { hostPort, containerPort, envVars, volumes, etc. }
  
  -- Scheduling configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'custom', 'cron')),
  scheduled_time TEXT NOT NULL,        -- HH:MM format
  scheduled_date TEXT,                 -- For 'once' type: YYYY-MM-DD
  day_of_week INTEGER,                 -- 0-6 (Sunday-Saturday) for 'weekly'
  day_of_month INTEGER,                -- 1-31 for 'monthly'
  custom_interval_days INTEGER,        -- For 'custom' type
  cron_expression TEXT,                -- For 'cron' type: raw cron string
  
  -- Status & tracking
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### `docker_task_executions` Table
```sql
CREATE TABLE IF NOT EXISTS docker_task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failure', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration INTEGER,            -- milliseconds
  error_message TEXT,
  
  -- Execution context
  container_id TEXT,           -- Resulting container ID
  execution_output TEXT,       -- Log/output from execution
  
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES docker_scheduled_tasks(id) ON DELETE CASCADE
);
```

---

### 2. TypeScript Interfaces

```typescript
// egdesk-scratch/src/main/sqlite/docker-scheduler.ts

export interface DockerScheduledTask {
  id: string;
  name: string;
  taskType: 'start_container' | 'stop_container' | 'restart_container' | 'run_image';
  
  // Target identification
  containerId?: string;
  containerName?: string;
  imageName?: string;
  
  // Container creation options (for run_image)
  createOptions?: DockerContainerCreateOptions;
  
  // Scheduling configuration
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' | 'cron';
  scheduledTime: string;        // HH:MM
  scheduledDate?: string;       // For 'once' type
  dayOfWeek?: number;           // 0-6
  dayOfMonth?: number;          // 1-31
  customIntervalDays?: number;
  cronExpression?: string;
  
  // Status
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  
  // Metadata
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DockerContainerCreateOptions {
  containerName?: string;
  hostPort?: string;
  containerPort?: string;
  envVars?: Record<string, string>;
  volumes?: Array<{ hostPath: string; containerPath: string }>;
  network?: string;
  restartPolicy?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
  command?: string[];
}

export interface DockerTaskExecution {
  id: string;
  taskId: string;
  status: 'running' | 'success' | 'failure' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  errorMessage?: string;
  containerId?: string;
  executionOutput?: string;
  createdAt: Date;
}

export interface CreateDockerTaskData {
  name: string;
  taskType: DockerScheduledTask['taskType'];
  containerId?: string;
  containerName?: string;
  imageName?: string;
  createOptions?: DockerContainerCreateOptions;
  scheduleType: DockerScheduledTask['scheduleType'];
  scheduledTime: string;
  scheduledDate?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customIntervalDays?: number;
  cronExpression?: string;
  description?: string;
}
```

---

### 3. DockerSchedulerService Class

```typescript
// egdesk-scratch/src/main/docker/DockerSchedulerService.ts

import * as schedule from 'node-schedule';
import { getSQLiteManager } from '../sqlite/manager';
import { dockerService } from './DockerService';

export class DockerSchedulerService {
  private sqliteManager = getSQLiteManager();
  private isRunning = false;
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  private executionInterval: NodeJS.Timeout | null = null;

  /**
   * Start the Docker scheduler service
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🐳 Starting Docker scheduler service...');
    
    // Schedule all enabled tasks
    await this.scheduleAllTasks();
    
    // Periodic check for new/updated tasks (every minute)
    this.executionInterval = setInterval(async () => {
      await this.checkAndUpdateSchedules();
    }, 60000);
  }

  /**
   * Schedule a single task using node-schedule
   */
  private async scheduleTask(task: DockerScheduledTask): Promise<void> {
    // Cancel existing job if exists
    if (this.scheduledJobs.has(task.id)) {
      this.scheduledJobs.get(task.id)?.cancel();
      this.scheduledJobs.delete(task.id);
    }

    const cronExpression = this.createCronExpression(task);
    if (!cronExpression) {
      console.warn(`⚠️ Invalid schedule for task: ${task.name}`);
      return;
    }

    const job = schedule.scheduleJob(cronExpression, async () => {
      console.log(`🐳 Executing Docker task: ${task.name}`);
      await this.executeTask(task);
    });

    if (job) {
      this.scheduledJobs.set(task.id, job);
      console.log(`✅ Scheduled Docker task "${task.name}" with cron: ${cronExpression}`);
    }
  }

  /**
   * Create cron expression based on schedule type
   */
  private createCronExpression(task: DockerScheduledTask): string | null {
    const [hours, minutes] = task.scheduledTime.split(':').map(Number);

    switch (task.scheduleType) {
      case 'once':
        // For one-time tasks, use Date object
        if (task.scheduledDate) {
          const runDate = new Date(`${task.scheduledDate}T${task.scheduledTime}:00`);
          if (runDate > new Date()) {
            return runDate.toISOString(); // node-schedule accepts Date
          }
        }
        return null;
        
      case 'daily':
        return `${minutes} ${hours} * * *`;
        
      case 'weekly':
        if (task.dayOfWeek !== undefined) {
          return `${minutes} ${hours} * * ${task.dayOfWeek}`;
        }
        return null;
        
      case 'monthly':
        if (task.dayOfMonth !== undefined) {
          return `${minutes} ${hours} ${task.dayOfMonth} * *`;
        }
        return null;
        
      case 'custom':
        // Custom interval - run daily and check in execution
        return `${minutes} ${hours} * * *`;
        
      case 'cron':
        return task.cronExpression || null;
        
      default:
        return null;
    }
  }

  /**
   * Execute a Docker scheduled task
   */
  private async executeTask(task: DockerScheduledTask): Promise<void> {
    const startTime = new Date();
    let executionOutput = '';
    let containerId: string | undefined;
    
    try {
      switch (task.taskType) {
        case 'start_container':
          const startResult = await dockerService.startContainer(
            task.containerId || task.containerName!
          );
          if (!startResult.success) throw new Error(startResult.error);
          executionOutput = 'Container started successfully';
          break;
          
        case 'stop_container':
          const stopResult = await dockerService.stopContainer(
            task.containerId || task.containerName!
          );
          if (!stopResult.success) throw new Error(stopResult.error);
          executionOutput = 'Container stopped successfully';
          break;
          
        case 'restart_container':
          const restartResult = await dockerService.restartContainer(
            task.containerId || task.containerName!
          );
          if (!restartResult.success) throw new Error(restartResult.error);
          executionOutput = 'Container restarted successfully';
          break;
          
        case 'run_image':
          const createResult = await this.runImageAsContainer(task);
          if (!createResult.success) throw new Error(createResult.error);
          containerId = createResult.containerId;
          executionOutput = `Container created and started: ${containerId}`;
          break;
      }
      
      // Record success
      await this.recordExecution(task.id, {
        status: 'success',
        startedAt: startTime,
        completedAt: new Date(),
        containerId,
        executionOutput,
      });
      
      // Update stats
      await this.updateTaskStats(task.id, true);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Record failure
      await this.recordExecution(task.id, {
        status: 'failure',
        startedAt: startTime,
        completedAt: new Date(),
        errorMessage,
        executionOutput,
      });
      
      // Update stats
      await this.updateTaskStats(task.id, false);
      
      console.error(`❌ Docker task "${task.name}" failed:`, errorMessage);
    }
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
      Env: options.envVars 
        ? Object.entries(options.envVars).map(([k, v]) => `${k}=${v}`)
        : undefined,
      HostConfig: {
        RestartPolicy: options.restartPolicy 
          ? { Name: options.restartPolicy }
          : undefined,
        Binds: options.volumes
          ? options.volumes.map(v => `${v.hostPath}:${v.containerPath}`)
          : undefined,
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
    const createResult = await dockerService.createContainer(createOptions);
    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    // Start container
    const startResult = await dockerService.startContainer(createResult.containerId!);
    if (!startResult.success) {
      return { success: false, error: startResult.error };
    }

    return { success: true, containerId: createResult.containerId };
  }

  /**
   * Stop the scheduler service
   */
  public stop(): void {
    console.log(`🛑 Stopping Docker scheduler (${this.scheduledJobs.size} jobs)...`);
    
    for (const [taskId, job] of this.scheduledJobs) {
      job.cancel();
    }
    this.scheduledJobs.clear();

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    this.isRunning = false;
    console.log('Docker scheduler service stopped');
  }
}
```

---

### 4. IPC Handlers for Renderer

```typescript
// Add to egdesk-scratch/src/main/docker/DockerService.ts

// === Docker Scheduler IPC Handlers ===

ipcMain.handle('docker:scheduler:get-tasks', async () => {
  return dockerSchedulerManager.getAllTasks();
});

ipcMain.handle('docker:scheduler:create-task', async (_, data: CreateDockerTaskData) => {
  return dockerSchedulerManager.createTask(data);
});

ipcMain.handle('docker:scheduler:update-task', async (_, id: string, updates: Partial<CreateDockerTaskData>) => {
  return dockerSchedulerManager.updateTask(id, updates);
});

ipcMain.handle('docker:scheduler:delete-task', async (_, id: string) => {
  return dockerSchedulerManager.deleteTask(id);
});

ipcMain.handle('docker:scheduler:toggle-task', async (_, id: string, enabled: boolean) => {
  return dockerSchedulerManager.toggleTask(id, enabled);
});

ipcMain.handle('docker:scheduler:run-now', async (_, id: string) => {
  return dockerSchedulerService.executeTaskById(id);
});

ipcMain.handle('docker:scheduler:get-executions', async (_, taskId: string) => {
  return dockerSchedulerManager.getTaskExecutions(taskId);
});
```

---

### 5. UI Components (React)

#### DockerScheduler.tsx - Main Component
```tsx
// egdesk-scratch/src/renderer/components/DockerManager/DockerScheduler.tsx

interface DockerSchedulerProps {
  containers: Container[];
  images: DockerImage[];
}

const DockerScheduler: React.FC<DockerSchedulerProps> = ({ containers, images }) => {
  const [tasks, setTasks] = useState<DockerScheduledTask[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DockerScheduledTask | null>(null);

  // ... task list, create/edit modals, execution history
};
```

#### Task Form Fields
- **Task Type**: Dropdown (Start, Stop, Restart, Run Image)
- **Target**: 
  - For existing containers: Container selector
  - For run_image: Image selector + container options
- **Schedule Type**: Dropdown (Once, Daily, Weekly, Monthly, Custom, Cron)
- **Time**: Time picker (HH:MM)
- **Day Selection**: Based on schedule type
- **Description**: Optional text field

---

### 6. Integration Points

1. **DockerService Integration**
   - Uses existing Docker methods: `startContainer`, `stopContainer`, `restartContainer`, `createContainer`
   
2. **SQLite Manager Integration**
   - Add `DockerSchedulerManager` to SQLite manager singleton
   - Create tables on app initialization

3. **App Lifecycle**
   - Start scheduler in `main/index.ts` after app ready
   - Stop scheduler on app quit

4. **IPC Bridge**
   - Expose scheduler methods via Electron IPC
   - Add type definitions to `preload.ts`

---

### 7. File Structure

```
egdesk-scratch/src/
├── main/
│   ├── docker/
│   │   ├── DockerService.ts          # Existing - Add IPC handlers
│   │   └── DockerSchedulerService.ts # NEW - Scheduler executor
│   └── sqlite/
│       ├── manager.ts                # Update - Add docker scheduler manager
│       └── docker-scheduler.ts       # NEW - SQLite operations
└── renderer/
    └── components/
        └── DockerManager/
            ├── DockerManager.tsx     # Existing - Add scheduler tab
            ├── DockerManager.css     # Existing - Add scheduler styles
            ├── DockerScheduler.tsx   # NEW - Scheduler UI
            └── DockerTaskModal.tsx   # NEW - Create/Edit task modal
```

---

### 8. Example Usage Scenarios

#### Scenario 1: Auto-start Development Database
```typescript
{
  name: "Start Dev PostgreSQL",
  taskType: "start_container",
  containerName: "postgres-dev",
  scheduleType: "daily",
  scheduledTime: "08:00",
  description: "Start PostgreSQL before work hours"
}
```

#### Scenario 2: Nightly Backup Container Run
```typescript
{
  name: "Run Nightly Backup",
  taskType: "run_image",
  imageName: "backup-tool:latest",
  createOptions: {
    containerName: "nightly-backup",
    volumes: [{ hostPath: "/data", containerPath: "/backup" }],
    envVars: { BACKUP_PATH: "/backup" }
  },
  scheduleType: "daily",
  scheduledTime: "02:00",
  description: "Run backup container every night at 2 AM"
}
```

#### Scenario 3: Weekend Server Shutdown
```typescript
{
  name: "Stop CI Server (Weekend)",
  taskType: "stop_container",
  containerName: "jenkins-ci",
  scheduleType: "weekly",
  dayOfWeek: 5,  // Friday
  scheduledTime: "18:00",
  description: "Shut down CI server on Friday evening"
}
```

#### Scenario 4: One-time Migration Task
```typescript
{
  name: "Database Migration",
  taskType: "run_image",
  imageName: "db-migrate:v2.0",
  scheduleType: "once",
  scheduledDate: "2025-12-15",
  scheduledTime: "03:00",
  description: "Run database migration during maintenance window"
}
```

---

### 9. Implementation Order

1. **Phase 1: Backend Foundation**
   - [ ] Create SQLite schema and manager class
   - [ ] Create DockerSchedulerService
   - [ ] Add IPC handlers

2. **Phase 2: Basic UI**
   - [ ] Add Scheduler tab to DockerManager
   - [ ] Create task list view
   - [ ] Create task form modal

3. **Phase 3: Advanced Features**
   - [ ] Execution history view
   - [ ] Task duplication
   - [ ] Manual "Run Now" button
   - [ ] Task enable/disable toggle

4. **Phase 4: Polish**
   - [ ] Notifications on task completion
   - [ ] Error handling improvements
   - [ ] Schedule preview (next N runs)

---

## Summary

| Aspect | SNS Scheduler (Reference) | Docker Scheduler (New) |
|--------|---------------------------|------------------------|
| **Library** | `node-schedule` | `node-schedule` |
| **Storage** | SQLite (`better-sqlite3`) | SQLite (`better-sqlite3`) |
| **Task Types** | Blog post generation | Container start/stop/restart/run |
| **Schedule Types** | daily, weekly, monthly, custom | once, daily, weekly, monthly, custom, cron |
| **Execution Tracking** | ✅ History table | ✅ History table |
| **Stats** | run/success/failure counts | run/success/failure counts |
| **UI Location** | Business Identity tab | Docker Manager tab |


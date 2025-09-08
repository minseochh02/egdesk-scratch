// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder';

export interface FileSystemItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isHidden: boolean;
  isSymlink: boolean;
}

export interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  extension: string;
  permissions: number;
}

export interface SystemDirectory {
  name: string;
  path: string;
  icon: string;
}

export interface FileSystemAPI {
  readDirectory: (path: string) => Promise<{ success: boolean; items?: FileSystemItem[]; error?: string }>;
  getFileInfo: (path: string) => Promise<{ success: boolean; info?: FileInfo; error?: string }>;
  getHomeDirectory: () => Promise<string>;
  getSystemDirectories: () => Promise<SystemDirectory[]>;
  createFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (path: string) => Promise<{ success: boolean; error?: string }>;
  renameItem: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  pickFolder: () => Promise<{ success: boolean; folderPath?: string; error?: string }>;
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
}

export interface WordPressConnection {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'ko' | 'en';
  defaultSyncPath: string;
  autoSync: boolean;
}

export interface SyncRecord {
  id: string;
  connectionId: string;
  connectionName: string;
  syncPath: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'failed';
  totalFiles: number;
  syncedFiles: number;
  failedFiles: number;
  fileDetails: SyncFileDetail[];
  errors: string[];
  updatedAt?: string;
}

export interface SyncFileDetail {
  path: string;
  name: string;
  type: 'post' | 'media';
  status: 'synced' | 'failed' | 'skipped';
  localPath: string;
  size?: number;
  syncedAt: string;
  error?: string;
}

export interface WordPressAPI {
  saveConnection: (connection: WordPressConnection) => Promise<{ success: boolean; connections?: WordPressConnection[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: WordPressConnection[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: WordPressConnection[]; error?: string }>;
  updateConnection: (connectionId: string, updates: Partial<WordPressConnection>) => Promise<{ success: boolean; connection?: WordPressConnection; error?: string }>;
  notifySyncCompletion: (syncData: any) => Promise<{ success: boolean; error?: string }>;
  navigateToSyncedFolder: (navigationData: { syncPath: string; connectionName: string }) => Promise<{ success: boolean; error?: string }>;
  syncCreateFolders: (basePath: string) => Promise<{ success: boolean; error?: string }>;
  syncSavePost: (filePath: string, content: string) => Promise<{ success: boolean; size?: number; error?: string }>;
  syncDownloadMedia: (mediaUrl: string, filePath: string) => Promise<{ success: boolean; size?: number; error?: string }>;
}

export interface SyncAPI {
  saveHistory: (syncData: any) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  updateProgress: (syncId: string, progressData: any) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  complete: (syncId: string, completionData: any) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  getHistory: (connectionId?: string) => Promise<{ success: boolean; syncHistory?: SyncRecord[]; error?: string }>;
  getFileStatus: (connectionId: string, filePath: string) => Promise<{ success: boolean; fileStatus?: SyncFileDetail; lastSync?: string; syncPath?: string; error?: string }>;
  clearHistory: (connectionId?: string) => Promise<{ success: boolean; syncHistory?: SyncRecord[]; error?: string }>;
}

export interface PreferencesAPI {
  get: () => Promise<{ success: boolean; preferences?: UserPreferences; error?: string }>;
  set: (preferences: UserPreferences) => Promise<{ success: boolean; error?: string }>;
}

export interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

export interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

interface WordPressServerAPI {
  analyzeFolder: (folderPath: string) => Promise<{ success: boolean; info?: FolderInfo; error?: string }>;
  startServer: (folderPath: string, port?: number) => Promise<{ success: boolean; port?: number; phpInfo?: PHPInfo; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  getServerStatus: () => Promise<{ success: boolean; status?: ServerStatus; error?: string }>;
  pickFolder: () => Promise<{ success: boolean; folderPath?: string; error?: string }>;
  getPHPInfo: () => Promise<{ success: boolean; phpInfo?: PHPInfo; error?: string }>;
}

export interface FolderInfo {
  path: string;
  exists: boolean;
  hasWordPress: boolean;
  hasIndexPhp: boolean;
  hasWpContent: boolean;
  hasWpAdmin: boolean;
  hasWpIncludes: boolean;
  hasHtmlFiles: boolean;
  htmlFileCount: number;
  phpFileCount: number;
  folderType: 'www' | 'wordpress' | 'mixed' | 'unknown';
  detectedRoot?: string;
  availableFiles?: string[];
  phpVersion?: string;
}

export interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  pid?: number;
  folderPath?: string;
  error?: string;
}

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

export interface SchedulerAPI {
  createTask: (taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  updateTask: (taskId: string, updates: Partial<ScheduledTask>) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getTask: (taskId: string) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  getAllTasks: () => Promise<{ success: boolean; tasks?: ScheduledTask[]; error?: string }>;
  getExecutions: (taskId?: string) => Promise<{ success: boolean; executions?: TaskExecution[]; error?: string }>;
  runTaskNow: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  stopTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getSystemInfo: () => Promise<{ success: boolean; systemInfo?: any; error?: string }>;
}

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  fileSystem: {
    readDirectory: (path: string) => ipcRenderer.invoke('fs-read-directory', path),
    getFileInfo: (path: string) => ipcRenderer.invoke('fs-get-file-info', path),
    getHomeDirectory: () => ipcRenderer.invoke('fs-get-home-directory'),
    getSystemDirectories: () => ipcRenderer.invoke('fs-get-system-directories'),
    createFolder: (path: string) => ipcRenderer.invoke('fs-create-folder', path),
    deleteItem: (path: string) => ipcRenderer.invoke('fs-delete-item', path),
    renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs-rename-item', oldPath, newPath),
    pickFolder: () => ipcRenderer.invoke('fs-pick-folder'),
    readFile: (path: string) => ipcRenderer.invoke('fs-read-file', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs-write-file', path, content),
  } as FileSystemAPI,
  wordpress: {
    saveConnection: (connection: WordPressConnection) => ipcRenderer.invoke('wp-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('wp-get-connections'),
    deleteConnection: (connectionId: string) => ipcRenderer.invoke('wp-delete-connection', connectionId),
    updateConnection: (connectionId: string, updates: Partial<WordPressConnection>) => ipcRenderer.invoke('wp-update-connection', connectionId, updates),
    notifySyncCompletion: (syncData: any) => ipcRenderer.invoke('notify-sync-completion', syncData),
    navigateToSyncedFolder: (navigationData: { syncPath: string; connectionName: string }) => ipcRenderer.invoke('wp-navigate-to-synced-folder', navigationData),
    syncCreateFolders: (basePath: string) => ipcRenderer.invoke('wp-sync-create-folders', basePath),
    syncSavePost: (filePath: string, content: string) => ipcRenderer.invoke('wp-sync-save-post', filePath, content),
    syncDownloadMedia: (mediaUrl: string, filePath: string) => ipcRenderer.invoke('wp-sync-download-media', mediaUrl, filePath),
  } as WordPressAPI,
  sync: {
    saveHistory: (syncData: any) => ipcRenderer.invoke('sync-save-history', syncData),
    updateProgress: (syncId: string, progressData: any) => ipcRenderer.invoke('sync-update-progress', syncId, progressData),
    complete: (syncId: string, completionData: any) => ipcRenderer.invoke('sync-complete', syncId, completionData),
    getHistory: (connectionId?: string) => ipcRenderer.invoke('sync-get-history', connectionId),
    getFileStatus: (connectionId: string, filePath: string) => ipcRenderer.invoke('sync-get-file-status', connectionId, filePath),
    clearHistory: (connectionId?: string) => ipcRenderer.invoke('sync-clear-history', connectionId),
  } as SyncAPI,
  preferences: {
    get: () => ipcRenderer.invoke('prefs-get'),
    set: (preferences: UserPreferences) => ipcRenderer.invoke('prefs-set', preferences),
  } as PreferencesAPI,
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
    has: (key: string) => ipcRenderer.invoke('store-has', key),
    clear: () => ipcRenderer.invoke('store-clear'),
  } as StoreAPI,
  wordpressServer: {
    analyzeFolder: (folderPath: string) => ipcRenderer.invoke('wp-server-analyze-folder', folderPath),
    startServer: (folderPath: string, port?: number) => ipcRenderer.invoke('wp-server-start', folderPath, port),
    stopServer: () => ipcRenderer.invoke('wp-server-stop'),
    getServerStatus: () => ipcRenderer.invoke('wp-server-status'),
    pickFolder: () => ipcRenderer.invoke('wp-server-pick-folder'),
    getPHPInfo: () => ipcRenderer.invoke('wp-server-php-info'),
  } as WordPressServerAPI,
  browserWindow: {
    createWindow: (options: any) => ipcRenderer.invoke('browser-window-create', options),
    closeWindow: (windowId: number) => ipcRenderer.invoke('browser-window-close', windowId),
    loadURL: (windowId: number, url: string) => ipcRenderer.invoke('browser-window-load-url', windowId, url),
    reload: (windowId: number) => ipcRenderer.invoke('browser-window-reload', windowId),
    refreshAllLocalhost: () => ipcRenderer.invoke('browser-window-refresh-all-localhost'),
    getAllLocalhostWindows: () => ipcRenderer.invoke('browser-window-get-all-localhost'),
    launchExternalBrowser: (browserType: string, url: string) => ipcRenderer.invoke('browser-window-launch-external', browserType, url),
    closeExternalBrowser: (pid: number) => ipcRenderer.invoke('browser-window-close-external', pid),
    navigateExternalBrowser: (pid: number, url: string) => ipcRenderer.invoke('browser-window-navigate-external', pid, url),
    onUrlChanged: (windowId: number, callback: (url: string) => void) => {
      const listener = (_event: IpcRendererEvent, id: number, url: string) => {
        if (id === windowId) {
          callback(url);
        }
      };
      ipcRenderer.on('browser-window-url-changed', listener);
      return () => ipcRenderer.removeListener('browser-window-url-changed', listener);
    },
    onClosed: (windowId: number, callback: () => void) => {
      const listener = (_event: IpcRendererEvent, id: number) => {
        if (id === windowId) {
          callback();
        }
      };
      ipcRenderer.on('browser-window-closed', listener);
      return () => ipcRenderer.removeListener('browser-window-closed', listener);
    },
  },
  mainWindow: {
    getBounds: () => ipcRenderer.invoke('main-window-get-bounds'),
    setBounds: (bounds: any) => ipcRenderer.invoke('main-window-set-bounds', bounds),
    setSize: (width: number, height: number) => ipcRenderer.invoke('main-window-set-size', width, height),
    setPosition: (x: number, y: number) => ipcRenderer.invoke('main-window-set-position', x, y),
  },
  scheduler: {
    createTask: (taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>) => ipcRenderer.invoke('scheduler-create-task', taskData),
    updateTask: (taskId: string, updates: Partial<ScheduledTask>) => ipcRenderer.invoke('scheduler-update-task', taskId, updates),
    deleteTask: (taskId: string) => ipcRenderer.invoke('scheduler-delete-task', taskId),
    getTask: (taskId: string) => ipcRenderer.invoke('scheduler-get-task', taskId),
    getAllTasks: () => ipcRenderer.invoke('scheduler-get-all-tasks'),
    getExecutions: (taskId?: string) => ipcRenderer.invoke('scheduler-get-executions', taskId),
    runTaskNow: (taskId: string) => ipcRenderer.invoke('scheduler-run-task-now', taskId),
    stopTask: (taskId: string) => ipcRenderer.invoke('scheduler-stop-task', taskId),
    getSystemInfo: () => ipcRenderer.invoke('scheduler-get-system-info'),
  } as SchedulerAPI,
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

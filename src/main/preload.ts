// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { WriteFileToolParams, WriteFileResult } from './tools/write-file';

export type Channels =
  | 'ipc-example'
  | 'sync-completed'
  | 'navigate-to-synced-folder'
  | 'ai-stream-event';

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

export interface ReadFileParams {
  absolute_path: string;
  offset?: number;
  limit?: number;
}

export interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
  isTruncated?: boolean;
  totalLines?: number;
  linesShown?: [number, number];
  mimetype?: string;
  fileSize?: number;
}

export interface FileInfoResult {
  exists: boolean;
  size?: number;
  isDirectory?: boolean;
  mimetype?: string;
  error?: string;
}

export interface FileSystemAPI {
  readDirectory: (
    path: string,
  ) => Promise<{ success: boolean; items?: FileSystemItem[]; error?: string }>;
  getFileInfo: (
    path: string,
  ) => Promise<{ success: boolean; info?: FileInfo; error?: string }>;
  getHomeDirectory: () => Promise<string>;
  getSystemDirectories: () => Promise<SystemDirectory[]>;
  createFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (path: string) => Promise<{ success: boolean; error?: string }>;
  renameItem: (
    oldPath: string,
    newPath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  pickFolder: () => Promise<{
    success: boolean;
    folderPath?: string;
    error?: string;
  }>;
  readFile: (
    path: string,
  ) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (
    path: string,
    content: string,
  ) => Promise<{ success: boolean; error?: string }>;
  readFileWithParams: (params: ReadFileParams) => Promise<ReadFileResult>;
  getFileInfoOnly: (filePath: string) => Promise<FileInfoResult>;
  writeFileWithParams: (params: WriteFileToolParams) => Promise<WriteFileResult>;
  writeFileSimple: (filePath: string, content: string) => Promise<WriteFileResult>;
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
  saveConnection: (connection: WordPressConnection) => Promise<{
    success: boolean;
    connections?: WordPressConnection[];
    error?: string;
  }>;
  getConnections: () => Promise<{
    success: boolean;
    connections?: WordPressConnection[];
    error?: string;
  }>;
  deleteConnection: (connectionId: string) => Promise<{
    success: boolean;
    connections?: WordPressConnection[];
    error?: string;
  }>;
  updateConnection: (
    connectionId: string,
    updates: Partial<WordPressConnection>,
  ) => Promise<{
    success: boolean;
    connection?: WordPressConnection;
    error?: string;
  }>;
  notifySyncCompletion: (
    syncData: any,
  ) => Promise<{ success: boolean; error?: string }>;
  navigateToSyncedFolder: (navigationData: {
    syncPath: string;
    connectionName: string;
  }) => Promise<{ success: boolean; error?: string }>;
  syncCreateFolders: (
    basePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  syncSavePost: (
    filePath: string,
    content: string,
  ) => Promise<{ success: boolean; size?: number; error?: string }>;
  syncDownloadMedia: (
    mediaUrl: string,
    filePath: string,
  ) => Promise<{ success: boolean; size?: number; error?: string }>;
  // SQLite-based sync handlers
  createSyncOperation: (operationData: any) => Promise<{
    success: boolean;
    operationId?: string;
    error?: string;
  }>;
  updateSyncOperation: (operationId: string, updates: any) => Promise<{
    success: boolean;
    error?: string;
  }>;
  savePost: (postData: any) => Promise<{
    success: boolean;
    size?: number;
    error?: string;
  }>;
  downloadMedia: (mediaData: any) => Promise<{
    success: boolean;
    size?: number;
    error?: string;
  }>;
  getPosts: (siteId: string, limit?: number, offset?: number) => Promise<{
    success: boolean;
    posts?: any[];
    error?: string;
  }>;
  getMedia: (siteId: string, limit?: number, offset?: number) => Promise<{
    success: boolean;
    media?: any[];
    error?: string;
  }>;
  getSyncOperations: (siteId: string, limit?: number) => Promise<{
    success: boolean;
    operations?: any[];
    error?: string;
  }>;
  getSyncStats: (siteId: string) => Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }>;
  addSyncFileDetail: (fileDetailData: any) => Promise<{
    success: boolean;
    fileDetailId?: string;
    error?: string;
  }>;
  updateSyncFileDetail: (fileDetailId: string, status: string, errorMessage?: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getSyncFileDetails: (operationId: string) => Promise<{
    success: boolean;
    fileDetails?: any[];
    error?: string;
  }>;
  exportToFiles: (exportOptions: any) => Promise<{
    success: boolean;
    exportedFiles?: string[];
    totalSize?: number;
    error?: string;
  }>;
}

export interface SyncAPI {
  saveHistory: (
    syncData: any,
  ) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  updateProgress: (
    syncId: string,
    progressData: any,
  ) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  complete: (
    syncId: string,
    completionData: any,
  ) => Promise<{ success: boolean; syncRecord?: SyncRecord; error?: string }>;
  getHistory: (connectionId?: string) => Promise<{
    success: boolean;
    syncHistory?: SyncRecord[];
    error?: string;
  }>;
  getFileStatus: (
    connectionId: string,
    filePath: string,
  ) => Promise<{
    success: boolean;
    fileStatus?: SyncFileDetail;
    lastSync?: string;
    syncPath?: string;
    error?: string;
  }>;
  clearHistory: (connectionId?: string) => Promise<{
    success: boolean;
    syncHistory?: SyncRecord[];
    error?: string;
  }>;
}

export interface PreferencesAPI {
  get: () => Promise<{
    success: boolean;
    preferences?: UserPreferences;
    error?: string;
  }>;
  set: (
    preferences: UserPreferences,
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

export interface SSLAnalysisAPI {
  save(analysis: any): Promise<{ success: boolean; analysis?: any; error?: string }>;
  getAll(filter?: any): Promise<{ success: boolean; analyses?: any[]; error?: string }>;
  getById(id: string): Promise<{ success: boolean; analysis?: any; error?: string }>;
  update(id: string, updates: any): Promise<{ success: boolean; analysis?: any; error?: string }>;
  delete(id: string): Promise<{ success: boolean; error?: string }>;
  getStats(): Promise<{ success: boolean; stats?: any; error?: string }>;
  search(query: string): Promise<{ success: boolean; analyses?: any[]; error?: string }>;
  clearAll(): Promise<{ success: boolean; error?: string }>;
}

export interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

interface WordPressServerAPI {
  analyzeFolder: (
    folderPath: string,
  ) => Promise<{ success: boolean; info?: FolderInfo; error?: string }>;
  startServer: (
    folderPath: string,
    port?: number,
  ) => Promise<{
    success: boolean;
    port?: number;
    phpInfo?: PHPInfo;
    error?: string;
  }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  getServerStatus: () => Promise<{
    success: boolean;
    status?: ServerStatus;
    error?: string;
  }>;
  pickFolder: () => Promise<{
    success: boolean;
    folderPath?: string;
    error?: string;
  }>;
  getPHPInfo: () => Promise<{
    success: boolean;
    phpInfo?: PHPInfo;
    error?: string;
  }>;
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
  lastRun?: Date | null;
  nextRun?: Date | null;
  runCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
  workingDirectory?: string;
  environment?: Record<string, string>;
  outputFile?: string;
  errorFile?: string;
  metadata?: Record<string, any>; // For storing task-specific data like topics, WordPress settings, etc.
  frequencyDays?: number;
  frequencyHours?: number;
  frequencyMinutes?: number;
  topicSelectionMode?: 'least-used' | 'random' | 'round-robin';
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
  createdAt: Date;
}

export interface ScriptExecutionResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface ScriptExecutionAPI {
  executeNodeScript: (
    scriptPath: string,
    args?: string[],
    environment?: Record<string, string>
  ) => Promise<ScriptExecutionResult>;
}

export interface AIServiceAPI {
  configure: (config: any) => Promise<boolean>;
  isConfigured: () => Promise<boolean>;
  startAutonomousConversation: (message: string, options: any) => Promise<{ conversationId: string }>;
  conversationReady: (conversationId: string) => Promise<boolean>;
  cancelConversation: () => Promise<boolean>;
  getConversationState: () => Promise<any>;
  getHistory: () => Promise<any[]>;
  clearHistory: () => Promise<void>;
  getAvailableModels: () => Promise<string[]>;
  // Tool confirmation
  confirmTool: (requestId: string, approved: boolean) => Promise<any>;
  getToolDefinitions: () => Promise<any[]>;
  simpleAI: {
    configure: (config: any) => Promise<boolean>;
    isConfigured: () => Promise<boolean>;
  };
}

export interface ProjectContextAPI {
  updateContext: (context: any) => Promise<boolean>;
  getCurrentProject: () => Promise<any>;
  getContext: () => Promise<any>;
}

export interface AIChatDataAPI {
  // Conversation operations
  getConversations: (options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConversationWithMessages: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createConversation: (conversationData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateConversation: (conversationId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  archiveConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  restoreConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Message operations
  getMessages: (conversationId: string, options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  addMessage: (messageData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  addMessages: (messagesData: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateMessage: (messageId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteMessagesInConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  
  // Statistics
  getConversationStats: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getOverallStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  
  // Cleanup
  cleanupOldData: (daysToKeep?: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
}

export interface BackupAPI {
  getAvailableBackups: () => Promise<{ success: boolean; backups?: any[]; error?: string }>;
  getBackupStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
  revertConversation: (conversationId: string) => Promise<{ success: boolean; result?: any; error?: string }>;
  revertToConversation: (targetConversationId: string) => Promise<{ success: boolean; summary?: any; error?: string }>;
  cleanupOldBackups: (keepCount?: number) => Promise<{ success: boolean; result?: any; error?: string }>;
}

export interface BlogTopic {
  topic: string;
  lastUsed: string;
  count: number;
}

export interface AISettings {
  apiKey: string;
  provider: string;
  model: string;
  imageGenerationEnabled: boolean;
  imageProvider: string;
  imageQuality: string;
  imageSize: string;
  imageStyle: string;
  imageAspectRatio: string;
}

export interface WordPressSettings {
  url: string;
  username: string;
  password: string;
}

export interface BlogGenerationParams {
  topics: BlogTopic[];
  topicSelectionMode: 'round-robin' | 'random' | 'least-used';
  aiSettings: AISettings;
}

export interface BlogUploadParams {
  topics: BlogTopic[];
  topicSelectionMode: 'round-robin' | 'random' | 'least-used';
  wordpressSettings: WordPressSettings;
  aiSettings: AISettings;
}

export interface BlogGenerationResult {
  success: boolean;
  data?: {
    title: string;
    content: string;
    excerpt: string;
    tags: string[];
    categories: string[];
    featuredImage?: {
      url: string;
      alt: string;
      caption: string;
    };
    selectedTopic: string;
  };
  error?: string;
}

export interface BlogUploadResult {
  success: boolean;
  data?: {
    postId: number;
    postUrl: string;
    featuredImageId?: number;
    featuredImageUrl?: string;
  };
  error?: string;
}

export interface BlogGenerationAPI {
  generateContent: (params: BlogGenerationParams) => Promise<BlogGenerationResult>;
  generateAndUpload: (params: BlogUploadParams) => Promise<BlogUploadResult>;
}


export interface SchedulerAPI {
  createTask: (
    taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  updateTask: (
    taskId: string,
    updates: Partial<ScheduledTask>,
  ) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getTask: (
    taskId: string,
  ) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
  getAllTasks: () => Promise<{
    success: boolean;
    tasks?: ScheduledTask[];
    error?: string;
  }>;
  getExecutions: (taskId?: string) => Promise<{
    success: boolean;
    executions?: TaskExecution[];
    error?: string;
  }>;
  runTaskNow: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  stopTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  getSystemInfo: () => Promise<{
    success: boolean;
    systemInfo?: any;
    error?: string;
  }>;
  getTaskMetadata: (taskId: string) => Promise<{
    success: boolean;
    metadata?: Record<string, any>;
    error?: string;
  }>;
  updateTaskMetadata: (taskId: string, metadata: Record<string, any>) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const electronHandler = {
  ipcRenderer: {
    sendMessage: (channel: Channels, ...args: unknown[]) => {
      ipcRenderer.send(channel, ...args);
    },
    on: (channel: Channels, func: (...args: unknown[]) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once: (channel: Channels, func: (...args: unknown[]) => void) => {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    app: process.env.npm_package_version || 'Unknown',
  },
  platform: process.platform,
  arch: process.arch,
  isPackaged: process.env.NODE_ENV === 'production',
  fileSystem: {
    readDirectory: (path: string) =>
      ipcRenderer.invoke('fs-read-directory', path),
    getFileInfo: (path: string) => ipcRenderer.invoke('fs-get-file-info', path),
    getHomeDirectory: () => ipcRenderer.invoke('fs-get-home-directory'),
    getSystemDirectories: () => ipcRenderer.invoke('fs-get-system-directories'),
    createFolder: (path: string) =>
      ipcRenderer.invoke('fs-create-folder', path),
    deleteItem: (path: string) => ipcRenderer.invoke('fs-delete-item', path),
    renameItem: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs-rename-item', oldPath, newPath),
    pickFolder: () => ipcRenderer.invoke('fs-pick-folder'),
    readFile: (path: string) => ipcRenderer.invoke('fs-read-file', path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke('fs-write-file', path, content),
    getFileSystemInfo: () => ipcRenderer.invoke('debug-get-filesystem-info'),
    getDiskSpace: () => ipcRenderer.invoke('debug-get-disk-space'),
    readFileWithParams: (params: ReadFileParams) =>
      ipcRenderer.invoke('read-file', params),
    getFileInfoOnly: (filePath: string) =>
      ipcRenderer.invoke('get-file-info', { absolute_path: filePath }),
    writeFileWithParams: (params: WriteFileToolParams) =>
      ipcRenderer.invoke('fs-write-file', params),
    writeFileSimple: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs-write-file-simple', filePath, content),
  } as FileSystemAPI,
  wordpress: {
    saveConnection: (connection: WordPressConnection) =>
      ipcRenderer.invoke('wp-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('wp-get-connections'),
    deleteConnection: (connectionId: string) =>
      ipcRenderer.invoke('wp-delete-connection', connectionId),
    updateConnection: (
      connectionId: string,
      updates: Partial<WordPressConnection>,
    ) => ipcRenderer.invoke('wp-update-connection', connectionId, updates),
    notifySyncCompletion: (syncData: any) =>
      ipcRenderer.invoke('notify-sync-completion', syncData),
    navigateToSyncedFolder: (navigationData: {
      syncPath: string;
      connectionName: string;
    }) => ipcRenderer.invoke('wp-navigate-to-synced-folder', navigationData),
    syncCreateFolders: (basePath: string) =>
      ipcRenderer.invoke('wp-sync-create-folders', basePath),
    syncSavePost: (filePath: string, content: string) =>
      ipcRenderer.invoke('wp-sync-save-post', filePath, content),
    syncDownloadMedia: (mediaUrl: string, filePath: string) =>
      ipcRenderer.invoke('wp-sync-download-media', mediaUrl, filePath),
    // SQLite-based sync handlers
    createSyncOperation: (operationData: any) =>
      ipcRenderer.invoke('wp-sync-create-operation', operationData),
    updateSyncOperation: (operationId: string, updates: any) =>
      ipcRenderer.invoke('wp-sync-update-operation', operationId, updates),
    savePost: (postData: any) =>
      ipcRenderer.invoke('wp-sync-save-post', postData),
    downloadMedia: (mediaData: any) =>
      ipcRenderer.invoke('wp-sync-download-media', mediaData),
    getPosts: (siteId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('wp-sync-get-posts', siteId, limit, offset),
    getMedia: (siteId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('wp-sync-get-media', siteId, limit, offset),
    getSyncOperations: (siteId: string, limit?: number) =>
      ipcRenderer.invoke('wp-sync-get-operations', siteId, limit),
    getSyncStats: (siteId: string) =>
      ipcRenderer.invoke('wp-sync-get-stats', siteId),
    addSyncFileDetail: (fileDetailData: any) =>
      ipcRenderer.invoke('wp-sync-add-file-detail', fileDetailData),
    updateSyncFileDetail: (fileDetailId: string, status: string, errorMessage?: string) =>
      ipcRenderer.invoke('wp-sync-update-file-detail', fileDetailId, status, errorMessage),
    getSyncFileDetails: (operationId: string) =>
      ipcRenderer.invoke('wp-sync-get-file-details', operationId),
    exportToFiles: (exportOptions: any) =>
      ipcRenderer.invoke('wp-sync-export-to-files', exportOptions),
  } as WordPressAPI,
  sync: {
    saveHistory: (syncData: any) =>
      ipcRenderer.invoke('sync-save-history', syncData),
    updateProgress: (syncId: string, progressData: any) =>
      ipcRenderer.invoke('sync-update-progress', syncId, progressData),
    complete: (syncId: string, completionData: any) =>
      ipcRenderer.invoke('sync-complete', syncId, completionData),
    getHistory: (connectionId?: string) =>
      ipcRenderer.invoke('sync-get-history', connectionId),
    getFileStatus: (connectionId: string, filePath: string) =>
      ipcRenderer.invoke('sync-get-file-status', connectionId, filePath),
    clearHistory: (connectionId?: string) =>
      ipcRenderer.invoke('sync-clear-history', connectionId),
  } as SyncAPI,
  preferences: {
    get: () => ipcRenderer.invoke('prefs-get'),
    set: (preferences: UserPreferences) =>
      ipcRenderer.invoke('prefs-set', preferences),
    getStoreInfo: () => ipcRenderer.invoke('debug-get-store-info'),
  } as PreferencesAPI,
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: any) =>
      ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
    has: (key: string) => ipcRenderer.invoke('store-has', key),
    clear: () => ipcRenderer.invoke('store-clear'),
  } as StoreAPI,
  sslAnalysis: {
    save: (analysis: any) => ipcRenderer.invoke('ssl-analysis-save', analysis),
    getAll: (filter?: any) => ipcRenderer.invoke('ssl-analysis-get-all', filter),
    getById: (id: string) => ipcRenderer.invoke('ssl-analysis-get-by-id', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('ssl-analysis-update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('ssl-analysis-delete', id),
    getStats: () => ipcRenderer.invoke('ssl-analysis-get-stats'),
    search: (query: string) => ipcRenderer.invoke('ssl-analysis-search', query),
    clearAll: () => ipcRenderer.invoke('ssl-analysis-clear-all'),
  } as SSLAnalysisAPI,
  wordpressServer: {
    analyzeFolder: (folderPath: string) =>
      ipcRenderer.invoke('wp-server-analyze-folder', folderPath),
    startServer: (folderPath: string, port?: number) =>
      ipcRenderer.invoke('wp-server-start', folderPath, port),
    stopServer: () => ipcRenderer.invoke('wp-server-stop'),
    getServerStatus: () => ipcRenderer.invoke('wp-server-status'),
    pickFolder: () => ipcRenderer.invoke('wp-server-pick-folder'),
    getPHPInfo: () => ipcRenderer.invoke('wp-server-php-info'),
  } as WordPressServerAPI,
  browserWindow: {
    createWindow: (options: any) =>
      ipcRenderer.invoke('browser-window-create', options),
    closeWindow: (windowId: number) =>
      ipcRenderer.invoke('browser-window-close', windowId),
    loadURL: (windowId: number, url: string) =>
      ipcRenderer.invoke('browser-window-load-url', windowId, url),
    switchURL: (url: string, windowId?: number) =>
      ipcRenderer.invoke('browser-window-switch-url', url, windowId),
    reload: (windowId: number) =>
      ipcRenderer.invoke('browser-window-reload', windowId),
    refreshAllLocalhost: () =>
      ipcRenderer.invoke('browser-window-refresh-all-localhost'),
    getAllLocalhostWindows: () =>
      ipcRenderer.invoke('browser-window-get-all-localhost'),
    launchExternalBrowser: (browserType: string, url: string) =>
      ipcRenderer.invoke('browser-window-launch-external', browserType, url),
    closeExternalBrowser: (pid: number) =>
      ipcRenderer.invoke('browser-window-close-external', pid),
    navigateExternalBrowser: (pid: number, url: string) =>
      ipcRenderer.invoke('browser-window-navigate-external', pid, url),
    onUrlChanged: (windowId: number, callback: (url: string) => void) => {
      const listener = (_event: IpcRendererEvent, id: number, url: string) => {
        if (id === windowId) {
          callback(url);
        }
      };
      ipcRenderer.on('browser-window-url-changed', listener);
      return () =>
        ipcRenderer.removeListener('browser-window-url-changed', listener);
    },
    onClosed: (windowId: number, callback: () => void) => {
      const listener = (_event: IpcRendererEvent, id: number) => {
        if (id === windowId) {
          callback();
        }
      };
      ipcRenderer.on('browser-window-closed', listener);
      return () =>
        ipcRenderer.removeListener('browser-window-closed', listener);
    },
  },
  mainWindow: {
    getBounds: () => ipcRenderer.invoke('main-window-get-bounds'),
    setBounds: (bounds: any) =>
      ipcRenderer.invoke('main-window-set-bounds', bounds),
    setSize: (width: number, height: number) =>
      ipcRenderer.invoke('main-window-set-size', width, height),
    setPosition: (x: number, y: number) =>
      ipcRenderer.invoke('main-window-set-position', x, y),
    getWorkArea: () => ipcRenderer.invoke('screen-get-work-area'),
  },
  scheduler: {
    createTask: (
      taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>,
    ) => ipcRenderer.invoke('scheduler-create-task', taskData),
    updateTask: (taskId: string, updates: Partial<ScheduledTask>) =>
      ipcRenderer.invoke('scheduler-update-task', taskId, updates),
    deleteTask: (taskId: string) =>
      ipcRenderer.invoke('scheduler-delete-task', taskId),
    getTask: (taskId: string) =>
      ipcRenderer.invoke('scheduler-get-task', taskId),
    getAllTasks: () => ipcRenderer.invoke('scheduler-get-all-tasks'),
    getExecutions: (taskId?: string) =>
      ipcRenderer.invoke('scheduler-get-executions', taskId),
    runTaskNow: (taskId: string) =>
      ipcRenderer.invoke('scheduler-run-task-now', taskId),
    stopTask: (taskId: string) =>
      ipcRenderer.invoke('scheduler-stop-task', taskId),
    getSystemInfo: () => ipcRenderer.invoke('scheduler-get-system-info'),
    getTaskMetadata: (taskId: string) =>
      ipcRenderer.invoke('scheduler-get-task-metadata', taskId),
    updateTaskMetadata: (taskId: string, metadata: Record<string, any>) =>
      ipcRenderer.invoke('scheduler-update-task-metadata', taskId, metadata),
  } as SchedulerAPI,
  scriptExecution: {
    executeNodeScript: (
      scriptPath: string,
      args?: string[],
      environment?: Record<string, string>
    ) => ipcRenderer.invoke('execute-node-script', scriptPath, args, environment),
  } as ScriptExecutionAPI,
  aiService: {
    configure: (config: any) => ipcRenderer.invoke('ai-configure', config),
    isConfigured: () => ipcRenderer.invoke('ai-is-configured'),
    startAutonomousConversation: (message: string, options: any) => 
      ipcRenderer.invoke('ai-start-autonomous-conversation', message, options),
    conversationReady: (conversationId: string) => 
      ipcRenderer.invoke('ai-conversation-ready', conversationId),
    cancelConversation: () => ipcRenderer.invoke('ai-cancel-conversation'),
    getConversationState: () => ipcRenderer.invoke('ai-get-conversation-state'),
    getHistory: () => ipcRenderer.invoke('ai-get-history'),
    clearHistory: () => ipcRenderer.invoke('ai-clear-history'),
    getAvailableModels: () => ipcRenderer.invoke('ai-get-models'),
    sendImage: (filePath: string, prompt?: string) => ipcRenderer.invoke('ai-send-image', filePath, prompt),
    // Tool confirmation
    confirmTool: (requestId: string, approved: boolean) => ipcRenderer.invoke('ai-tool-confirm', requestId, approved),
    getToolDefinitions: () => ipcRenderer.invoke('ai-get-tool-definitions'),
    // Simple client for testing
    simpleAI: {
      configure: (config: any) => ipcRenderer.invoke('simple-ai-configure', config),
      isConfigured: () => ipcRenderer.invoke('simple-ai-is-configured'),
    },
  } as AIServiceAPI,
  projectContext: {
    updateContext: (context: any) => ipcRenderer.invoke('project-context-update', context),
    getCurrentProject: () => ipcRenderer.invoke('project-context-get-current'),
    getContext: () => ipcRenderer.invoke('project-context-get'),
  } as ProjectContextAPI,
  aiChatData: {
    // Conversation operations
    getConversations: (options?: any) => ipcRenderer.invoke('ai-chat-get-conversations', options),
    getConversation: (conversationId: string) => ipcRenderer.invoke('ai-chat-get-conversation', conversationId),
    getConversationWithMessages: (conversationId: string) => ipcRenderer.invoke('ai-chat-get-conversation-with-messages', conversationId),
    createConversation: (conversationData: any) => ipcRenderer.invoke('ai-chat-create-conversation', conversationData),
    updateConversation: (conversationId: string, updates: any) => ipcRenderer.invoke('ai-chat-update-conversation', conversationId, updates),
    deleteConversation: (conversationId: string) => ipcRenderer.invoke('ai-chat-delete-conversation', conversationId),
    archiveConversation: (conversationId: string) => ipcRenderer.invoke('ai-chat-archive-conversation', conversationId),
    restoreConversation: (conversationId: string) => ipcRenderer.invoke('ai-chat-restore-conversation', conversationId),
    
    // Message operations
    getMessages: (conversationId: string, options?: any) => ipcRenderer.invoke('ai-chat-get-messages', conversationId, options),
    addMessage: (messageData: any) => ipcRenderer.invoke('ai-chat-add-message', messageData),
    addMessages: (messagesData: any[]) => ipcRenderer.invoke('ai-chat-add-messages', messagesData),
    updateMessage: (messageId: string, updates: any) => ipcRenderer.invoke('ai-chat-update-message', messageId, updates),
    deleteMessage: (messageId: string) => ipcRenderer.invoke('ai-chat-delete-message', messageId),
    deleteMessagesInConversation: (conversationId: string) => ipcRenderer.invoke('ai-chat-delete-messages-in-conversation', conversationId),
    
    // Statistics
    getConversationStats: (conversationId: string) => ipcRenderer.invoke('ai-chat-get-conversation-stats', conversationId),
    getOverallStats: () => ipcRenderer.invoke('ai-chat-get-overall-stats'),
    
    // Cleanup
    cleanupOldData: (daysToKeep?: number) => ipcRenderer.invoke('ai-chat-cleanup-old-data', daysToKeep),
    clearAllData: () => ipcRenderer.invoke('ai-chat-clear-all-data'),
  } as AIChatDataAPI,
  backup: {
    getAvailableBackups: () => ipcRenderer.invoke('backup-get-available'),
    getBackupStats: () => ipcRenderer.invoke('backup-get-stats'),
    revertConversation: (conversationId: string) => ipcRenderer.invoke('backup-revert-conversation', conversationId),
    revertToConversation: (targetConversationId: string) => ipcRenderer.invoke('backup-revert-to-conversation', targetConversationId),
    cleanupOldBackups: (keepCount?: number) => ipcRenderer.invoke('backup-cleanup-old', keepCount),
  } as BackupAPI,
  photos: {
    insertIntoProject: (sourceFilePath: string, projectRootPath: string, destinationFileName?: string) =>
      ipcRenderer.invoke('photo-insert-into-project', sourceFilePath, projectRootPath, destinationFileName),
    insertIntoProjectFromBuffer: (fileBytes: ArrayBuffer, projectRootPath: string, destinationFileName: string) =>
      ipcRenderer.invoke('photo-insert-into-project-buffer', fileBytes, projectRootPath, destinationFileName),
    removeFromProject: (absoluteFilePath: string) =>
      ipcRenderer.invoke('photo-remove-from-project', absoluteFilePath),
  },
  blogGeneration: {
    generateContent: (params: BlogGenerationParams) =>
      ipcRenderer.invoke('blog-generate-content', params),
    generateAndUpload: (params: BlogUploadParams) =>
      ipcRenderer.invoke('blog-generate-and-upload', params),
  } as BlogGenerationAPI,
  debug: {
    startAutomation: (id?: string, pw?: string, proxy?: string) => ipcRenderer.invoke('start-automation', { id, pw, proxy }),
    startWooriAutomation: (proxy?: string, geminiApiKey?: string) => ipcRenderer.invoke('start-woori-automation', { proxy, geminiApiKey }),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

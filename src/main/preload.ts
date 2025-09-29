// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * File operation parameters for writing files
 */
export interface WriteFileToolParams {
  filePath: string;
  content: string;
}

/**
 * Result of file write operations
 */
export interface WriteFileResult {
  success: boolean;
  error?: string;
}

/**
 * IPC communication channels
 */
export type Channels =
  | 'sync-completed'
  | 'navigate-to-synced-folder'
  | 'ai-stream-event';

/**
 * File system item information
 */
export interface FileSystemItem {
  name: string;
  type: 'folder' | 'file';
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isHidden: boolean;
  isSymlink: boolean;
}

/**
 * Detailed file information
 */
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

/**
 * System directory information
 */
export interface SystemDirectory {
  name: string;
  path: string;
  icon: string;
}

/**
 * Parameters for reading files with options
 */
export interface ReadFileParams {
  absolute_path: string;
  offset?: number;
  limit?: number;
}

/**
 * Result of file read operations
 */
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

/**
 * Basic file information result
 */
export interface FileInfoResult {
  exists: boolean;
  size?: number;
  isDirectory?: boolean;
  mimetype?: string;
  error?: string;
}

// ============================================================================
// API INTERFACES
// ============================================================================

/**
 * File system operations API
 */
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

/**
 * WordPress connection configuration
 */
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

/**
 * User application preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'ko' | 'en';
  defaultSyncPath: string;
  autoSync: boolean;
}

/**
 * Synchronization record for tracking sync operations
 */
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

/**
 * Individual file sync detail information
 */
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

/**
 * WordPress API for managing connections and content synchronization
 */
export interface WordPressAPI {
  // Connection management
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
  
  // SQLite-based sync operations
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
  
  // WordPress REST API operations
  fetchPosts: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    posts?: any[];
    total?: number;
    error?: string;
  }>;
  fetchAllPosts: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    totalPosts?: number;
    error?: string;
  }>;
  fetchMedia: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    media?: any[];
    total?: number;
    error?: string;
  }>;
  fetchAllMedia: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    totalMedia?: number;
    error?: string;
  }>;
  fetchComments: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    comments?: any[];
    total?: number;
    error?: string;
  }>;
  fetchAllComments: (connectionId: string, options?: any) => Promise<{
    success: boolean;
    totalComments?: number;
    error?: string;
  }>;
  getComments: (connectionId: string, limit?: number, offset?: number) => Promise<{
    success: boolean;
    comments?: any[];
    error?: string;
  }>;
  updateCommentStatus: (connectionId: string, commentId: number, status: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  deleteComment: (connectionId: string, commentId: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  clearAllData: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  clearSiteData: (siteId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
  checkSite: (url: string) => Promise<{
    success: boolean;
    status?: 'online' | 'offline';
    responseTime?: number;
    error?: string;
    content?: string;
  }>;
}

/**
 * Scheduled posts management API
 */
export interface ScheduledPostsAPI {
  create: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  get: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getByConnection: (connectionId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAll: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  update: (id: string, updates: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  getTopics: (scheduledPostId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  runNow: (id: string) => Promise<{ success: boolean; error?: string }>;
  getExecutionHistory: (id: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
}

/**
 * Synchronization operations API
 */
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

/**
 * User preferences management API
 */
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

/**
 * Application store operations API
 */
export interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  clearWordPressConfig: () => Promise<{
    success: boolean;
    error?: string;
  }>;
}

/**
 * SSL analysis management API
 */
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

/**
 * PHP runtime information
 */
export interface PHPInfo {
  version: string;
  path: string;
  isBundled: boolean;
  isAvailable: boolean;
  error?: string;
}

/**
 * WordPress server management API
 */
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

/**
 * Folder analysis information
 */
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

/**
 * Server status information
 */
export interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  pid?: number;
  folderPath?: string;
  error?: string;
}



/**
 * Script execution result
 */
export interface ScriptExecutionResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

/**
 * Script execution API
 */
export interface ScriptExecutionAPI {
  executeNodeScript: (
    scriptPath: string,
    args?: string[],
    environment?: Record<string, string>
  ) => Promise<ScriptExecutionResult>;
}

/**
 * AI service management API
 */
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

/**
 * Project context management API
 */
export interface ProjectContextAPI {
  updateContext: (context: any) => Promise<boolean>;
  getCurrentProject: () => Promise<any>;
  getContext: () => Promise<any>;
}

/**
 * AI chat data management API
 */
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

/**
 * Backup management API
 */
export interface BackupAPI {
  getAvailableBackups: () => Promise<{ success: boolean; backups?: any[]; error?: string }>;
  getBackupStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
  revertConversation: (conversationId: string) => Promise<{ success: boolean; result?: any; error?: string }>;
  revertToConversation: (targetConversationId: string) => Promise<{ success: boolean; summary?: any; error?: string }>;
  cleanupOldBackups: (keepCount?: number) => Promise<{ success: boolean; result?: any; error?: string }>;
}

/**
 * Blog topic information
 */
export interface BlogTopic {
  topic: string;
  lastUsed: string;
  count: number;
}

/**
 * AI service configuration
 */
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

/**
 * WordPress connection settings
 */
export interface WordPressSettings {
  url: string;
  username: string;
  password: string;
}

/**
 * Blog generation parameters
 */
export interface BlogGenerationParams {
  topics: BlogTopic[];
  topicSelectionMode: 'round-robin' | 'random' | 'least-used';
  aiSettings: AISettings;
}

/**
 * Blog upload parameters
 */
export interface BlogUploadParams {
  topics: BlogTopic[];
  topicSelectionMode: 'round-robin' | 'random' | 'least-used';
  wordpressSettings: WordPressSettings;
  aiSettings: AISettings;
}

/**
 * Blog generation result
 */
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

/**
 * Blog upload result
 */
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

/**
 * Blog generation API
 */
export interface BlogGenerationAPI {
  generateContent: (params: BlogGenerationParams) => Promise<BlogGenerationResult>;
  generateAndUpload: (params: BlogUploadParams) => Promise<BlogUploadResult>;
}



// ============================================================================
// ELECTRON HANDLER IMPLEMENTATION
// ============================================================================

/**
 * Main Electron API handler that exposes functionality to the renderer process
 */
const electronHandler = {
  // ========================================================================
  // CORE ELECTRON FUNCTIONALITY
  // ========================================================================
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
  
  // ========================================================================
  // FILE SYSTEM OPERATIONS
  // ========================================================================
  
  /**
   * File system management API
   */
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
      ipcRenderer.invoke('fs-write-file', filePath, content),
  } as FileSystemAPI,
  
  // ========================================================================
  // WORDPRESS MANAGEMENT
  // ========================================================================
  
  /**
   * WordPress connection and content management API
   */
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
    fetchPosts: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-posts', connectionId, options),
    fetchAllPosts: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-all-posts', connectionId, options),
    fetchMedia: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-media', connectionId, options),
    fetchAllMedia: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-all-media', connectionId, options),
    fetchComments: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-comments', connectionId, options),
    fetchAllComments: (connectionId: string, options?: any) =>
      ipcRenderer.invoke('wp-fetch-all-comments', connectionId, options),
    getComments: (connectionId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('wp-get-comments', connectionId, limit, offset),
    updateCommentStatus: (connectionId: string, commentId: number, status: string) =>
      ipcRenderer.invoke('wp-update-comment-status', connectionId, commentId, status),
    deleteComment: (connectionId: string, commentId: number) =>
      ipcRenderer.invoke('wp-delete-comment', connectionId, commentId),
    clearAllData: () => ipcRenderer.invoke('sqlite-wordpress-clear-all'),
    clearSiteData: (siteId: string) => ipcRenderer.invoke('sqlite-wordpress-clear-site', siteId),
    checkSite: (url: string) =>
      ipcRenderer.invoke('wp-check-site-status', url),
  } as WordPressAPI,
  
  // ========================================================================
  // SCHEDULED POSTS MANAGEMENT
  // ========================================================================
  
  /**
   * Scheduled posts management API
   */
  scheduledPosts: {
    create: (data: any) => ipcRenderer.invoke('sqlite-scheduled-posts-create', data),
    get: (id: string) => ipcRenderer.invoke('sqlite-scheduled-posts-get', id),
    getByConnection: (connectionId: string) => ipcRenderer.invoke('sqlite-scheduled-posts-get-by-connection', connectionId),
    getAll: () => ipcRenderer.invoke('sqlite-scheduled-posts-get-all'),
    update: (id: string, updates: any) => ipcRenderer.invoke('sqlite-scheduled-posts-update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('sqlite-scheduled-posts-delete', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('sqlite-scheduled-posts-toggle', id, enabled),
    getTopics: (scheduledPostId: string) => ipcRenderer.invoke('sqlite-scheduled-posts-get-topics', scheduledPostId),
    runNow: (id: string) => ipcRenderer.invoke('sqlite-scheduled-posts-run-now', id),
    getExecutionHistory: (id: string) => ipcRenderer.invoke('sqlite-scheduled-posts-get-execution-history', id),
  } as ScheduledPostsAPI,
  
  // ========================================================================
  // SYNCHRONIZATION MANAGEMENT
  // ========================================================================
  
  /**
   * Synchronization operations API
   */
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
  
  // ========================================================================
  // USER PREFERENCES & STORAGE
  // ========================================================================
  
  /**
   * User preferences management API
   */
  preferences: {
    get: () => ipcRenderer.invoke('prefs-get'),
    set: (preferences: UserPreferences) =>
      ipcRenderer.invoke('prefs-set', preferences),
    getStoreInfo: () => ipcRenderer.invoke('debug-get-store-info'),
  } as PreferencesAPI,
  
  /**
   * Application store operations API
   */
  store: {
    get: (key: string) => ipcRenderer.invoke('store-get', key),
    set: (key: string, value: any) =>
      ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store-delete', key),
    has: (key: string) => ipcRenderer.invoke('store-has', key),
    clear: () => ipcRenderer.invoke('store-clear'),
    clearWordPressConfig: () => ipcRenderer.invoke('wordpress-clear-config'),
  } as StoreAPI,
  
  // ========================================================================
  // SSL ANALYSIS
  // ========================================================================
  
  /**
   * SSL analysis management API
   */
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
  
  // ========================================================================
  // WORDPRESS SERVER MANAGEMENT
  // ========================================================================
  
  /**
   * WordPress server management API
   */
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
  
  // ========================================================================
  // BROWSER WINDOW MANAGEMENT
  // ========================================================================
  
  /**
   * Browser window management API
   */
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
  
  /**
   * Main window management API
   */
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
  
  // ========================================================================
  // TASK SCHEDULER
  // ========================================================================
  
  
  // ========================================================================
  // SCRIPT EXECUTION
  // ========================================================================
  
  /**
   * Script execution API
   */
  scriptExecution: {
    executeNodeScript: (
      scriptPath: string,
      args?: string[],
      environment?: Record<string, string>
    ) => ipcRenderer.invoke('execute-node-script', scriptPath, args, environment),
  } as ScriptExecutionAPI,
  
  // ========================================================================
  // AI SERVICES
  // ========================================================================
  
  /**
   * AI service management API
   */
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
  
  /**
   * Project context management API
   */
  projectContext: {
    updateContext: (context: any) => ipcRenderer.invoke('project-context-update', context),
    getCurrentProject: () => ipcRenderer.invoke('project-context-get-current'),
    getContext: () => ipcRenderer.invoke('project-context-get'),
  } as ProjectContextAPI,
  
  /**
   * AI chat data management API
   */
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
  
  /**
   * Backup management API
   */
  backup: {
    getAvailableBackups: () => ipcRenderer.invoke('backup-get-available'),
    getBackupStats: () => ipcRenderer.invoke('backup-get-stats'),
    revertConversation: (conversationId: string) => ipcRenderer.invoke('backup-revert-conversation', conversationId),
    revertToConversation: (targetConversationId: string) => ipcRenderer.invoke('backup-revert-to-conversation', targetConversationId),
    cleanupOldBackups: (keepCount?: number) => ipcRenderer.invoke('backup-cleanup-old', keepCount),
  } as BackupAPI,
  
  /**
   * Photo management API
   */
  photos: {
    insertIntoProject: (sourceFilePath: string, projectRootPath: string, destinationFileName?: string) =>
      ipcRenderer.invoke('photo-insert-into-project', sourceFilePath, projectRootPath, destinationFileName),
    insertIntoProjectFromBuffer: (fileBytes: ArrayBuffer, projectRootPath: string, destinationFileName: string) =>
      ipcRenderer.invoke('photo-insert-into-project-buffer', fileBytes, projectRootPath, destinationFileName),
    removeFromProject: (absoluteFilePath: string) =>
      ipcRenderer.invoke('photo-remove-from-project', absoluteFilePath),
  },
  
  /**
   * Blog generation API
   */
  blogGeneration: {
    generateContent: (params: BlogGenerationParams) =>
      ipcRenderer.invoke('blog-generate-content', params),
    generateAndUpload: (params: BlogUploadParams) =>
      ipcRenderer.invoke('blog-generate-and-upload', params),
  } as BlogGenerationAPI,
  
  // ========================================================================
  // UTILITY SERVICES
  // ========================================================================
  
  
  /**
   * Debug and automation API
   */
  debug: {
    startAutomation: (id?: string, pw?: string, proxy?: string) => ipcRenderer.invoke('start-automation', { id, pw, proxy }),
    startWooriAutomation: (id?: string, password?: string, proxy?: string, geminiApiKey?: string) => ipcRenderer.invoke('start-woori-automation', { id, password, proxy, geminiApiKey }),
  },
};

// ============================================================================
// EXPOSE API TO RENDERER PROCESS
// ============================================================================

/**
 * Expose the Electron API to the renderer process through contextBridge
 * This provides secure access to main process functionality from the renderer
 */
contextBridge.exposeInMainWorld('electron', electronHandler);

/**
 * Type definition for the Electron handler
 * Used for TypeScript type checking in the renderer process
 */
export type ElectronHandler = typeof electronHandler;

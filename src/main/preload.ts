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
 * Result of Ollama status operations
 */
export interface OllamaCheckResult {
  success: boolean;
  installed?: boolean;
  message?: string;
  error?: string;
}

/**
 * Result of attempts to start Ollama
 */
export interface OllamaStartResult {
  success: boolean;
  started?: boolean;
  installed?: boolean;
  message?: string;
  error?: string;
}

/**
 * Result of pulling an Ollama model
 */
export interface OllamaPullResult {
  success: boolean;
  model?: string;
  message?: string;
  error?: string;
}

/**
 * Result of checking for an Ollama model
 */
export interface OllamaModelCheckResult {
  success: boolean;
  model?: string;
  exists?: boolean;
  error?: string;
}

/**
 * Ollama management API exposed to the renderer
 */
export interface OllamaAPI {
  checkInstalled: () => Promise<OllamaCheckResult>;
  ensure: () => Promise<OllamaCheckResult>;
  install: () => Promise<OllamaCheckResult>;
  start: () => Promise<OllamaStartResult>;
  pullModel: (model: string) => Promise<OllamaPullResult>;
  hasModel: (model: string) => Promise<OllamaModelCheckResult>;
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

/**
 * Result of Git clone operation
 */
export interface GitCloneResult {
  success: boolean;
  error?: string;
}

/**
 * Git operations API
 */
export interface GitAPI {
  clone: (repoUrl: string, destPath: string) => Promise<GitCloneResult>;
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
  joinPaths: (...paths: string[]) => Promise<{ success: boolean; joinedPath?: string; error?: string }>;
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
 * Naver Blog connection configuration
 */
export interface NaverConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Instagram connection configuration
 */
export interface InstagramConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface YouTubeConnection {
  id?: string;
  name: string;
  username?: string; // Optional - not needed if using chromeUserDataDir
  password?: string; // Optional - not needed if using chromeUserDataDir
  /** Chrome user data directory path - recommended approach to avoid CAPTCHA/2FA */
  chromeUserDataDir?: string;
  /** Chrome executable path - required if using chromeUserDataDir */
  chromeExecutablePath?: string;
  channelId?: string;
  accessToken?: string;
  refreshToken?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacebookConnection {
  id?: string;
  name: string;
  username: string;
  password: string;
  pageId?: string;
  accessToken?: string;
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
 * Naver Blog API for managing connections
 */
export interface NaverAPI {
  // Connection management
  saveConnection: (connection: NaverConnection) => Promise<{
    success: boolean;
    connections?: NaverConnection[];
    error?: string;
  }>;
  getConnections: () => Promise<{
    success: boolean;
    connections?: NaverConnection[];
    error?: string;
  }>;
  deleteConnection: (connectionId: string) => Promise<{
    success: boolean;
    connections?: NaverConnection[];
    error?: string;
  }>;
  updateConnection: (
    connectionId: string,
    updates: Partial<NaverConnection>,
  ) => Promise<{
    success: boolean;
    connection?: NaverConnection;
    error?: string;
  }>;
  testConnection: (connection: NaverConnection) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

/**
 * Instagram API for managing connections
 */
export interface InstagramAPI {
  // Connection management
  saveConnection: (connection: InstagramConnection) => Promise<{
    success: boolean;
    connection?: InstagramConnection;
    connections?: InstagramConnection[];
    error?: string;
  }>;
  getConnections: () => Promise<{
    success: boolean;
    connections?: InstagramConnection[];
    error?: string;
  }>;
  deleteConnection: (connectionId: string) => Promise<{
    success: boolean;
    connections?: InstagramConnection[];
    error?: string;
  }>;
  updateConnection: (
    connectionId: string,
    updates: Partial<InstagramConnection>,
  ) => Promise<{
    success: boolean;
    connection?: InstagramConnection;
    connections?: InstagramConnection[];
    error?: string;
  }>;
  testConnection: (connection: InstagramConnection) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  fetchPosts: (
    connectionId: string,
    options?: { limit?: number; useGraphAPI?: boolean }
  ) => Promise<{
    success: boolean;
    posts?: any[];
    error?: string;
  }>;
}

/**
 * YouTube connection management API
 */
export interface YouTubeAPI {
  saveConnection: (connection: YouTubeConnection) => Promise<{
    success: boolean;
    connection?: YouTubeConnection;
    connections?: YouTubeConnection[];
    error?: string;
  }>;
  getConnections: () => Promise<{
    success: boolean;
    connections?: YouTubeConnection[];
    error?: string;
  }>;
  deleteConnection: (connectionId: string) => Promise<{
    success: boolean;
    connections?: YouTubeConnection[];
    error?: string;
  }>;
  updateConnection: (
    connectionId: string,
    updates: Partial<YouTubeConnection>,
  ) => Promise<{
    success: boolean;
    connection?: YouTubeConnection;
    connections?: YouTubeConnection[];
    error?: string;
  }>;
  testConnection: (connection: YouTubeConnection) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
}

/**
 * Facebook connection management API
 */
export interface FacebookAPI {
  saveConnection: (connection: FacebookConnection) => Promise<{
    success: boolean;
    connection?: FacebookConnection;
    connections?: FacebookConnection[];
    error?: string;
  }>;
  getConnections: () => Promise<{
    success: boolean;
    connections?: FacebookConnection[];
    error?: string;
  }>;
  deleteConnection: (connectionId: string) => Promise<{
    success: boolean;
    connections?: FacebookConnection[];
    error?: string;
  }>;
  updateConnection: (
    connectionId: string,
    updates: Partial<FacebookConnection>,
  ) => Promise<{
    success: boolean;
    connection?: FacebookConnection;
    connections?: FacebookConnection[];
    error?: string;
  }>;
  testConnection: (connection: FacebookConnection) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
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
 * Business identity storage API
 */
export interface BusinessIdentitySnsPlanInput {
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
  cadenceValue?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  scheduledTime: string;
  topics: string[];
  assets?: Record<string, any> | null;
  enabled?: boolean;
}

export interface BusinessIdentityAPI {
  createSnapshot: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  getSnapshot: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  listSnapshots: (brandKey: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  listSnsPlans: (
    snapshotId: string,
  ) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  saveSnsPlans: (
    snapshotId: string,
    plans: BusinessIdentitySnsPlanInput[],
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateAnalysisResults: (
    snapshotId: string,
    seoAnalysis: any,
    sslAnalysis: any,
  ) => Promise<{ success: boolean; error?: string }>;
  updateSnsPlanConnection: (
    planId: string,
    connectionId: string | null,
    connectionName: string | null,
    connectionType: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  updateSnsPlanAIKey: (
    planId: string,
    aiKeyId: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface TemplateCopiesAPI {
  create: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  get: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getByTemplate: (templateId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAll: (limit?: number, offset?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getByScriptId: (scriptId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateScriptContent: (scriptId: string, scriptContent: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}

export interface AppsScriptToolsAPI {
  listFiles: (scriptId: string) => Promise<{ success: boolean; data?: Array<{name: string; type: string; hasSource: boolean}>; error?: string }>;
  readFile: (scriptId: string, fileName: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (scriptId: string, fileName: string, content: string, fileType?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  partialEdit: (scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean) => Promise<{ success: boolean; data?: string; error?: string }>;
  renameFile: (scriptId: string, oldFileName: string, newFileName: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  deleteFile: (scriptId: string, fileName: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  pushToGoogle: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; versionNumber?: number }; error?: string }>;
  pullFromGoogle: (projectId: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; fileCount: number }; error?: string }>;
  listVersions: (projectId: string) => Promise<{ success: boolean; data?: Array<{ versionNumber: number; description?: string; createTime: string }>; error?: string }>;
  getVersionContent: (projectId: string, versionNumber: number) => Promise<{ success: boolean; data?: { files: Array<{ name: string; type: string; source: string }>; versionNumber: number }; error?: string }>;
  runFunction: (scriptId: string, functionName: string, parameters?: any[]) => Promise<{ success: boolean; data?: { response?: { result?: any }; logs?: string[] }; error?: string }>;
  listTriggers: (projectId: string) => Promise<{ success: boolean; data?: Array<{ triggerId: string; functionName: string; eventSource: any }>; error?: string }>;
  // Dev/Prod flow methods
  cloneForDev: (projectId: string) => Promise<{ success: boolean; data?: { devScriptId: string; devSpreadsheetId: string; devSpreadsheetUrl: string }; error?: string }>;
  pushToDev: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; versionNumber?: number }; error?: string }>;
  pullFromDev: (projectId: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; fileCount: number }; error?: string }>;
  pushDevToProd: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; versionNumber?: number }; error?: string }>;
  pullProdToDev: (projectId: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; fileCount: number }; error?: string }>;
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
 * EGChatting data management API
 */
export interface EgChattingAPI {
  getConversations: () => Promise<any[]>;
  createConversation: (title: string, summary?: string) => Promise<any>;
  deleteConversation: (id: string) => Promise<boolean>;
  updateConversation: (id: string, updates: any) => Promise<boolean>;
  getMessages: (conversationId: string) => Promise<any[]>;
  addMessage: (message: any) => Promise<any>;
  deleteMessage: (id: string) => Promise<boolean>;
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

/**
 * Simplified representation of fetched website content
 */
export interface WebsiteContentSummary {
  url: string;
  finalUrl: string;
  status: number;
  contentType?: string | null;
  language?: string | null;
  title?: string | null;
  description?: string | null;
  html: string;
  text: string;
  textPreview: string;
  wordCount: number;
  fetchedAt: string;
}

/**
 * Result of requesting website content from the main process
 */
export interface WebsiteContentFetchResult {
  success: boolean;
  content?: WebsiteContentSummary;
  error?: string;
}

/**
 * Web utilities exposed to renderer processes
 */
export interface HomepageCrawlResult {
  success: boolean;
  homepageUrl: string;
  navigation?: {
    main: Array<{ href: string; text: string; title?: string; isInternal: boolean; normalizedUrl?: string }>;
    footer: Array<{ href: string; text: string; title?: string; isInternal: boolean; normalizedUrl?: string }>;
  };
  discoveredPages?: {
    about?: string;
    contact?: string;
    products?: string;
    services?: string;
    blog?: string;
    careers?: string;
    pricing?: string;
  };
  allInternalLinks?: string[];
  error?: string;
}

export interface MultiPageCrawlResult {
  success: boolean;
  domain: string;
  baseUrl: string;
  pages: Array<{
    url: string;
    path: string;
    pageType: 'homepage' | 'about' | 'contact' | 'products' | 'services' | 'blog' | 'careers' | 'pricing' | 'other';
    title: string | null;
    description: string | null;
    content: {
      text: string;
      wordCount: number;
    };
    metadata: {
      status: number;
      language: string | null;
      fetchedAt: string;
    };
    priority: 'high' | 'medium' | 'low';
  }>;
  siteStructure: {
    navigation: {
      main: number;
      footer: number;
    };
    commonPages: {
      about?: string;
      contact?: string;
      products?: string;
      services?: string;
      blog?: string;
      careers?: string;
      pricing?: string;
    };
  };
  combinedContent: {
    text: string;
    totalWordCount: number;
    pagesCrawled: number;
  };
  error?: string;
}

export interface WebUtilitiesAPI {
  fetchContent: (url: string) => Promise<WebsiteContentFetchResult>;
  crawlHomepage: (url: string) => Promise<HomepageCrawlResult>;
  crawlMultiplePages: (url: string, options?: { maxPages?: number; includePages?: string[] }) => Promise<MultiPageCrawlResult>;
  generateBusinessIdentity: (websiteText: string, rootUrl?: string, language?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  generateSnsPlan: (identityData: any) => Promise<{ success: boolean; content?: string; error?: string }>;
  fullResearch: (domain: string, inquiryData?: any, options?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  db: {
    save: (record: any) => Promise<any>;
    getAll: () => Promise<any>;
    getById: (id: string) => Promise<any>;
    delete: (id: string) => Promise<any>;
    findByDomain: (domain: string) => Promise<any>;
  };
}


export interface WorkspaceAPI {
  createSpreadsheet: (
    title: string,
  ) => Promise<{
    success: boolean;
    data?: { spreadsheetId: string; spreadsheetUrl: string };
    error?: string;
  }>;
  addAppsScript: (
    spreadsheetId: string,
    scriptCode: string,
    scriptTitle?: string,
  ) => Promise<{
    success: boolean;
    data?: { scriptId: string };
    error?: string;
  }>;
  createSpreadsheetWithScript: (
    title: string,
    scriptCode: string,
    scriptTitle?: string,
  ) => Promise<{
    success: boolean;
    data?: { spreadsheetId: string; spreadsheetUrl: string; scriptId: string };
    error?: string;
  }>;
  getSpreadsheet: (
    spreadsheetId: string,
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  executeScript: (
    scriptId: string,
    functionName: string,
    parameters?: any[],
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  copyTemplateContent: (
    templateContent: any,
  ) => Promise<{
    success: boolean;
    data?: {
      spreadsheetId: string;
      spreadsheetUrl: string;
      scriptId?: string;
      appsScriptError?: {
        code: string;
        message: string;
        action?: string;
        url?: string;
      };
    };
    error?: string;
  }>;
}

/**
 * Docker container information
 */
export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Ports: Array<{ PublicPort?: number; PrivatePort: number; Type: string }>;
  Created: number;
}

/**
 * Docker image information
 */
export interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

/**
 * Docker management API
 */
/**
 * EGDesk Dev Spreadsheet types
 */
export interface EGDeskDevFolderConfig {
  folderId: string;
  folderUrl: string;
  parentFolderId: string;
  createdAt: string;
}

export interface EGDeskDevConfig {
  devSpreadsheetId: string;
  devSpreadsheetUrl: string;
  devSheetGid: string;
  publicSpreadsheetId: string;
  publicSheetGid: string;
  lastSyncedAt: string | null;
  syncDirection: 'public-to-dev' | 'dev-to-public' | 'bidirectional';
  createdAt: string;
  updatedAt: string;
}

export interface SpreadsheetRow {
  name: string;
  description: string;
  url: string;
  scriptID: string;
  rowIndex: number;
}

export interface SchemaDiff {
  added: SpreadsheetRow[];
  removed: SpreadsheetRow[];
  modified: MergeConflict[];
  unchanged: SpreadsheetRow[];
}

export interface MergeConflict {
  name: string;
  scriptID: string;
  field: string;
  publicValue: string;
  devValue: string;
  publicRow: SpreadsheetRow;
  devRow: SpreadsheetRow;
}

export interface BackupInfo {
  sheetName: string;
  createdAt: string;
  rowCount: number;
}

/**
 * EGDesk Dev Spreadsheet API
 */
export interface EGDeskDevAPI {
  // Configuration
  getConfig: () => Promise<{ success: boolean; config?: EGDeskDevConfig | null; error?: string }>;
  setConfig: (config: EGDeskDevConfig) => Promise<{ success: boolean; error?: string }>;
  clearConfig: () => Promise<{ success: boolean; error?: string }>;
  
  // Dev Folder
  getDevFolder: () => Promise<{ success: boolean; config?: EGDeskDevFolderConfig | null; error?: string }>;
  createDevFolder: () => Promise<{ success: boolean; folderId?: string; folderUrl?: string; parentFolderId?: string; createdAt?: string; error?: string }>;
  
  // Spreadsheet operations
  createDevSpreadsheet: () => Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; devFolderUrl?: string; message?: string; error?: string }>;
  validateSchema: () => Promise<{ success: boolean; isValid?: boolean; publicHeaders?: string[]; devHeaders?: string[]; errors?: string[]; error?: string }>;
  compareSchemas: () => Promise<{ success: boolean; diff?: SchemaDiff; error?: string }>;
  syncPublicToDev: (createBackup?: boolean) => Promise<{ success: boolean; message?: string; backup?: BackupInfo; rowsSynced?: number; error?: string }>;
  syncDevToPublic: (createBackup?: boolean) => Promise<{ success: boolean; message?: string; backup?: BackupInfo; rowsSynced?: number; error?: string }>;
  applyMergeResolution: (targetSpreadsheet: 'public' | 'dev', resolvedRows: SpreadsheetRow[]) => Promise<{ success: boolean; message?: string; error?: string }>;
  fetchSpreadsheetRows: (spreadsheetId: string, sheetName?: string) => Promise<{ success: boolean; rows?: SpreadsheetRow[]; error?: string }>;
  createBackup: (spreadsheetId: string) => Promise<{ success: boolean; backup?: BackupInfo; error?: string }>;
}

export interface DockerAPI {
  // Connection
  checkConnection: () => Promise<{ connected: boolean; error?: string }>;
  getInfo: () => Promise<any>;

  // Containers
  listContainers: (options?: { all?: boolean }) => Promise<DockerContainer[]>;
  getContainer: (containerId: string) => Promise<any>;
  startContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  stopContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  restartContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
  removeContainer: (containerId: string, options?: { force?: boolean; v?: boolean }) => Promise<{ success: boolean; error?: string }>;
  getContainerLogs: (containerId: string, options?: { follow?: boolean; stdout?: boolean; stderr?: boolean; tail?: number }) => Promise<string>;
  getContainerStats: (containerId: string) => Promise<any>;
  execInContainer: (containerId: string, cmd: string[]) => Promise<{ success: boolean; output?: string; error?: string }>;

  // Images
  listImages: () => Promise<DockerImage[]>;
  pullImage: (imageName: string) => Promise<{ success: boolean; error?: string }>;
  removeImage: (imageId: string) => Promise<{ success: boolean; error?: string }>;

  // Create
  createContainer: (options: any) => Promise<{ success: boolean; containerId?: string; error?: string }>;

  // Networks & Volumes
  listNetworks: () => Promise<any[]>;
  listVolumes: () => Promise<any>;

  // Events
  onPullProgress: (callback: (data: { imageName: string; status?: string; progress?: string }) => void) => () => void;
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
    joinPaths: (...paths: string[]) =>
      ipcRenderer.invoke('fs-join-paths', ...paths),
  } as FileSystemAPI,

  // ========================================================================
  // GIT OPERATIONS
  // ========================================================================

  /**
   * Git management API
   */
  git: {
    clone: (repoUrl: string, destPath: string) =>
      ipcRenderer.invoke('git-clone', repoUrl, destPath),
  } as GitAPI,
  
  // ========================================================================
  // WEB UTILITIES
  // ========================================================================
  web: {
    fetchContent: (url: string) => ipcRenderer.invoke('web-fetch-content', url),
    crawlHomepage: (url: string) => ipcRenderer.invoke('web-crawl-homepage', url),
    crawlMultiplePages: (url: string, options?: { maxPages?: number; includePages?: string[] }) => ipcRenderer.invoke('web-crawl-multiple-pages', url, options),
    generateBusinessIdentity: (websiteText: string, rootUrl?: string, language?: string) => ipcRenderer.invoke('ai-search-generate-business-identity', websiteText, rootUrl, language),
    generateSnsPlan: (identityData: any) => ipcRenderer.invoke('ai-search-generate-sns-plan', identityData),
    fullResearch: (domain: string, inquiryData?: any, options?: any) => ipcRenderer.invoke('company-research-full-process', domain, inquiryData, options),
    db: {
      save: (record: any) => ipcRenderer.invoke('company-research-db-save', record),
      getAll: () => ipcRenderer.invoke('company-research-db-get-all'),
      getById: (id: string) => ipcRenderer.invoke('company-research-db-get-by-id', id),
      update: (id: string, updates: any) => ipcRenderer.invoke('company-research-db-update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('company-research-db-delete', id),
      findByDomain: (domain: string) => ipcRenderer.invoke('company-research-db-find-by-domain', domain),
      hasRecent: (domain: string, hoursAgo?: number) => ipcRenderer.invoke('company-research-db-has-recent', domain, hoursAgo),
      getLatestCompleted: (domain: string) => ipcRenderer.invoke('company-research-db-get-latest-completed', domain),
    },
  } as WebUtilitiesAPI,
  
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
    deletePost: (connectionId: string, postId: number) =>
      ipcRenderer.invoke('wp-delete-post', connectionId, postId),
    clearAllData: () => ipcRenderer.invoke('sqlite-wordpress-clear-all'),
    clearSiteData: (siteId: string) => ipcRenderer.invoke('sqlite-wordpress-clear-site', siteId),
    checkSite: (url: string) =>
      ipcRenderer.invoke('wp-check-site-status', url),
  } as WordPressAPI,
  
  // ========================================================================
  // NAVER BLOG MANAGEMENT
  // ========================================================================
  
  /**
   * Naver Blog connection management API
   */
  naver: {
    saveConnection: (connection: NaverConnection) =>
      ipcRenderer.invoke('naver-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('naver-get-connections'),
    deleteConnection: (connectionId: string) =>
      ipcRenderer.invoke('naver-delete-connection', connectionId),
    updateConnection: (
      connectionId: string,
      updates: Partial<NaverConnection>,
    ) => ipcRenderer.invoke('naver-update-connection', connectionId, updates),
    testConnection: (connection: NaverConnection) =>
      ipcRenderer.invoke('naver-test-connection', connection),
  } as NaverAPI,
  
  // ========================================================================
  // INSTAGRAM MANAGEMENT
  // ========================================================================
  
  /**
   * Instagram connection management API
   */
  instagram: {
    saveConnection: (connection: InstagramConnection) =>
      ipcRenderer.invoke('instagram-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('instagram-get-connections'),
    deleteConnection: (connectionId: string) =>
      ipcRenderer.invoke('instagram-delete-connection', connectionId),
    updateConnection: (
      connectionId: string,
      updates: Partial<InstagramConnection>,
    ) => ipcRenderer.invoke('instagram-update-connection', connectionId, updates),
    testConnection: (connection: InstagramConnection) =>
      ipcRenderer.invoke('instagram-test-connection', connection),
    fetchPosts: (connectionId: string, options?: { limit?: number; useGraphAPI?: boolean }) =>
      ipcRenderer.invoke('instagram-fetch-posts', connectionId, options),
  } as InstagramAPI,
  
  // ========================================================================
  // YOUTUBE MANAGEMENT
  // ========================================================================
  
  /**
   * YouTube connection management API
   */
  youtube: {
    saveConnection: (connection: YouTubeConnection) =>
      ipcRenderer.invoke('youtube-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('youtube-get-connections'),
    deleteConnection: (connectionId: string) =>
      ipcRenderer.invoke('youtube-delete-connection', connectionId),
    updateConnection: (
      connectionId: string,
      updates: Partial<YouTubeConnection>,
    ) => ipcRenderer.invoke('youtube-update-connection', connectionId, updates),
    testConnection: (connection: YouTubeConnection) =>
      ipcRenderer.invoke('youtube-test-connection', connection),
  } as YouTubeAPI,
  
  // ========================================================================
  // FACEBOOK MANAGEMENT
  // ========================================================================
  
  /**
   * Facebook connection management API
   */
  facebook: {
    saveConnection: (connection: FacebookConnection) =>
      ipcRenderer.invoke('facebook-save-connection', connection),
    getConnections: () => ipcRenderer.invoke('facebook-get-connections'),
    deleteConnection: (connectionId: string) =>
      ipcRenderer.invoke('facebook-delete-connection', connectionId),
    updateConnection: (
      connectionId: string,
      updates: Partial<FacebookConnection>,
    ) => ipcRenderer.invoke('facebook-update-connection', connectionId, updates),
    testConnection: (connection: FacebookConnection) =>
      ipcRenderer.invoke('facebook-test-connection', connection),
  } as FacebookAPI,
  
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
  // BUSINESS IDENTITY STORAGE
  // ========================================================================
  businessIdentity: {
    createSnapshot: (data: any) => ipcRenderer.invoke('sqlite-business-identity-create-snapshot', data),
    getSnapshot: (id: string) => ipcRenderer.invoke('sqlite-business-identity-get-snapshot', id),
    listSnapshots: (brandKey: string) => ipcRenderer.invoke('sqlite-business-identity-list-snapshots', brandKey),
    listSnsPlans: (snapshotId: string) => ipcRenderer.invoke('sqlite-business-identity-list-sns-plans', snapshotId),
    saveSnsPlans: (snapshotId: string, plans: BusinessIdentitySnsPlanInput[]) =>
      ipcRenderer.invoke('sqlite-business-identity-save-sns-plans', { snapshotId, plans }),
    listSnsPlanExecutions: (planId: string) => ipcRenderer.invoke('sqlite-business-identity-list-sns-plan-executions', planId),
    updateAnalysisResults: (snapshotId: string, seoAnalysis: any, sslAnalysis: any) =>
      ipcRenderer.invoke('sqlite-business-identity-update-analysis-results', snapshotId, seoAnalysis, sslAnalysis),
    updateSnsPlanAIKey: (planId: string, aiKeyId: string | null) =>
      ipcRenderer.invoke('sqlite-business-identity-update-sns-plan-ai-key', planId, aiKeyId),
    updateSnsPlanConnection: (planId: string, connectionId: string | null, connectionName: string | null, connectionType: string | null) =>
      ipcRenderer.invoke('sqlite-business-identity-update-sns-plan-connection', planId, connectionId, connectionName, connectionType),
    updateSnsPlanAIKey: (planId: string, aiKeyId: string | null) =>
      ipcRenderer.invoke('sqlite-business-identity-update-sns-plan-ai-key', planId, aiKeyId),
  } as BusinessIdentityAPI,
  
  // ========================================================================
  // TEMPLATE COPIES MANAGEMENT
  // ========================================================================
  
  /**
   * Template copies management API
   */
  templateCopies: {
    create: (data: any) => ipcRenderer.invoke('sqlite-template-copies-create', data),
    get: (id: string) => ipcRenderer.invoke('sqlite-template-copies-get', id),
    getByTemplate: (templateId: string) => ipcRenderer.invoke('sqlite-template-copies-get-by-template', templateId),
    getAll: (limit?: number, offset?: number) => ipcRenderer.invoke('sqlite-template-copies-get-all', limit, offset),
    delete: (id: string) => ipcRenderer.invoke('sqlite-template-copies-delete', id),
    getByScriptId: (scriptId: string) => ipcRenderer.invoke('sqlite-template-copies-get-by-script-id', scriptId),
    updateScriptContent: (scriptId: string, scriptContent: any) => ipcRenderer.invoke('sqlite-template-copies-update-script-content', scriptId, scriptContent),
  } as TemplateCopiesAPI,
  
  // ========================================================================
  // APPSSCRIPT TOOLS
  // ========================================================================
  
  /**
   * AppsScript tools API
   */
  appsScriptTools: {
    listFiles: (scriptId: string) => ipcRenderer.invoke('apps-script-list-files', scriptId),
    readFile: (scriptId: string, fileName: string) => ipcRenderer.invoke('apps-script-read-file', scriptId, fileName),
    writeFile: (scriptId: string, fileName: string, content: string, fileType?: string, conversationId?: string) => ipcRenderer.invoke('apps-script-write-file', scriptId, fileName, content, fileType, conversationId),
    partialEdit: (scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean, conversationId?: string) => ipcRenderer.invoke('apps-script-partial-edit', scriptId, fileName, oldString, newString, expectedReplacements, flexibleMatching, conversationId),
    renameFile: (scriptId: string, oldFileName: string, newFileName: string, conversationId?: string) => ipcRenderer.invoke('apps-script-rename-file', scriptId, oldFileName, newFileName, conversationId),
    deleteFile: (scriptId: string, fileName: string, conversationId?: string) => ipcRenderer.invoke('apps-script-delete-file', scriptId, fileName, conversationId),
    pushToGoogle: (projectId: string, createVersion?: boolean, versionDescription?: string) => ipcRenderer.invoke('apps-script-push-to-google', projectId, createVersion, versionDescription),
    pullFromGoogle: (projectId: string) => ipcRenderer.invoke('apps-script-pull-from-google', projectId),
    listVersions: (projectId: string) => ipcRenderer.invoke('apps-script-list-versions', projectId),
    getVersionContent: (projectId: string, versionNumber: number) => ipcRenderer.invoke('apps-script-get-version-content', projectId, versionNumber),
    runFunction: (scriptId: string, functionName: string, parameters?: any[]) => ipcRenderer.invoke('apps-script-run-function', scriptId, functionName, parameters),
    listTriggers: (projectId: string) => ipcRenderer.invoke('apps-script-list-triggers', projectId),
    // Dev/Prod flow methods
    cloneForDev: (projectId: string) => ipcRenderer.invoke('apps-script-clone-for-dev', projectId),
    pushToDev: (projectId: string, createVersion?: boolean, versionDescription?: string) => ipcRenderer.invoke('apps-script-push-to-dev', projectId, createVersion, versionDescription),
    pullFromDev: (projectId: string) => ipcRenderer.invoke('apps-script-pull-from-dev', projectId),
    pushDevToProd: (projectId: string, createVersion?: boolean, versionDescription?: string) => ipcRenderer.invoke('apps-script-push-dev-to-prod', projectId, createVersion, versionDescription),
    pullProdToDev: (projectId: string) => ipcRenderer.invoke('apps-script-pull-prod-to-dev', projectId),
  } as AppsScriptToolsAPI,
  
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
    migrateTasksToSQLite: () => ipcRenderer.invoke('sqlite-migrate-tasks-from-store'),
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
    debugPHP: () => ipcRenderer.invoke('wp-server-debug-php'),
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
    getClickEvents: (windowId: number) =>
      ipcRenderer.invoke('browser-window-get-click-events', windowId),
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
   * Ollama management API
   */
  ollama: {
    checkInstalled: () => ipcRenderer.invoke('ollama-check-installed'),
    ensure: () => ipcRenderer.invoke('ollama-ensure'),
    install: () => ipcRenderer.invoke('ollama-install'),
    start: () => ipcRenderer.invoke('ollama-start'),
    pullModel: (model: string) => ipcRenderer.invoke('ollama-pull-model', model),
    hasModel: (model: string) => ipcRenderer.invoke('ollama-has-model', model),
  } as OllamaAPI,
  
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
   * EGChatting data management API
   */
  egChatting: {
    // Conversations
    getConversations: () => ipcRenderer.invoke('egchatting-get-conversations'),
    createConversation: (title: string, summary?: string) => ipcRenderer.invoke('egchatting-create-conversation', title, summary),
    deleteConversation: (id: string) => ipcRenderer.invoke('egchatting-delete-conversation', id),
    updateConversation: (id: string, updates: any) => ipcRenderer.invoke('egchatting-update-conversation', id, updates),
    
    // Messages
    getMessages: (conversationId: string) => ipcRenderer.invoke('egchatting-get-messages', conversationId),
    addMessage: (message: any) => ipcRenderer.invoke('egchatting-add-message', message),
    deleteMessage: (id: string) => ipcRenderer.invoke('egchatting-delete-message', id),
  },
  
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
    startAutomation: (id?: string, pw?: string, proxy?: string, title?: string, content?: string, tags?: string) => ipcRenderer.invoke('start-automation', { id, pw, proxy, title, content, tags }),
    startWooriAutomation: (id?: string, password?: string, proxy?: string, geminiApiKey?: string) => ipcRenderer.invoke('start-woori-automation', { id, password, proxy, geminiApiKey }),
    launchChrome: () => ipcRenderer.invoke('launch-chrome'),
    launchChromeWithUrl: (url: string, proxy?: string, openDevTools?: boolean, runLighthouse?: boolean) => ipcRenderer.invoke('launch-chrome-with-url', { url, proxy, openDevTools, runLighthouse }),
    launchPlaywrightRecorderEnhanced: (url: string) => ipcRenderer.invoke('launch-playwright-recorder-enhanced', { url }),
    stopPlaywrightRecorderEnhanced: () => ipcRenderer.invoke('stop-playwright-recorder-enhanced'),
    getPlaywrightTests: () => ipcRenderer.invoke('get-playwright-tests'),
    runPlaywrightTest: (testFile: string) => ipcRenderer.invoke('run-playwright-test', { testFile }),
    deletePlaywrightTest: (testPath: string) => ipcRenderer.invoke('delete-playwright-test', { testPath }),
    viewPlaywrightTest: (testPath: string) => ipcRenderer.invoke('view-playwright-test', { testPath }),
    getPlaywrightDownloads: () => ipcRenderer.invoke('get-playwright-downloads'),
    openPlaywrightDownload: (filePath: string) => ipcRenderer.invoke('open-playwright-download', filePath),
    openPlaywrightDownloadsFolder: () => ipcRenderer.invoke('open-playwright-downloads-folder'),
    // Playwright Scheduler API
    getPlaywrightSchedules: () => ipcRenderer.invoke('sqlite-playwright-scheduler-get-all'),
    getPlaywrightScheduleById: (id: string) => ipcRenderer.invoke('sqlite-playwright-scheduler-get', id),
    getPlaywrightScheduleByPath: (testPath: string) => ipcRenderer.invoke('sqlite-playwright-scheduler-get-by-path', testPath),
    createPlaywrightSchedule: (data: any) => ipcRenderer.invoke('sqlite-playwright-scheduler-create', data),
    updatePlaywrightSchedule: (id: string, updates: any) => ipcRenderer.invoke('sqlite-playwright-scheduler-update', id, updates),
    deletePlaywrightSchedule: (id: string) => ipcRenderer.invoke('sqlite-playwright-scheduler-delete', id),
    togglePlaywrightSchedule: (id: string, enabled: boolean) => ipcRenderer.invoke('sqlite-playwright-scheduler-toggle', id, enabled),
    runPlaywrightScheduleNow: (testId: string) => ipcRenderer.invoke('sqlite-playwright-scheduler-run-now', testId),
    getPlaywrightScheduleStatus: () => ipcRenderer.invoke('sqlite-playwright-scheduler-status'),
    openInstagramWithProfile: (options: {
      planId?: string;
      profilePath?: string;
      profileDirectory?: string;
      profileRoot?: string;
      targetUrl?: string;
      username?: string;
      password?: string;
      imagePath?: string;
      caption?: string;
      waitAfterShare?: number;
      structuredPrompt?: Record<string, any> | string;
    }) => ipcRenderer.invoke('open-instagram-with-profile', options),
    testYouTubeUpload: (options: {
      username?: string;
      password?: string;
      chromeUserDataDir?: string;
      chromeExecutablePath?: string;
      videoPath: string;
      title: string;
      description?: string;
      tags?: string[];
      visibility?: 'public' | 'unlisted' | 'private';
    }) => ipcRenderer.invoke('test-youtube-upload', options),
    pickVideoFile: () => ipcRenderer.invoke('pick-video-file'),
    pickImageFile: () => ipcRenderer.invoke('pick-image-file'),
    testFacebookPost: (options: {
      username: string;
      password: string;
      imagePath?: string;
      text?: string;
    }) => ipcRenderer.invoke('test-facebook-post', options),
    pickChromeProfileFolder: () => ipcRenderer.invoke('pick-chrome-profile-folder'),
    listChromeProfiles: () => ipcRenderer.invoke('list-chrome-profiles'),
    crawlWebsite: (url: string, proxy?: string, openDevTools?: boolean) => ipcRenderer.invoke('crawl-website', { url, proxy, openDevTools }),
    generateLighthouseReports: (urls: string[], proxy?: string) => ipcRenderer.invoke('generate-lighthouse-reports', { urls, proxy }),
    testPasteComponent: () => ipcRenderer.invoke('test-paste-component'),
  },

  /**
   * Finance Hub API
   */
  financeHub: {
    openBrowser: (bankId: string, proxyUrl?: string) =>
      ipcRenderer.invoke('finance-hub:open-browser', { bankId, proxyUrl }),
    login: (bankId: string, credentials: BankCredentials, proxyUrl?: string) =>
      ipcRenderer.invoke('finance-hub:login', { bankId, credentials, proxyUrl }),
    getAccounts: (bankId: string, credentials?: BankCredentials, proxyUrl?: string) =>
      ipcRenderer.invoke('finance-hub:get-accounts', { bankId, credentials, proxyUrl }),
    getTransactions: (bankId: string, accountNumber: string, startDate: string, endDate: string, parse?: boolean) =>
      ipcRenderer.invoke('finance-hub:get-transactions', { bankId, accountNumber, startDate, endDate, parse }),
    loginAndGetAccounts: (bankId: string, credentials: BankCredentials, proxyUrl?: string) =>
      ipcRenderer.invoke('finance-hub:login-and-get-accounts', { bankId, credentials, proxyUrl }),
    getConnectedBanks: () =>
      ipcRenderer.invoke('finance-hub:get-connected-banks'),
    disconnect: (bankId: string) =>
      ipcRenderer.invoke('finance-hub:disconnect', bankId),
    saveCredentials: (bankId: string, credentials: BankCredentials) =>
      ipcRenderer.invoke('finance-hub:save-credentials', { bankId, credentials }),
    getSavedCredentials: (bankId: string) =>
      ipcRenderer.invoke('finance-hub:get-saved-credentials', bankId),
    removeCredentials: (bankId: string) =>
      ipcRenderer.invoke('finance-hub:remove-credentials', bankId),
    getPersistentSpreadsheet: () =>
      ipcRenderer.invoke('finance-hub:get-persistent-spreadsheet'),
    savePersistentSpreadsheet: (spreadsheetInfo: any) =>
      ipcRenderer.invoke('finance-hub:save-persistent-spreadsheet', spreadsheetInfo),
    clearPersistentSpreadsheet: () =>
      ipcRenderer.invoke('finance-hub:clear-persistent-spreadsheet'),
  },

  /**
   * Finance Hub Database API
   */
  financeHubDb: {
    getAllBanks: () => ipcRenderer.invoke('sqlite-financehub-get-all-banks'),
    getAllAccounts: () => ipcRenderer.invoke('sqlite-financehub-get-all-accounts'),
    getAccountsByBank: (bankId: string) => ipcRenderer.invoke('sqlite-financehub-get-accounts-by-bank', bankId),
    queryTransactions: (options: any) => ipcRenderer.invoke('sqlite-financehub-query-transactions', options),
    getTransactionStats: (options: any) => ipcRenderer.invoke('sqlite-financehub-get-transaction-stats', options),
    getMonthlySummary: (options: any) => ipcRenderer.invoke('sqlite-financehub-get-monthly-summary', options),
    getOverallStats: () => ipcRenderer.invoke('sqlite-financehub-get-overall-stats'),
    getRecentSyncOperations: (limit?: number) => ipcRenderer.invoke('sqlite-financehub-get-recent-sync-operations', limit),
    upsertAccount: (accountData: any) => ipcRenderer.invoke('sqlite-financehub-upsert-account', accountData),
    importTransactions: (bankId: string, accountData: any, transactionsData: any[], syncMetadata: any) => 
      ipcRenderer.invoke('sqlite-financehub-import-transactions', bankId, accountData, transactionsData, syncMetadata),
    updateAccountStatus: (accountNumber: string, isActive: boolean) => 
      ipcRenderer.invoke('sqlite-financehub-update-account-status', accountNumber, isActive),
    deleteAccount: (accountNumber: string) => 
      ipcRenderer.invoke('sqlite-financehub-delete-account', accountNumber),
  },
  /**
   * Finance Hub Scheduler API
   */
  financeHubScheduler: {
    getSettings: () => ipcRenderer.invoke('finance-hub:scheduler:get-settings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('finance-hub:scheduler:update-settings', settings),
    start: () => ipcRenderer.invoke('finance-hub:scheduler:start'),
    stop: () => ipcRenderer.invoke('finance-hub:scheduler:stop'),
    syncNow: () => ipcRenderer.invoke('finance-hub:scheduler:sync-now'),
    getLastSyncInfo: () => ipcRenderer.invoke('finance-hub:scheduler:last-sync-info'),
    // Event listeners
    onSyncStarted: (callback: () => void) => {
      ipcRenderer.on('finance-hub:scheduler:sync-started', callback);
      return () => ipcRenderer.removeListener('finance-hub:scheduler:sync-started', callback);
    },
    onSyncCompleted: (callback: (data: any) => void) => {
      ipcRenderer.on('finance-hub:scheduler:sync-completed', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('finance-hub:scheduler:sync-completed');
    },
    onSyncFailed: (callback: (data: any) => void) => {
      ipcRenderer.on('finance-hub:scheduler:sync-failed', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('finance-hub:scheduler:sync-failed');
    },
    onSettingsUpdated: (callback: (settings: any) => void) => {
      ipcRenderer.on('finance-hub:scheduler:settings-updated', (event, settings) => callback(settings));
      return () => ipcRenderer.removeAllListeners('finance-hub:scheduler:settings-updated');
    },
  },

  /**
   * MCP Registration API
   */
  mcp: {
    register: (name: string, password?: string) => ipcRenderer.invoke('mcp-register', name, password),
    testConnection: () => ipcRenderer.invoke('mcp-test-connection'),
    registerTunnel: (name: string, password?: string) => ipcRenderer.invoke('mcp-tunnel-register', name, password),
  },

  /**
   * Tunnel Management API
   */
  tunnel: {
    start: (serverName: string, localServerUrl?: string) => ipcRenderer.invoke('mcp-tunnel-start', serverName, localServerUrl),
    stop: (serverName: string) => ipcRenderer.invoke('mcp-tunnel-stop', serverName),
    status: (serverName: string) => ipcRenderer.invoke('mcp-tunnel-status', serverName),
    list: () => ipcRenderer.invoke('mcp-tunnel-list'),
  },

  /**
   * Permission Management API
   */
  permissions: {
    add: (request: {
      server_key: string;
      emails: string[];
      access_level?: 'read_only' | 'read_write' | 'admin';
      expires_at?: string;
      notes?: string;
    }) => ipcRenderer.invoke('mcp-permissions-add', request),
    get: (serverKey: string) => ipcRenderer.invoke('mcp-permissions-get', serverKey),
    update: (permissionId: string, updates: {
      access_level?: 'read_only' | 'read_write' | 'admin';
      expires_at?: string;
      notes?: string;
      status?: 'pending' | 'active' | 'revoked' | 'expired';
    }) => ipcRenderer.invoke('mcp-permissions-update', permissionId, updates),
    revoke: (permissionId: string) => ipcRenderer.invoke('mcp-permissions-revoke', permissionId),
  },

  /**
   * Environment Configuration API
   */
  env: {
    checkConfig: () => ipcRenderer.invoke('env-check-config'),
    getDebugInfo: () => ipcRenderer.invoke('debug-info'),
  },

/**
 * MCP Configuration API
 */
mcpConfig: {
  get: () => ipcRenderer.invoke('mcp-config-get'),
  set: (config: any) => ipcRenderer.invoke('mcp-config-set', config),
  clear: () => ipcRenderer.invoke('mcp-config-clear'),
  servers: {
    get: () => ipcRenderer.invoke('mcp-servers-get'),
    add: (server: any) => ipcRenderer.invoke('mcp-server-add', server),
    update: (serverId: string, updates: any) => ipcRenderer.invoke('mcp-server-update', serverId, updates),
    remove: (serverId: string) => ipcRenderer.invoke('mcp-server-remove', serverId),
  },
  connections: {
    get: () => ipcRenderer.invoke('mcp-connections-get'),
    add: (connection: any) => ipcRenderer.invoke('mcp-connection-add', connection),
    update: (connectionId: string, updates: any) => ipcRenderer.invoke('mcp-connection-update', connectionId, updates),
    remove: (connectionId: string) => ipcRenderer.invoke('mcp-connection-remove', connectionId),
  },
},

/**
 * Gmail MCP API
 */
gmailMCP: {
  fetchDomainUsers: (connectionId: string) => ipcRenderer.invoke('gmail-mcp-fetch-domain-users', connectionId),
  fetchUserMessages: (connectionId: string, userEmail: string, options?: any) => ipcRenderer.invoke('gmail-mcp-fetch-user-messages', connectionId, userEmail, options),
  fetchUserStats: (connectionId: string, userEmail: string) => ipcRenderer.invoke('gmail-mcp-fetch-user-stats', connectionId, userEmail),
  saveUserDataToDatabase: (connectionId: string, userEmail: string, messageRecords: any[], statsRecord: any) => ipcRenderer.invoke('gmail-mcp-save-user-data', connectionId, userEmail, messageRecords, statsRecord),
  fetchMessages: (connectionId: string, options?: any) => ipcRenderer.invoke('gmail-mcp-fetch-messages', connectionId, options),
  fetchStats: (connectionId: string) => ipcRenderer.invoke('gmail-mcp-fetch-stats', connectionId),
  markAsRead: (connectionId: string, messageId: string) => ipcRenderer.invoke('gmail-mcp-mark-as-read', connectionId, messageId),
  deleteMessage: (connectionId: string, messageId: string) => ipcRenderer.invoke('gmail-mcp-delete-message', connectionId, messageId),
  sendReply: (connectionId: string, messageId: string, replyText: string) => ipcRenderer.invoke('gmail-mcp-send-reply', connectionId, messageId, replyText),
  forwardMessage: (connectionId: string, messageId: string, toEmail: string) => ipcRenderer.invoke('gmail-mcp-forward-message', connectionId, messageId, toEmail),
  searchMessages: (connectionId: string, query: string, maxResults?: number) => ipcRenderer.invoke('gmail-mcp-search-messages', connectionId, query, maxResults),
  getMessage: (connectionId: string, messageId: string) => ipcRenderer.invoke('gmail-mcp-get-message', connectionId, messageId),
  testConnection: (connectionId: string) => ipcRenderer.invoke('gmail-mcp-test-connection', connectionId),
},

/**
 * Google Sheets API
 */
sheets: {
  createTransactionsSpreadsheet: (params: { title: string; transactions: any[]; banks: Record<string, any>; accounts: any[] }) => 
    ipcRenderer.invoke('sheets:create-transactions-spreadsheet', params),
  getOrCreateTransactionsSpreadsheet: (params: { transactions: any[]; banks: Record<string, any>; accounts: any[]; persistentSpreadsheetId?: string }) => 
    ipcRenderer.invoke('sheets:get-or-create-transactions-spreadsheet', params),
  createSpreadsheet: (params: { title: string; data?: string[][] }) => 
    ipcRenderer.invoke('sheets:create-spreadsheet', params),
  getSpreadsheet: (spreadsheetId: string) => 
    ipcRenderer.invoke('sheets:get-spreadsheet', spreadsheetId),
  getRange: (params: { spreadsheetId: string; range: string }) => 
    ipcRenderer.invoke('sheets:get-range', params),
  updateRange: (params: { spreadsheetId: string; range: string; values: string[][] }) => 
    ipcRenderer.invoke('sheets:update-range', params),
  importToSQL: (params: { spreadsheetId: string; sheetName?: string }) =>
    ipcRenderer.invoke('sheets:import-to-sql', params),
  getImportedTables: (spreadsheetId: string) =>
    ipcRenderer.invoke('sheets:get-imported-tables', spreadsheetId),
  queryImportedTable: (params: { tableName: string; limit?: number; offset?: number }) =>
    ipcRenderer.invoke('sheets:query-imported-table', params),
},

/**
 * MCP Server Management API
 */
mcpServer: {
  getStatus: () => ipcRenderer.invoke('mcp-server-get-status'),
  build: () => ipcRenderer.invoke('mcp-server-build'),
  configureClaude: () => ipcRenderer.invoke('mcp-server-configure-claude'),
  unconfigureClaude: () => ipcRenderer.invoke('mcp-server-unconfigure-claude'),
  getInstructions: () => ipcRenderer.invoke('mcp-server-get-instructions'),
},

/**
 * HTTPS Server Management API
 */
httpsServer: {
  start: (options: { port: number; keyPath: string; certPath: string }) => ipcRenderer.invoke('https-server-start', options),
  stop: () => ipcRenderer.invoke('https-server-stop'),
  status: () => ipcRenderer.invoke('https-server-status'),
  restart: (options: { port: number; keyPath: string; certPath: string }) => ipcRenderer.invoke('https-server-restart', options),
  getNetworkInfo: () => ipcRenderer.invoke('https-server-get-network-info'),
},

/**
 * SSL Certificate Management API (mkcert)
 */
sslCertificate: {
  generate: (request: { domain: string; email?: string }) => 
    ipcRenderer.invoke('ssl-certificate-generate', request),
  generateForce: (request: { domain: string; email?: string }) => 
    ipcRenderer.invoke('ssl-certificate-generate-force', request),
  list: () => ipcRenderer.invoke('ssl-certificate-list'),
  get: (certificateId: string) => ipcRenderer.invoke('ssl-certificate-get', certificateId),
  delete: (certificateId: string) => ipcRenderer.invoke('ssl-certificate-delete', certificateId),
  cleanup: () => ipcRenderer.invoke('ssl-certificate-cleanup'),
},

/**
 * Authentication API
 */
auth: {
  getSession: () => ipcRenderer.invoke('auth:get-session'),
    signInWithGoogle: (scopes?: string) => ipcRenderer.invoke('auth:sign-in-google', scopes),
  signInWithGithub: () => ipcRenderer.invoke('auth:sign-in-github'),
  signOut: (userId?: string) => ipcRenderer.invoke('auth:sign-out', userId),
  getAllAccounts: () => ipcRenderer.invoke('auth:get-all-accounts'),
  switchAccount: (userId: string) => ipcRenderer.invoke('auth:switch-account', userId),
  handleCallback: (url: string) => ipcRenderer.invoke('auth:handle-callback', url),
    getGoogleWorkspaceToken: () => ipcRenderer.invoke('auth:get-google-workspace-token'),
  saveSession: (session: any) => ipcRenderer.invoke('auth:save-session', session),
  callEdgeFunction: (options: { url: string; method?: string; body?: any; headers?: Record<string, string> }) =>
    ipcRenderer.invoke('auth:call-edge-function', options),
  onAuthStateChanged: (callback: (data: { success: boolean; session: any | null; user: any | null }) => void) => {
    const subscription = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('auth:state-changed', subscription);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('auth:state-changed', subscription);
    };
  },
},
  /**
   * Google Workspace API
   */
  workspace: {
    createSpreadsheet: (title: string) => ipcRenderer.invoke('workspace:create-spreadsheet', title),
    addAppsScript: (spreadsheetId: string, scriptCode: string, scriptTitle?: string) =>
      ipcRenderer.invoke('workspace:add-apps-script', spreadsheetId, scriptCode, scriptTitle),
    createSpreadsheetWithScript: (title: string, scriptCode: string, scriptTitle?: string) =>
      ipcRenderer.invoke('workspace:create-spreadsheet-with-script', title, scriptCode, scriptTitle),
    getSpreadsheet: (spreadsheetId: string) => ipcRenderer.invoke('workspace:get-spreadsheet', spreadsheetId),
    executeScript: (scriptId: string, functionName: string, parameters?: any[]) =>
      ipcRenderer.invoke('workspace:execute-script', scriptId, functionName, parameters),
    copyTemplateContent: (templateContent: any) =>
      ipcRenderer.invoke('workspace:copy-template-content', templateContent),
  } as WorkspaceAPI,

  // ========================================================================
  // EGDESK DEV SPREADSHEET
  // ========================================================================
  /**
   * EGDesk Dev Spreadsheet management for development environment sync
   */
  egdeskDev: {
    // Configuration
    getConfig: () => ipcRenderer.invoke('egdesk-dev-config-get'),
    setConfig: (config: EGDeskDevConfig) => ipcRenderer.invoke('egdesk-dev-config-set', config),
    clearConfig: () => ipcRenderer.invoke('egdesk-dev-config-clear'),
    
    // Dev Folder
    getDevFolder: () => ipcRenderer.invoke('egdesk-dev-folder-get'),
    createDevFolder: () => ipcRenderer.invoke('egdesk-dev-folder-create'),
    
    // Spreadsheet operations
    createDevSpreadsheet: () => ipcRenderer.invoke('egdesk-dev-spreadsheet-create'),
    validateSchema: () => ipcRenderer.invoke('egdesk-validate-schema'),
    compareSchemas: () => ipcRenderer.invoke('egdesk-compare-schemas'),
    syncPublicToDev: (createBackup?: boolean) => ipcRenderer.invoke('egdesk-sync-public-to-dev', createBackup),
    syncDevToPublic: (createBackup?: boolean) => ipcRenderer.invoke('egdesk-sync-dev-to-public', createBackup),
    applyMergeResolution: (targetSpreadsheet: 'public' | 'dev', resolvedRows: SpreadsheetRow[]) => 
      ipcRenderer.invoke('egdesk-apply-merge-resolution', targetSpreadsheet, resolvedRows),
    fetchSpreadsheetRows: (spreadsheetId: string, sheetName?: string) => 
      ipcRenderer.invoke('egdesk-fetch-spreadsheet-rows', spreadsheetId, sheetName),
    createBackup: (spreadsheetId: string) => ipcRenderer.invoke('egdesk-create-backup', spreadsheetId),
  } as EGDeskDevAPI,

  // ========================================================================
  // SHELL UTILITIES
  // ========================================================================
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell-open-path', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell-open-external', url),
  },

  // ========================================================================
  // DOCKER MANAGEMENT
  // ========================================================================
  /**
   * Docker container and image management API
   */
  docker: {
    // Connection
    checkConnection: () => ipcRenderer.invoke('docker:check-connection'),
    getInfo: () => ipcRenderer.invoke('docker:info'),

    // Containers
    listContainers: (options?: { all?: boolean }) =>
      ipcRenderer.invoke('docker:list-containers', options),
    getContainer: (containerId: string) =>
      ipcRenderer.invoke('docker:get-container', containerId),
    startContainer: (containerId: string) =>
      ipcRenderer.invoke('docker:start-container', containerId),
    stopContainer: (containerId: string) =>
      ipcRenderer.invoke('docker:stop-container', containerId),
    restartContainer: (containerId: string) =>
      ipcRenderer.invoke('docker:restart-container', containerId),
    removeContainer: (containerId: string, options?: { force?: boolean; v?: boolean }) =>
      ipcRenderer.invoke('docker:remove-container', containerId, options),
    getContainerLogs: (containerId: string, options?: { follow?: boolean; stdout?: boolean; stderr?: boolean; tail?: number }) =>
      ipcRenderer.invoke('docker:container-logs', containerId, options),
    getContainerStats: (containerId: string) =>
      ipcRenderer.invoke('docker:container-stats', containerId),
    execInContainer: (containerId: string, cmd: string[]) =>
      ipcRenderer.invoke('docker:exec', containerId, cmd),

    // Images
    listImages: () => ipcRenderer.invoke('docker:list-images'),
    pullImage: (imageName: string) =>
      ipcRenderer.invoke('docker:pull-image', imageName),
    removeImage: (imageId: string) =>
      ipcRenderer.invoke('docker:remove-image', imageId),

    // Create
    createContainer: (options: any) =>
      ipcRenderer.invoke('docker:create-container', options),

    // Networks & Volumes
    listNetworks: () => ipcRenderer.invoke('docker:list-networks'),
    listVolumes: () => ipcRenderer.invoke('docker:list-volumes'),

    // Events
    onPullProgress: (callback: (data: { imageName: string; status?: string; progress?: string }) => void) => {
      const subscription = (_event: IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('docker:pull-progress', subscription);
      return () => ipcRenderer.removeListener('docker:pull-progress', subscription);
    },

    // Scheduler
    scheduler: {
      getAll: () => ipcRenderer.invoke('sqlite-docker-scheduler-get-all'),
      get: (id: string) => ipcRenderer.invoke('sqlite-docker-scheduler-get', id),
      create: (data: any) => ipcRenderer.invoke('sqlite-docker-scheduler-create', data),
      update: (id: string, updates: any) => ipcRenderer.invoke('sqlite-docker-scheduler-update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('sqlite-docker-scheduler-delete', id),
      toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('sqlite-docker-scheduler-toggle', id, enabled),
      getEnabled: () => ipcRenderer.invoke('sqlite-docker-scheduler-get-enabled'),
      getExecutions: (taskId: string, limit?: number) => ipcRenderer.invoke('sqlite-docker-scheduler-get-executions', taskId, limit),
      getRecentExecutions: (limit?: number) => ipcRenderer.invoke('sqlite-docker-scheduler-get-recent-executions', limit),
      runNow: (taskId: string) => ipcRenderer.invoke('sqlite-docker-scheduler-run-now', taskId),
      getStatus: () => ipcRenderer.invoke('sqlite-docker-scheduler-status'),
      restart: () => ipcRenderer.invoke('sqlite-docker-scheduler-restart'),
    },
  },

  // ========================================================================
  // FULL DISK ACCESS (macOS)
  // ========================================================================
  /**
   * Full Disk Access API for macOS
   */
  fullDiskAccess: {
    check: () => ipcRenderer.invoke('check-full-disk-access'),
    request: () => ipcRenderer.invoke('request-full-disk-access'),
  },

  // ========================================================================
  // AUTO-UPDATER
  // ========================================================================
  /**
   * Auto-updater API
   */
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('app-updater-check'),
    downloadUpdate: () => ipcRenderer.invoke('app-updater-download'),
    quitAndInstall: () => ipcRenderer.invoke('app-updater-quit-and-install'),
    onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(args[0] as any);
      ipcRenderer.on('update-available', subscription);
      return () => ipcRenderer.removeListener('update-available', subscription);
    },
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(args[0] as any);
      ipcRenderer.on('update-download-progress', subscription);
      return () => ipcRenderer.removeListener('update-download-progress', subscription);
    },
    onUpdateDownloaded: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(args[0] as any);
      ipcRenderer.on('update-downloaded', subscription);
      return () => ipcRenderer.removeListener('update-downloaded', subscription);
    },
    onUpdateError: (callback: (error: { message: string }) => void) => {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => callback(args[0] as any);
      ipcRenderer.on('update-error', subscription);
      return () => ipcRenderer.removeListener('update-error', subscription);
    },
  },

  // ========================================================================
  // GENERIC IPC INVOKE METHOD
  // ========================================================================
  /**
   * Generic invoke method for any IPC channel
   */
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
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

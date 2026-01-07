// Define the shapes of the APIs exposed from the main process to the renderer process.
// This file is compiled into the renderer process and provides type safety for `window.electron`.

/**
 * Interface for the IPC Renderer API.
 */
interface IpcRendererAPI {
  sendMessage(channel: string, ...args: unknown[]): void;
  on(channel: string, func: (...args: unknown[]) => void): (() => void) | undefined;
  once(channel: string, func: (...args: unknown[]) => void): void;
}

/**
 * Interface for various version information.
 */
interface VersionsAPI {
  electron: string;
  node: string;
  chrome: string;
  app: string;
}

/**
 * Interface for File System operations.
 */
interface FileSystemAPI {
  readDirectory: (path: string) => Promise<{ success: boolean; items?: any[]; error?: string }>;
  getFileInfo: (path: string) => Promise<{ success: boolean; info?: any; error?: string }>;
  getHomeDirectory: () => Promise<string>;
  getSystemDirectories: () => Promise<any[]>;
  createFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
  deleteItem: (path: string) => Promise<{ success: boolean; error?: string }>;
  renameItem: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  pickFolder: () => Promise<{ success: boolean; folderPath?: string; error?: string }>;
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  writeFileWithParams: (params: any) => Promise<any>;
  writeFileSimple: (filePath: string, content: string) => Promise<any>;
  joinPaths: (...paths: string[]) => Promise<{ success: boolean; joinedPath?: string; error?: string }>;
}

/**
 * Interface for Web Utilities.
 */
interface WebUtilitiesAPI {
  fetchContent: (url: string) => Promise<{ success: boolean; content?: any; error?: string }>;
  crawlHomepage: (url: string) => Promise<{ success: boolean; homepageUrl: string; navigation?: any; discoveredPages?: any; allInternalLinks?: string[]; error?: string }>;
  crawlMultiplePages: (url: string, options?: { maxPages?: number; includePages?: string[] }) => Promise<{ success: boolean; domain: string; baseUrl: string; pages: any[]; siteStructure: any; combinedContent: any; error?: string }>;
  generateBusinessIdentity: (websiteText: string, rootUrl?: string, language?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  generateSnsPlan: (identityData: any) => Promise<{ success: boolean; content?: string; error?: string }>;
  fullResearch: (domain: string, inquiryData?: any, options?: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  db: {
    save: (record: any) => Promise<any>;
    getAll: () => Promise<any>;
    getById: (id: string) => Promise<any>;
    delete: (id: string) => Promise<any>;
    findByDomain: (domain: string) => Promise<any>;
    hasRecent: (domain: string, hoursAgo?: number) => Promise<{ success: boolean; hasRecent: boolean; error?: string; }>;
    getLatestCompleted: (domain: string) => Promise<{ success: boolean; data?: any; error?: string; }>;
  };
}

/**
 * Interface for WordPress API.
 */
interface WordPressAPI {
  saveConnection: (connection: any) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  updateConnection: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; error?: string }>;
  notifySyncCompletion: (syncData: any) => Promise<{ success: boolean; error?: string }>;
  navigateToSyncedFolder: (navigationData: { syncPath: string; connectionName: string }) => Promise<{ success: boolean; error?: string }>;
  syncCreateFolders: (basePath: string) => Promise<{ success: boolean; error?: string }>;
  syncSavePost: (filePath: string, content: string) => Promise<{ success: boolean; size?: number; error?: string }>;
  syncDownloadMedia: (mediaUrl: string, filePath: string) => Promise<{ success: boolean; size?: number; error?: string }>;
  createSyncOperation: (operationData: any) => Promise<{ success: boolean; operationId?: string; error?: string }>;
  updateSyncOperation: (operationId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  savePost: (postData: any) => Promise<{ success: boolean; size?: number; error?: string }>;
  downloadMedia: (mediaData: any) => Promise<{ success: boolean; size?: number; error?: string }>;
  getPosts: (siteId: string, limit?: number, offset?: number) => Promise<{ success: boolean; posts?: any[]; error?: string }>;
  getMedia: (siteId: string, limit?: number, offset?: number) => Promise<{ success: boolean; media?: any[]; error?: string }>;
  getSyncOperations: (siteId: string, limit?: number) => Promise<{ success: boolean; operations?: any[]; error?: string }>;
  getSyncStats: (siteId: string) => Promise<{ success: boolean; stats?: any; error?: string }>;
  addSyncFileDetail: (fileDetailData: any) => Promise<{ success: boolean; fileDetailId?: string; error?: string }>;
  updateSyncFileDetail: (fileDetailId: string, status: string, errorMessage?: string) => Promise<{ success: boolean; error?: string }>;
  getSyncFileDetails: (operationId: string) => Promise<{ success: boolean; fileDetails?: any[]; error?: string }>;
  exportToFiles: (exportOptions: any) => Promise<{ success: boolean; exportedFiles?: string[]; totalSize?: number; error?: string }>;
  fetchPosts: (connectionId: string, options?: any) => Promise<{ success: boolean; posts?: any[]; total?: number; error?: string }>;
  fetchAllPosts: (connectionId: string, options?: any) => Promise<{ success: boolean; totalPosts?: number; error?: string }>;
  fetchMedia: (connectionId: string, options?: any) => Promise<{ success: boolean; media?: any[]; total?: number; error?: string }>;
  fetchAllMedia: (connectionId: string, options?: any) => Promise<{ success: boolean; totalMedia?: number; error?: string }>;
  fetchComments: (connectionId: string, options?: any) => Promise<{ success: boolean; comments?: any[]; total?: number; error?: string }>;
  fetchAllComments: (connectionId: string, options?: any) => Promise<{ success: boolean; totalComments?: number; error?: string }>;
  getComments: (connectionId: string, limit?: number, offset?: number) => Promise<{ success: boolean; comments?: any[]; error?: string }>;
  updateCommentStatus: (connectionId: string, commentId: number, status: string) => Promise<{ success: boolean; error?: string }>;
  deleteComment: (connectionId: string, commentId: number) => Promise<{ success: boolean; error?: string }>;
  deletePost: (connectionId: string, postId: number) => Promise<{ success: boolean; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
  clearSiteData: (siteId: string) => Promise<{ success: boolean; error?: string }>;
  checkSite: (url: string) => Promise<{ success: boolean; status?: 'online' | 'offline'; responseTime?: number; error?: string; content?: string }>;
}

/**
 * Interface for Naver API.
 */
interface NaverAPI {
  saveConnection: (connection: any) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  updateConnection: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; error?: string }>;
  testConnection: (connection: any) => Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Interface for Instagram API.
 */
interface InstagramAPI {
  saveConnection: (connection: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  updateConnection: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  testConnection: (connection: any) => Promise<{ success: boolean; message?: string; error?: string }>;
  fetchPosts: (connectionId: string, options?: { limit?: number; useGraphAPI?: boolean }) => Promise<{ success: boolean; posts?: any[]; error?: string }>;
}

/**
 * Interface for YouTube API.
 */
interface YouTubeAPI {
  saveConnection: (connection: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  updateConnection: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  testConnection: (connection: any) => Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Interface for Facebook API.
 */
interface FacebookAPI {
  saveConnection: (connection: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  getConnections: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  deleteConnection: (connectionId: string) => Promise<{ success: boolean; connections?: any[]; error?: string }>;
  updateConnection: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; connections?: any[]; error?: string }>;
  testConnection: (connection: any) => Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Interface for Scheduled Posts API.
 */
interface ScheduledPostsAPI {
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
 * Interface for Business Identity API.
 */
interface BusinessIdentityAPI {
    createSnapshot: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    getSnapshot: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    listSnapshots: (brandKey: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  listSnsPlans: (snapshotId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  saveSnsPlans: (snapshotId: string, plans: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
    listSnsPlanExecutions: (planId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  updateAnalysisResults: (snapshotId: string, seoAnalysis: any, sslAnalysis: any) => Promise<{ success: boolean; error?: string }>;
  updateSnsPlanAIKey: (planId: string, aiKeyId: string | null) => Promise<{ success: boolean; error?: string }>;
  updateSnsPlanConnection: (planId: string, connectionId: string | null, connectionName: string | null, connectionType: string | null) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for Template Copies API.
 */
interface TemplateCopiesAPI {
    create: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getByTemplate: (templateId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getAll: (limit?: number, offset?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getByScriptId: (scriptId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateScriptContent: (scriptId: string, scriptContent: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}
  
/**
 * Interface for Apps Script Tools API.
 */
interface AppsScriptToolsAPI {
    listFiles: (scriptId: string) => Promise<{ success: boolean; data?: Array<{name: string; type: string; hasSource: boolean}>; error?: string }>;
    readFile: (scriptId: string, fileName: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    writeFile: (scriptId: string, fileName: string, content: string, fileType?: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    partialEdit: (scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    renameFile: (scriptId: string, oldFileName: string, newFileName: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    deleteFile: (scriptId: string, fileName: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  pushToGoogle: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; versionNumber?: number }; error?: string }>;
  pullFromGoogle: (projectId: string) => Promise<{ success: boolean; data?: { success: boolean; message: string; fileCount: number }; error?: string }>;
  listVersions: (projectId: string) => Promise<{ success: boolean; data?: Array<{ versionNumber: number; description?: string; createTime: string }>; error?: string }>;
  getVersionContent: (projectId: string, versionNumber: number) => Promise<{ success: boolean; data?: { files: Array<{ name: string; type: string; source: string }>; versionNumber: number }; error?: string }>;
  runFunction: (scriptId: string, functionName: string, parameters?: any[]) => Promise<{ success: boolean; data?: { response?: { result?: any }; logs?: string[] }; error?: string }>;
  listTriggers: (projectId: string) => Promise<{ success: boolean; data?: Array<{ triggerId: string; functionName: string; eventSource: any }>; error?: string }>;
    cloneForDev: (projectId: string) => Promise<{ success: boolean; data?: { devScriptId: string; devSpreadsheetId?: string; devSpreadsheetUrl?: string; message: string }; error?: string }>;
    pushToDev: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { message: string; versionNumber?: number }; error?: string }>;
    pullFromDev: (projectId: string) => Promise<{ success: boolean; data?: { message: string; fileCount: number }; error?: string }>;
    pushDevToProd: (projectId: string, createVersion?: boolean, versionDescription?: string) => Promise<{ success: boolean; data?: { message: string; versionNumber?: number }; error?: string }>;
    pullProdToDev: (projectId: string) => Promise<{ success: boolean; data?: { message: string; fileCount: number }; error?: string }>;
}

/**
 * Interface for Sync API.
 */
interface SyncAPI {
  saveHistory: (syncData: any) => Promise<{ success: boolean; syncRecord?: any; error?: string }>;
  updateProgress: (syncId: string, progressData: any) => Promise<{ success: boolean; syncRecord?: any; error?: string }>;
  complete: (syncId: string, completionData: any) => Promise<{ success: boolean; syncRecord?: any; error?: string }>;
  getHistory: (connectionId?: string) => Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
  getFileStatus: (connectionId: string, filePath: string) => Promise<{ success: boolean; fileStatus?: any; lastSync?: string; syncPath?: string; error?: string }>;
  clearHistory: (connectionId?: string) => Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
}

/**
 * Interface for Preferences API.
 */
interface PreferencesAPI {
  get: () => Promise<{ success: boolean; preferences?: any; error?: string }>;
  set: (preferences: any) => Promise<{ success: boolean; error?: string }>;
  getStoreInfo: () => Promise<any>;
}

/**
 * Interface for Store API.
 */
interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  clearWordPressConfig: () => Promise<{ success: boolean; error?: string }>;
  migrateTasksToSQLite: () => Promise<any>;
}

/**
 * Interface for SSL Analysis API.
 */
interface SSLAnalysisAPI {
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
 * Interface for WordPress Server API.
 */
interface WordPressServerAPI {
  analyzeFolder: (folderPath: string) => Promise<{ success: boolean; info?: any; error?: string }>;
  startServer: (folderPath: string, port?: number) => Promise<{ success: boolean; port?: number; phpInfo?: any; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  getServerStatus: () => Promise<{ success: boolean; status?: any; error?: string }>;
  pickFolder: () => Promise<{ success: boolean; folderPath?: string; error?: string }>;
  getPHPInfo: () => Promise<{ success: boolean; phpInfo?: any; error?: string }>;
  debugPHP: () => Promise<any>;
}

/**
 * Interface for Browser Window API.
 */
interface BrowserWindowAPI {
  createWindow: (options: any) => Promise<{ success: boolean; windowId?: number; error?: string }>;
  closeWindow: (windowId: number) => Promise<{ success: boolean; error?: string }>;
  loadURL: (windowId: number, url: string) => Promise<{ success: boolean; error?: string }>;
  switchURL: (url: string, windowId?: number) => Promise<{ success: boolean; error?: string }>;
  reload: (windowId: number) => Promise<{ success: boolean; error?: string }>;
  refreshAllLocalhost: () => Promise<{ success: boolean; refreshedCount?: number; error?: string }>;
  getAllLocalhostWindows: () => Promise<{ success: boolean; windows?: Array<{ windowId: number; url: string; isVisible: boolean }>; error?: string }>;
  launchExternalBrowser: (browserType: string, url: string) => Promise<{ success: boolean; process?: any; error?: string }>;
  closeExternalBrowser: (pid: number) => Promise<{ success: boolean; error?: string }>;
  navigateExternalBrowser: (pid: number, url: string) => Promise<{ success: boolean; error?: string }>;
  getClickEvents: (windowId: number) => Promise<{ success: boolean; clickEvents?: any[]; error?: string }>;
  onUrlChanged: (windowId: number, callback: (url: string) => void) => () => void;
  onClosed: (windowId: number, callback: () => void) => () => void;
}

/**
 * Interface for Main Window API.
 */
interface MainWindowAPI {
  getBounds: () => Promise<{ success: boolean; bounds?: any; error?: string }>;
  setBounds: (bounds: any) => Promise<{ success: boolean; error?: string }>;
  setSize: (width: number, height: number) => Promise<{ success: boolean; error?: string }>;
  setPosition: (x: number, y: number) => Promise<{ success: boolean; error?: string }>;
  getWorkArea: () => Promise<{ success: boolean; workArea?: { x: number; y: number; width: number; height: number }; error?: string }>;
}

/**
 * Interface for Script Execution API.
 */
interface ScriptExecutionAPI {
  executeNodeScript: (scriptPath: string, args?: string[], environment?: Record<string, string>) => Promise<{ success: boolean; exitCode: number | null; stdout: string; stderr: string; error?: string }>;
}

/**
 * Interface for AI Service API.
 */
interface AIServiceAPI {
  configure: (config: any) => Promise<boolean>;
  isConfigured: () => Promise<boolean>;
  startAutonomousConversation: (message: string, options: any) => Promise<{ conversationId: string }>;
  conversationReady: (conversationId: string) => Promise<boolean>;
  cancelConversation: () => Promise<boolean>;
  getConversationState: () => Promise<any>;
  getHistory: () => Promise<any[]>;
  clearHistory: () => Promise<void>;
  getAvailableModels: () => Promise<string[]>;
  confirmTool: (requestId: string, approved: boolean) => Promise<any>;
  getToolDefinitions: () => Promise<any[]>;
  simpleAI: {
    configure: (config: any) => Promise<boolean>;
    isConfigured: () => Promise<boolean>;
  };
}

/**
 * Interface for Project Context API.
 */
interface ProjectContextAPI {
  updateContext: (context: any) => Promise<boolean>;
  getCurrentProject: () => Promise<any>;
  getContext: () => Promise<any>;
}

/**
 * Interface for Ollama API.
 */
interface OllamaAPI {
  checkInstalled: () => Promise<{ success: boolean; installed?: boolean; message?: string; error?: string }>;
  ensure: () => Promise<{ success: boolean; installed?: boolean; message?: string; error?: string }>;
  install: () => Promise<{ success: boolean; installed?: boolean; message?: string; error?: string }>;
  start: () => Promise<{ success: boolean; started?: boolean; installed?: boolean; message?: string; error?: string }>;
  pullModel: (model: string) => Promise<{ success: boolean; model?: string; message?: string; error?: string }>;
  hasModel: (model: string) => Promise<{ success: boolean; model?: string; exists?: boolean; error?: string }>;
}

/**
 * Interface for AI Chat Data API.
 */
interface AIChatDataAPI {
  getConversations: (options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConversationWithMessages: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createConversation: (conversationData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateConversation: (conversationId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  archiveConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  restoreConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  getMessages: (conversationId: string, options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  addMessage: (messageData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  addMessages: (messagesData: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateMessage: (messageId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteMessagesInConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConversationStats: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getOverallStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  cleanupOldData: (daysToKeep?: number) => Promise<{ success: boolean; data?: any; error?: string }>;
  clearAllData: () => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for EGChatting API.
 */
interface EgChattingAPI {
  getConversations: () => Promise<any[]>;
  createConversation: (title: string, summary?: string) => Promise<any>;
  deleteConversation: (id: string) => Promise<boolean>;
  updateConversation: (id: string, updates: any) => Promise<boolean>;
  getMessages: (conversationId: string) => Promise<any[]>;
  addMessage: (message: any) => Promise<any>;
  deleteMessage: (id: string) => Promise<boolean>;
}

/**
 * Interface for Backup API.
 */
interface BackupAPI {
  getAvailableBackups: () => Promise<{ success: boolean; backups?: any[]; error?: string }>;
  getBackupStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
  revertConversation: (conversationId: string) => Promise<{ success: boolean; result?: any; error?: string }>;
  revertToConversation: (targetConversationId: string) => Promise<{ success: boolean; summary?: any; error?: string }>;
  cleanupOldBackups: (keepCount?: number) => Promise<{ success: boolean; result?: any; error?: string }>;
}

/**
 * Interface for Photo Management API.
 */
interface PhotosAPI {
  insertIntoProject: (sourceFilePath: string, projectRootPath: string, destinationFileName?: string) => Promise<any>;
  insertIntoProjectFromBuffer: (fileBytes: ArrayBuffer, projectRootPath: string, destinationFileName: string) => Promise<any>;
  removeFromProject: (absoluteFilePath: string) => Promise<any>;
}

/**
 * Interface for Blog Generation API.
 */
interface BlogGenerationAPI {
  generateContent: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  generateAndUpload: (params: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}

/**
 * Interface for Debug API.
 */
interface DebugAPI {
  startAutomation: (id?: string, pw?: string, proxy?: string, title?: string, content?: string, tags?: string) => Promise<{ success: boolean; error?: string }>;
  startWooriAutomation: (id?: string, password?: string, proxy?: string, geminiApiKey?: string) => Promise<{ success: boolean; error?: string; boxes?: any; clickedPoint?: any; screenshotPath?: string }>;
  launchChrome: () => Promise<{ success: boolean; error?: string }>;
  launchChromeWithUrl: (url: string, proxy?: string, openDevTools?: boolean, runLighthouse?: boolean) => Promise<{ success: boolean; error?: string }>;
  getPlaywrightTests: () => Promise<{ success: boolean; tests: any[]; error?: string }>;
  runPlaywrightTest: (testFile: string) => Promise<{ success: boolean; error?: string }>;
  deletePlaywrightTest: (testPath: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  openInstagramWithProfile: (options: any) => Promise<{ success: boolean; error?: string }>;
  testYouTubeUpload: (options: any) => Promise<{ success: boolean; error?: string }>;
  pickVideoFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  pickImageFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  testFacebookPost: (options: any) => Promise<{ success: boolean; error?: string }>;
  pickChromeProfileFolder: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  listChromeProfiles: () => Promise<{ success: boolean; root?: string; profiles?: any[]; error?: string }>;
  crawlWebsite: (url: string, proxy?: string, openDevTools?: boolean) => Promise<{ success: boolean; data?: any; filepath?: string; error?: string }>;
  generateLighthouseReports: (urls: string[], proxy?: string) => Promise<{ success: boolean; reports?: any[]; error?: string }>;
  testPasteComponent: () => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for MCP API.
 */
interface McpAPI {
  register: (name: string, password?: string) => Promise<{ success: boolean; status?: 'registered' | 'name_taken' | 'error'; message?: string; name?: string; ip?: string; timestamp?: string; id?: string; existing_record?: any; }>;
    testConnection: () => Promise<{ success: boolean; connected?: boolean; error?: string }>;
  registerTunnel: (name: string, password?: string) => Promise<{ success: boolean; status?: 'registered' | 'name_taken' | 'error'; message?: string; name?: string; ip?: string; timestamp?: string; id?: string; existing_record?: any; }>;
}

/**
 * Interface for Tunnel API.
 */
interface TunnelAPI {
  start: (serverName: string, localServerUrl?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  stop: (serverName: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  status: (serverName: string) => Promise<{ success: boolean; isActive?: boolean; isConnected?: boolean; error?: string }>;
  list: () => Promise<{ success: boolean; tunnels?: string[]; error?: string }>;
}

/**
 * Interface for Permissions API.
 */
interface PermissionsAPI {
  add: (request: any) => Promise<{ success: boolean; message?: string; added?: number; permissions?: any[]; error?: string }>;
  get: (serverKey: string) => Promise<{ success: boolean; server_key?: string; permissions?: any[]; error?: string }>;
  update: (permissionId: string, updates: any) => Promise<{ success: boolean; message?: string; permission?: any; error?: string }>;
  revoke: (permissionId: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Interface for Environment API.
 */
interface EnvAPI {
  checkConfig: () => Promise<{ success: boolean; hasSupabaseKey?: boolean; supabaseAnonKey?: string | null; supabaseUrl?: string; message?: string; error?: string }>;
  getDebugInfo: () => Promise<any>;
}

/**
 * Interface for MCP Config API.
 */
interface McpConfigAPI {
    get: () => Promise<{ success: boolean; config?: any; error?: string }>;
    set: (config: any) => Promise<{ success: boolean; error?: string }>;
    clear: () => Promise<{ success: boolean; error?: string }>;
    servers: {
      get: () => Promise<{ success: boolean; servers?: any[]; error?: string }>;
      add: (server: any) => Promise<{ success: boolean; server?: any; error?: string }>;
      update: (serverId: string, updates: any) => Promise<{ success: boolean; server?: any; error?: string }>;
      remove: (serverId: string) => Promise<{ success: boolean; error?: string }>;
    };
    connections: {
      get: () => Promise<{ success: boolean; connections?: any[]; error?: string }>;
      add: (connection: any) => Promise<{ success: boolean; connection?: any; error?: string }>;
      update: (connectionId: string, updates: any) => Promise<{ success: boolean; connection?: any; error?: string }>;
      remove: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
    };
}

/**
 * Interface for Gmail MCP API.
 */
interface GmailMcpAPI {
    fetchDomainUsers: (connectionId: string) => Promise<{ success: boolean; users?: any[]; error?: string }>;
    fetchUserMessages: (connectionId: string, userEmail: string, options?: any) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
    fetchUserStats: (connectionId: string, userEmail: string) => Promise<{ success: boolean; stats?: any; error?: string }>;
    saveUserDataToDatabase: (connectionId: string, userEmail: string, messageRecords: any[], statsRecord: any) => Promise<{ success: boolean; error?: string }>;
    fetchMessages: (connectionId: string, options?: any) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
    fetchStats: (connectionId: string) => Promise<{ success: boolean; stats?: any; error?: string }>;
    markAsRead: (connectionId: string, messageId: string) => Promise<{ success: boolean; error?: string }>;
    deleteMessage: (connectionId: string, messageId: string) => Promise<{ success: boolean; error?: string }>;
    sendReply: (connectionId: string, messageId: string, replyText: string) => Promise<{ success: boolean; error?: string }>;
    forwardMessage: (connectionId: string, messageId: string, toEmail: string) => Promise<{ success: boolean; error?: string }>;
    searchMessages: (connectionId: string, query: string, maxResults?: number) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
    getMessage: (connectionId: string, messageId: string) => Promise<{ success: boolean; message?: any; error?: string }>;
    testConnection: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for MCP Server API.
 */
interface McpServerAPI {
  getStatus: () => Promise<{ success: boolean; status?: any; error?: string }>;
    build: () => Promise<{ success: boolean; error?: string }>;
    configureClaude: () => Promise<{ success: boolean; error?: string }>;
    unconfigureClaude: () => Promise<{ success: boolean; error?: string }>;
    getInstructions: () => Promise<{ success: boolean; instructions?: string; error?: string }>;
}

/**
 * Interface for HTTPS Server API.
 */
interface HttpsServerAPI {
  start: (options: any) => Promise<{ success: boolean; error?: string; port?: number; protocol?: string }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
  status: () => Promise<{ success: boolean; isRunning: boolean; port: number | null; error?: string }>;
  restart: (options: any) => Promise<{ success: boolean; error?: string; port?: number; protocol?: string }>;
    getNetworkInfo: () => Promise<{ localIP: string; interfaces: any[] }>;
}

/**
 * Interface for SSL Certificate API.
 */
interface SslCertificateAPI {
  generate: (request: any) => Promise<any>;
  generateForce: (request: any) => Promise<any>;
  list: () => Promise<any>;
  get: (certificateId: string) => Promise<any>;
  delete: (certificateId: string) => Promise<any>;
  cleanup: () => Promise<any>;
}

/**
 * Interface for Auth API.
 */
interface AuthAPI {
  getSession: () => Promise<{ success: boolean; session: any | null; user: any | null; error?: string }>;
    signInWithGoogle: (scopes?: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGithub: () => Promise<{ success: boolean; error?: string }>;
    signOut: (userId?: string) => Promise<{ success: boolean; error?: string }>;
  getAllAccounts: () => Promise<{ success: boolean; accounts?: any[]; error?: string }>;
    switchAccount: (userId: string) => Promise<{ success: boolean; session?: any; error?: string }>;
    handleCallback: (url: string) => Promise<{ success: boolean; error?: string }>;
  getGoogleWorkspaceToken: () => Promise<{ success: boolean; token: any | null }>;
    saveSession: (session: any) => Promise<{ success: boolean; error?: string }>;
  callEdgeFunction: (options: any) => Promise<{ success: boolean; status?: number; statusText?: string; data?: any; error?: string }>;
    onAuthStateChanged: (callback: (data: { success: boolean; session: any | null; user: any | null }) => void) => () => void;
}

/**
 * Interface for EGDesk Dev API.
 */
interface EgdeskDevAPI {
  getConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
  setConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  clearConfig: () => Promise<{ success: boolean; error?: string }>;
  getDevFolder: () => Promise<{ success: boolean; config?: any; error?: string }>;
  createDevFolder: () => Promise<{ success: boolean; folderId?: string; folderUrl?: string; parentFolderId?: string; createdAt?: string; error?: string }>;
  createDevSpreadsheet: () => Promise<{ success: boolean; spreadsheetId?: string; spreadsheetUrl?: string; devFolderUrl?: string; message?: string; error?: string }>;
  validateSchema: () => Promise<{ success: boolean; isValid?: boolean; publicHeaders?: string[]; devHeaders?: string[]; errors?: string[]; error?: string }>;
  compareSchemas: () => Promise<{ success: boolean; diff?: any; error?: string }>;
  syncPublicToDev: (createBackup?: boolean) => Promise<{ success: boolean; message?: string; backup?: any; rowsSynced?: number; error?: string }>;
  syncDevToPublic: (createBackup?: boolean) => Promise<{ success: boolean; message?: string; backup?: any; rowsSynced?: number; error?: string }>;
  applyMergeResolution: (targetSpreadsheet: 'public' | 'dev', resolvedRows: any[]) => Promise<{ success: boolean; message?: string; error?: string }>;
  fetchSpreadsheetRows: (spreadsheetId: string, sheetName?: string) => Promise<{ success: boolean; rows?: any[]; error?: string }>;
  createBackup: (spreadsheetId: string) => Promise<{ success: boolean; backup?: any; error?: string }>;
}

/**
 * Interface for Shell API.
 */
interface ShellAPI {
    openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for Docker API.
 */
interface DockerAPI {
    checkConnection: () => Promise<{ connected: boolean; error?: string }>;
    getInfo: () => Promise<any>;
  listContainers: (options?: { all?: boolean }) => Promise<any[]>;
    getContainer: (containerId: string) => Promise<any>;
    startContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
    stopContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
    restartContainer: (containerId: string) => Promise<{ success: boolean; error?: string }>;
    removeContainer: (containerId: string, options?: { force?: boolean; v?: boolean }) => Promise<{ success: boolean; error?: string }>;
    getContainerLogs: (containerId: string, options?: { follow?: boolean; stdout?: boolean; stderr?: boolean; tail?: number }) => Promise<string>;
    getContainerStats: (containerId: string) => Promise<any>;
    execInContainer: (containerId: string, cmd: string[]) => Promise<{ success: boolean; output?: string; error?: string }>;
  listImages: () => Promise<any[]>;
    pullImage: (imageName: string) => Promise<{ success: boolean; error?: string }>;
    removeImage: (imageId: string) => Promise<{ success: boolean; error?: string }>;
    createContainer: (options: any) => Promise<{ success: boolean; containerId?: string; error?: string }>;
    listNetworks: () => Promise<any[]>;
    listVolumes: () => Promise<any>;
    onPullProgress: (callback: (data: { imageName: string; status?: string; progress?: string }) => void) => () => void;
    scheduler: {
    getAll: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; data?: any | null; error?: string }>;
    create: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    update: (id: string, updates: any) => Promise<{ success: boolean; data?: any | null; error?: string }>;
      delete: (id: string) => Promise<{ success: boolean; error?: string }>;
      toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    getEnabled: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getExecutions: (taskId: string, limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getRecentExecutions: (limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
      runNow: (taskId: string) => Promise<{ success: boolean; error?: string; containerId?: string }>;
    getStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
      restart: () => Promise<{ success: boolean; error?: string }>;
  };
}

/**
 * Interface for Updater API.
 */
interface UpdaterAPI {
    checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
    onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => () => void;
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => () => void;
    onUpdateError: (callback: (error: { message: string }) => void) => () => void;
}

/**
 * Interface for Finance Hub API.
 */
interface FinanceHubAPI {
  openBrowser: (bankId: string, proxyUrl?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  login: (bankId: string, credentials: any, proxyUrl?: string) => Promise<{ success: boolean; error?: string; [key: string]: any }>;
  getAccounts: (bankId: string, credentials?: any, proxyUrl?: string) => Promise<{ success: boolean; accounts?: any[]; error?: string }>;
  getTransactions: (bankId: string, accountNumber: string, startDate: string, endDate: string, parse?: boolean) => Promise<{ success: boolean; transactions?: any[]; summary?: any; metadata?: any; filename?: string; file?: string; error?: string }>;
  loginAndGetAccounts: (bankId: string, credentials: any, proxyUrl?: string) => Promise<{ success: boolean; isLoggedIn: boolean; userName?: string; accounts?: any[]; error?: string }>;
  getConnectedBanks: () => Promise<any[]>;
  disconnect: (bankId: string) => Promise<{ success: boolean; error?: string }>;
  saveCredentials: (bankId: string, credentials: any) => Promise<{ success: boolean; error?: string }>;
  getSavedCredentials: (bankId: string) => Promise<{ success: boolean; credentials?: any; error?: string }>;
  removeCredentials: (bankId: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Interface for Finance Hub Database API.
 */
interface FinanceHubDbAPI {
  getAllBanks: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAllAccounts: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getAccountsByBank: (bankId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  queryTransactions: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getTransactionStats: (options: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  getMonthlySummary: (options: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getOverallStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
  getRecentSyncOperations: (limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  upsertAccount: (accountData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  importTransactions: (bankId: string, accountData: any, transactionsData: any[], syncMetadata: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}


/**
 * Main Electron API handler that exposes functionality to the renderer process
 */
export interface IElectronAPI {
  platform: string;
  ipcRenderer: IpcRendererAPI;
  versions: VersionsAPI;
  arch: string;
  isPackaged: boolean;
  fileSystem: FileSystemAPI;
  git: any; // Using 'any' for simplicity, define GitAPI if needed
  web: WebUtilitiesAPI;
  wordpress: WordPressAPI;
  naver: NaverAPI;
  instagram: InstagramAPI;
  youtube: YouTubeAPI;
  facebook: FacebookAPI;
  scheduledPosts: ScheduledPostsAPI;
  businessIdentity: BusinessIdentityAPI;
  templateCopies: TemplateCopiesAPI;
  appsScriptTools: AppsScriptToolsAPI;
  sync: SyncAPI;
  preferences: PreferencesAPI;
  store: StoreAPI;
  sslAnalysis: SSLAnalysisAPI;
  wordpressServer: WordPressServerAPI;
  browserWindow: BrowserWindowAPI;
  mainWindow: MainWindowAPI;
  scriptExecution: ScriptExecutionAPI;
  aiService: AIServiceAPI;
  projectContext: ProjectContextAPI;
  ollama: OllamaAPI;
  aiChatData: AIChatDataAPI;
  egChatting: EgChattingAPI;
  backup: BackupAPI;
  photos: PhotosAPI;
  blogGeneration: BlogGenerationAPI;
  debug: DebugAPI;
  mcp: McpAPI;
  tunnel: TunnelAPI;
  permissions: PermissionsAPI;
  env: EnvAPI;
  mcpConfig: McpConfigAPI;
  gmailMCP: GmailMcpAPI;
  mcpServer: McpServerAPI;
  httpsServer: HttpsServerAPI;
  sslCertificate: SslCertificateAPI;
  auth: AuthAPI;
  egdeskDev: EgdeskDevAPI;
  shell: ShellAPI;
  docker: DockerAPI;
  updater: UpdaterAPI;
  financeHub: FinanceHubAPI;
  financeHubDb: FinanceHubDbAPI;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

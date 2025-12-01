import type {
  AIServiceAPI,
  OllamaAPI,
  WebUtilitiesAPI,
  WorkspaceAPI,
  InstagramAPI,
  YouTubeAPI,
  FacebookAPI,
  NaverAPI,
} from '../main/preload';

export interface AIChatDataAPI {
  // Conversation operations
  getConversations: (options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getConversation: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConversationWithMessages: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createConversation: (conversationData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateConversation: (conversationId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  archiveConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  restoreConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Message operations
  getMessages: (conversationId: string, options?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  addMessage: (messageData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  addMessages: (messagesData: any[]) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  updateMessage: (messageId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
  deleteMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Stats
  getStats: (conversationId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getOverallStats: () => Promise<{ success: boolean; data?: any; error?: string }>;
}

export interface IElectronAPI {
  ipcRenderer: {
    sendMessage(
      channel: 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      ...args: unknown[]
    ): void;
    on(
      channel: 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      func: (...args: unknown[]) => void,
    ): (() => void) | undefined;
    once(
      channel: 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      func: (...args: unknown[]) => void,
    ): void;
  };
  mainWindow: {
    getBounds(): Promise<{ success: boolean; bounds?: any; error?: string }>;
    setBounds(bounds: any): Promise<{ success: boolean; error?: string }>;
    setSize(width: number, height: number): Promise<{ success: boolean; error?: string }>;
    setPosition(x: number, y: number): Promise<{ success: boolean; error?: string }>;
    getWorkArea(): Promise<{ success: boolean; workArea?: { x: number; y: number; width: number; height: number }; error?: string }>;
  };
  fileSystem: {
    readDirectory(
      path: string,
    ): Promise<{ success: boolean; items?: any[]; error?: string }>;
    getFileInfo(
      path: string,
    ): Promise<{ success: boolean; info?: any; error?: string }>;
    getHomeDirectory(): Promise<string>;
    getSystemDirectories(): Promise<any[]>;
    createFolder(path: string): Promise<{ success: boolean; error?: string }>;
    deleteItem(path: string): Promise<{ success: boolean; error?: string }>;
    renameItem(
      oldPath: string,
      newPath: string,
    ): Promise<{ success: boolean; error?: string }>;
    pickFolder(): Promise<{
      success: boolean;
      folderPath?: string;
      error?: string;
    }>;
    readFile(
      path: string,
    ): Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile(
      path: string,
      content: string,
    ): Promise<{ success: boolean; error?: string }>;
    writeFileWithParams: (params: any) => Promise<any>;
    writeFileSimple: (filePath: string, content: string) => Promise<any>;
  };

  web: WebUtilitiesAPI;
  workspace: WorkspaceAPI;
  wordpress: {
    saveConnection(
      connection: any,
    ): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    getConnections(): Promise<{
      success: boolean;
      connections?: any[];
      error?: string;
    }>;
    deleteConnection(
      connectionId: string,
    ): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    updateConnection(
      connectionId: string,
      updates: any,
    ): Promise<{ success: boolean; connection?: any; error?: string }>;
    notifySyncCompletion(
      syncData: any,
    ): Promise<{ success: boolean; error?: string }>;
    navigateToSyncedFolder(navigationData: {
      syncPath: string;
      connectionName: string;
    }): Promise<{ success: boolean; error?: string }>;
    syncCreateFolders(
      basePath: string,
    ): Promise<{ success: boolean; error?: string }>;
    syncSavePost(
      filePath: string,
      content: string,
    ): Promise<{ success: boolean; size?: number; error?: string }>;
    syncDownloadMedia(
      mediaUrl: string,
      filePath: string,
    ): Promise<{ success: boolean; size?: number; error?: string }>;
    // SQLite-based sync handlers
    createSyncOperation(operationData: any): Promise<{
      success: boolean;
      operationId?: string;
      error?: string;
    }>;
    updateSyncOperation(operationId: string, updates: any): Promise<{
      success: boolean;
      error?: string;
    }>;
    savePost(postData: any): Promise<{
      success: boolean;
      size?: number;
      error?: string;
    }>;
    downloadMedia(mediaData: any): Promise<{
      success: boolean;
      size?: number;
      error?: string;
    }>;
    getPosts(siteId: string, limit?: number, offset?: number): Promise<{
      success: boolean;
      posts?: any[];
      error?: string;
    }>;
    getMedia(siteId: string, limit?: number, offset?: number): Promise<{
      success: boolean;
      media?: any[];
      error?: string;
    }>;
    getSyncOperations(siteId: string, limit?: number): Promise<{
      success: boolean;
      operations?: any[];
      error?: string;
    }>;
    getSyncStats(siteId: string): Promise<{
      success: boolean;
      stats?: any;
      error?: string;
    }>;
    addSyncFileDetail(fileDetailData: any): Promise<{
      success: boolean;
      fileDetailId?: string;
      error?: string;
    }>;
    updateSyncFileDetail(fileDetailId: string, status: string, errorMessage?: string): Promise<{
      success: boolean;
      error?: string;
    }>;
    getSyncFileDetails(operationId: string): Promise<{
      success: boolean;
      fileDetails?: any[];
      error?: string;
    }>;
    exportToFiles(exportOptions: any): Promise<{
      success: boolean;
      exportedFiles?: string[];
      totalSize?: number;
      error?: string;
    }>;
    fetchPosts(connectionId: string, options?: any): Promise<{
      success: boolean;
      posts?: any[];
      total?: number;
      error?: string;
    }>;
  fetchAllPosts(connectionId: string, options?: any): Promise<{
    success: boolean;
    totalPosts?: number;
    error?: string;
  }>;
  fetchMedia(connectionId: string, options?: any): Promise<{
    success: boolean;
    media?: any[];
    total?: number;
    error?: string;
  }>;
  fetchAllMedia(connectionId: string, options?: any): Promise<{
    success: boolean;
    totalMedia?: number;
    error?: string;
  }>;
  fetchComments(connectionId: string, options?: any): Promise<{
    success: boolean;
    comments?: any[];
    total?: number;
    error?: string;
  }>;
  fetchAllComments(connectionId: string, options?: any): Promise<{
    success: boolean;
    totalComments?: number;
    error?: string;
  }>;
  getComments(connectionId: string, limit?: number, offset?: number): Promise<{
    success: boolean;
    comments?: any[];
    error?: string;
  }>;
  updateCommentStatus(connectionId: string, commentId: number, status: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  deleteComment(connectionId: string, commentId: number): Promise<{
    success: boolean;
    error?: string;
  }>;
  clearAllData(): Promise<{
    success: boolean;
    error?: string;
  }>;
  clearSiteData(siteId: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  checkSite(url: string): Promise<{
    success: boolean;
    status?: 'online' | 'offline';
    responseTime?: number;
    error?: string;
    content?: string;
  }>;
};
  instagram: InstagramAPI;
  youtube: YouTubeAPI;
  facebook: FacebookAPI;
  naver: NaverAPI;
  sync: {
    saveHistory(
      syncData: any,
    ): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    updateProgress(
      syncId: string,
      progressData: any,
    ): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    complete(
      syncId: string,
      completionData: any,
    ): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    getHistory(
      connectionId?: string,
    ): Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
    getFileStatus(
      connectionId: string,
      filePath: string,
    ): Promise<{
      success: boolean;
      fileStatus?: any;
      lastSync?: string;
      syncPath?: string;
      error?: string;
    }>;
    clearHistory(
      connectionId?: string,
    ): Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
  };
  preferences: {
    get(): Promise<{ success: boolean; preferences?: any; error?: string }>;
    set(preferences: any): Promise<{ success: boolean; error?: string }>;
  };
  wordpressServer: {
    analyzeFolder(
      folderPath: string,
    ): Promise<{ success: boolean; info?: any; error?: string }>;
    startServer(
      folderPath: string,
      port?: number,
    ): Promise<{ success: boolean; port?: number; error?: string }>;
    stopServer(): Promise<{ success: boolean; error?: string }>;
    getServerStatus(): Promise<{
      success: boolean;
      status?: any;
      error?: string;
    }>;
    getPHPInfo(): Promise<{ success: boolean; phpInfo?: any; error?: string }>;
    pickFolder(): Promise<{
      success: boolean;
      folderPath?: string;
      error?: string;
    }>;
  };
  browserWindow: {
    createWindow(
      options: any,
    ): Promise<{ success: boolean; windowId?: number; error?: string }>;
    closeWindow(
      windowId: number,
    ): Promise<{ success: boolean; error?: string }>;
    loadURL(
      windowId: number,
      url: string,
    ): Promise<{ success: boolean; error?: string }>;
    switchURL(
      url: string,
      windowId?: number,
    ): Promise<{ success: boolean; error?: string }>;
    reload(windowId: number): Promise<{ success: boolean; error?: string }>;
    refreshAllLocalhost(): Promise<{
      success: boolean;
      refreshedCount?: number;
      error?: string;
    }>;
    getAllLocalhostWindows(): Promise<{
      success: boolean;
      windows?: Array<{ windowId: number; url: string; isVisible: boolean }>;
      error?: string;
    }>;
    launchExternalBrowser(
      browserType: string,
      url: string,
    ): Promise<{ success: boolean; process?: any; error?: string }>;
    closeExternalBrowser(
      pid: number,
    ): Promise<{ success: boolean; error?: string }>;
    navigateExternalBrowser(
      pid: number,
      url: string,
    ): Promise<{ success: boolean; error?: string }>;
    onUrlChanged(windowId: number, callback: (url: string) => void): void;
    removeUrlChangedListener(windowId: number): void;
  };
  store: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    has(key: string): Promise<boolean>;
  };
  sslAnalysis: {
    save(analysis: any): Promise<{ success: boolean; analysis?: any; error?: string }>;
    getAll(filter?: any): Promise<{ success: boolean; analyses?: any[]; error?: string }>;
    getById(id: string): Promise<{ success: boolean; analysis?: any; error?: string }>;
    update(id: string, updates: any): Promise<{ success: boolean; analysis?: any; error?: string }>;
    delete(id: string): Promise<{ success: boolean; error?: string }>;
    getStats(): Promise<{ success: boolean; stats?: any; error?: string }>;
    search(query: string): Promise<{ success: boolean; analyses?: any[]; error?: string }>;
    clearAll(): Promise<{ success: boolean; error?: string }>;
  };
  aiService: AIServiceAPI;
  projectContext: {
    updateContext(context: any): Promise<boolean>;
    getCurrentProject(): Promise<any>;
    getContext(): Promise<any>;
  };
  backup: {
    getAvailableBackups: () => Promise<{ success: boolean; backups?: any[]; error?: string }>;
    getBackupStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
    revertConversation: (conversationId: string) => Promise<{ success: boolean; result?: any; error?: string }>;
    revertToConversation: (targetConversationId: string) => Promise<{ success: boolean; summary?: any; error?: string }>;
    cleanupOldBackups: (keepCount?: number) => Promise<{ success: boolean; result?: any; error?: string }>;
  };
  debug: {
    startAutomation(
      id?: string,
      pw?: string,
      proxy?: string,
      title?: string,
      content?: string,
      tags?: string,
    ): Promise<{ success: boolean; error?: string }>;
    startWooriAutomation(
      id?: string,
      proxy?: string,
      geminiApiKey?: string,
    ): Promise<{
      success: boolean;
      error?: string;
      boxes?: any;
      clickedPoint?: any;
      screenshotPath?: string;
    }>;
    launchChrome(): Promise<{ success: boolean; error?: string }>;
    launchChromeWithUrl(
      url: string,
      proxy?: string,
      openDevTools?: boolean,
      runLighthouse?: boolean,
    ): Promise<{ success: boolean; error?: string }>;
    openInstagramWithProfile(options: {
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
    }): Promise<{ success: boolean; error?: string }>;
    pickChromeProfileFolder(): Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
      error?: string;
    }>;
    listChromeProfiles(): Promise<{
      success: boolean;
      root?: string;
      profiles?: Array<{
        name: string;
        directoryName: string;
        path: string;
      }>;
      error?: string;
    }>;
    crawlWebsite(
      url: string,
      proxy?: string,
      openDevTools?: boolean,
    ): Promise<{
      success: boolean;
      data?: any;
      filepath?: string;
      error?: string;
    }>;
    generateLighthouseReports(
      urls: string[],
      proxy?: string,
    ): Promise<{
      success: boolean;
      reports?: Array<{ url: string; reportPath: string }>;
      error?: string;
    }>;
    testPasteComponent(): Promise<{ success: boolean; error?: string }>;
  };
  scheduledPosts: {
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
  };
  businessIdentity: {
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
    listSnsPlanExecutions: (planId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  };
  templateCopies: {
    create: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getByTemplate: (templateId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getAll: (limit?: number, offset?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getByScriptId: (scriptId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    updateScriptContent: (scriptId: string, scriptContent: any) => Promise<{ success: boolean; data?: any; error?: string }>;
  };
  
  appsScriptTools: {
    listFiles: (scriptId: string) => Promise<{ success: boolean; data?: Array<{name: string; type: string; hasSource: boolean}>; error?: string }>;
    readFile: (scriptId: string, fileName: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    writeFile: (scriptId: string, fileName: string, content: string, fileType?: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    partialEdit: (scriptId: string, fileName: string, oldString: string, newString: string, expectedReplacements?: number, flexibleMatching?: boolean, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    renameFile: (scriptId: string, oldFileName: string, newFileName: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    deleteFile: (scriptId: string, fileName: string, conversationId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  };
  mcp: {
    register: (name: string, password?: string) => Promise<{ 
      success: boolean; 
      status?: 'registered' | 'name_taken' | 'error'; 
      message?: string; 
      name?: string; 
      ip?: string; 
      timestamp?: string; 
      id?: string; 
      existing_record?: any; 
    }>;
    testConnection: () => Promise<{ success: boolean; connected?: boolean; error?: string }>;
    registerTunnel: (name: string, password?: string) => Promise<{ 
      success: boolean; 
      status?: 'registered' | 'name_taken' | 'error'; 
      message?: string; 
      name?: string; 
      ip?: string; 
      timestamp?: string; 
      id?: string; 
      existing_record?: {
        name: string;
        ip: string;
        registered_at: string;
      }; 
    }>;
  };
  tunnel: {
    start: (serverName: string, localServerUrl?: string) => Promise<{ 
      success: boolean; 
      message?: string; 
      error?: string; 
    }>;
    stop: (serverName: string) => Promise<{ 
      success: boolean; 
      message?: string; 
      error?: string; 
    }>;
    status: (serverName: string) => Promise<{ 
      success: boolean; 
      isActive?: boolean; 
      isConnected?: boolean; 
      error?: string; 
    }>;
    list: () => Promise<{ 
      success: boolean; 
      tunnels?: string[]; 
      error?: string; 
    }>;
  };
  permissions: {
    add: (request: {
      server_key: string;
      emails: string[];
      access_level?: 'read_only' | 'read_write' | 'admin';
      expires_at?: string;
      notes?: string;
    }) => Promise<{
      success: boolean;
      message?: string;
      added?: number;
      permissions?: any[];
      error?: string;
    }>;
    get: (serverKey: string) => Promise<{
      success: boolean;
      server_key?: string;
      permissions?: any[];
      error?: string;
    }>;
    update: (permissionId: string, updates: {
      access_level?: 'read_only' | 'read_write' | 'admin';
      expires_at?: string;
      notes?: string;
      status?: 'pending' | 'active' | 'revoked' | 'expired';
    }) => Promise<{
      success: boolean;
      message?: string;
      permission?: any;
      error?: string;
    }>;
    revoke: (permissionId: string) => Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>;
  };
  env: {
    checkConfig: () => Promise<{ 
      success: boolean; 
      hasSupabaseKey?: boolean;
      supabaseAnonKey?: string | null;
      supabaseUrl?: string; 
      message?: string; 
      error?: string; 
    }>;
  };
  mcpConfig: {
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
  };

  aiChatData: AIChatDataAPI;

  gmailMCP: {
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
  };

  mcpServer: {
    getStatus: () => Promise<{ 
      success: boolean; 
      status?: {
        isBuilt: boolean;
        isConfigured: boolean;
        serverPath: string | null;
        configPath: string | null;
        error: string | null;
      };
      error?: string;
    }>;
    build: () => Promise<{ success: boolean; error?: string }>;
    configureClaude: () => Promise<{ success: boolean; error?: string }>;
    unconfigureClaude: () => Promise<{ success: boolean; error?: string }>;
    getInstructions: () => Promise<{ success: boolean; instructions?: string; error?: string }>;
  };

  httpsServer: {
    start: (options: { port: number; useHTTPS?: boolean; keyPath?: string; certPath?: string }) => Promise<{ 
      success: boolean; 
      error?: string; 
      port?: number; 
      protocol?: string;
    }>;
    stop: () => Promise<{ success: boolean; error?: string }>;
    status: () => Promise<{ 
      success: boolean; 
      isRunning: boolean; 
      port: number | null; 
      error?: string;
    }>;
    restart: (options: { port: number; useHTTPS?: boolean; keyPath?: string; certPath?: string }) => Promise<{ 
      success: boolean; 
      error?: string; 
      port?: number; 
      protocol?: string;
    }>;
    getNetworkInfo: () => Promise<{ localIP: string; interfaces: any[] }>;
  };

  auth: {
    getSession: () => Promise<{
      success: boolean;
      session: any | null;
      user: any | null;
      error?: string;
    }>;
    signInWithGoogle: (scopes?: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGithub: () => Promise<{ success: boolean; error?: string }>;
    signOut: (userId?: string) => Promise<{ success: boolean; error?: string }>;
    getAllAccounts: () => Promise<{ success: boolean; accounts?: Array<{ userId: string; email: string; user: any }>; error?: string }>;
    switchAccount: (userId: string) => Promise<{ success: boolean; session?: any; error?: string }>;
    handleCallback: (url: string) => Promise<{ success: boolean; error?: string }>;
    getGoogleWorkspaceToken: () => Promise<{
      success: boolean;
      token: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        scopes?: string[];
        saved_at?: number;
        supabase_session?: boolean;
        user_id?: string;
      } | null;
    }>;
    saveSession: (session: any) => Promise<{ success: boolean; error?: string }>;
    callEdgeFunction: (options: {
      url: string;
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    }) => Promise<{
      success: boolean;
      status?: number;
      statusText?: string;
      data?: any;
      error?: string;
    }>;
    onAuthStateChanged: (callback: (data: { success: boolean; session: any | null; user: any | null }) => void) => () => void;
  };

  aiChatData: AIChatDataAPI;

  ollama: OllamaAPI;

  shell: {
    openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  updater: {
    checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
    onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => () => void;
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
    onUpdateDownloaded: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => () => void;
    onUpdateError: (callback: (error: { message: string }) => void) => () => void;
  };

  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface BusinessIdentitySnsPlanInput {
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

  interface Window {
    electron: IElectronAPI;
  }
}

export {};

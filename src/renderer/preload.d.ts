import type { AIServiceAPI } from '../main/preload';

export interface IElectronAPI {
  ipcRenderer: {
    sendMessage(
      channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      ...args: unknown[]
    ): void;
    on(
      channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      func: (...args: unknown[]) => void,
    ): (() => void) | undefined;
    once(
      channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder' | 'ai-stream-event',
      func: (...args: unknown[]) => void,
    ): void;
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
  };
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
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};

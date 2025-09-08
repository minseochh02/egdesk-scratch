export interface IElectronAPI {
  ipcRenderer: {
    sendMessage(channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder', args: unknown[]): void;
    on(
      channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder',
      func: (...args: unknown[]) => void
    ): (() => void) | undefined;
    once(channel: 'ipc-example' | 'sync-completed' | 'navigate-to-synced-folder', func: (...args: unknown[]) => void): void;
  };
  fileSystem: {
    readDirectory(path: string): Promise<{ success: boolean; items?: any[]; error?: string }>;
    getFileInfo(path: string): Promise<{ success: boolean; info?: any; error?: string }>;
    getHomeDirectory(): Promise<string>;
    getSystemDirectories(): Promise<any[]>;
    createFolder(path: string): Promise<{ success: boolean; error?: string }>;
    deleteItem(path: string): Promise<{ success: boolean; error?: string }>;
    renameItem(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }>;
    pickFolder(): Promise<{ success: boolean; folderPath?: string; error?: string }>;
    readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }>;
  };
  wordpress: {
    saveConnection(connection: any): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    getConnections(): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    deleteConnection(connectionId: string): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    updateConnection(connectionId: string, updates: any): Promise<{ success: boolean; connection?: any; error?: string }>;
    notifySyncCompletion(syncData: any): Promise<{ success: boolean; error?: string }>;
    navigateToSyncedFolder(navigationData: { syncPath: string; connectionName: string }): Promise<{ success: boolean; error?: string }>;
    syncCreateFolders(basePath: string): Promise<{ success: boolean; error?: string }>;
    syncSavePost(filePath: string, content: string): Promise<{ success: boolean; size?: number; error?: string }>;
    syncDownloadMedia(mediaUrl: string, filePath: string): Promise<{ success: boolean; size?: number; error?: string }>;
  };
  sync: {
    saveHistory(syncData: any): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    updateProgress(syncId: string, progressData: any): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    complete(syncId: string, completionData: any): Promise<{ success: boolean; syncRecord?: any; error?: string }>;
    getHistory(connectionId?: string): Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
    getFileStatus(connectionId: string, filePath: string): Promise<{ success: boolean; fileStatus?: any; lastSync?: string; syncPath?: string; error?: string }>;
    clearHistory(connectionId?: string): Promise<{ success: boolean; syncHistory?: any[]; error?: string }>;
  };
  preferences: {
    get(): Promise<{ success: boolean; preferences?: any; error?: string }>;
    set(preferences: any): Promise<{ success: boolean; error?: string }>;
  };
  wordpressServer: {
    analyzeFolder(folderPath: string): Promise<{ success: boolean; info?: any; error?: string }>;
    startServer(folderPath: string, port?: number): Promise<{ success: boolean; port?: number; error?: string }>;
    stopServer(): Promise<{ success: boolean; error?: string }>;
    getServerStatus(): Promise<{ success: boolean; status?: any; error?: string }>;
    getPHPInfo(): Promise<{ success: boolean; phpInfo?: any; error?: string }>;
    pickFolder(): Promise<{ success: boolean; folderPath?: string; error?: string }>;
  };
  browserWindow: {
    createWindow(options: any): Promise<{ success: boolean; windowId?: number; error?: string }>;
    closeWindow(windowId: number): Promise<{ success: boolean; error?: string }>;
    loadURL(windowId: number, url: string): Promise<{ success: boolean; error?: string }>;
    reload(windowId: number): Promise<{ success: boolean; error?: string }>;
    refreshAllLocalhost(): Promise<{ success: boolean; refreshedCount?: number; error?: string }>;
    getAllLocalhostWindows(): Promise<{ success: boolean; windows?: Array<{ windowId: number; url: string; isVisible: boolean }>; error?: string }>;
    launchExternalBrowser(browserType: string, url: string): Promise<{ success: boolean; process?: any; error?: string }>;
    closeExternalBrowser(pid: number): Promise<{ success: boolean; error?: string }>;
    navigateExternalBrowser(pid: number, url: string): Promise<{ success: boolean; error?: string }>;
    onUrlChanged(windowId: number, callback: (url: string) => void): void;
    removeUrlChangedListener(windowId: number): void;
  };
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};

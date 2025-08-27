export interface IElectronAPI {
  ipcRenderer: {
    sendMessage(channel: 'ipc-example', args: unknown[]): void;
    on(
      channel: 'ipc-example' | 'sync-completed',
      func: (...args: unknown[]) => void
    ): (() => void) | undefined;
    once(channel: 'ipc-example', func: (...args: unknown[]) => void): void;
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
  };
  wordpress: {
    saveConnection(connection: any): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    getConnections(): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    deleteConnection(connectionId: string): Promise<{ success: boolean; connections?: any[]; error?: string }>;
    updateConnection(connectionId: string, updates: any): Promise<{ success: boolean; connection?: any; error?: string }>;
    notifySyncCompletion(syncData: any): Promise<{ success: boolean; error?: string }>;
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
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}

export {};

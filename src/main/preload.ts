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
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

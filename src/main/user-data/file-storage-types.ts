/**
 * File Storage Types
 *
 * Types and interfaces for user data file storage system
 */

/**
 * Storage type for files
 */
export type StorageType = 'blob' | 'filesystem';

/**
 * Compression type for files
 */
export type CompressionType = 'gzip' | 'brotli' | 'none';

/**
 * File metadata stored in database
 */
export interface UserDataFile {
  id: string;
  tableId: string;
  rowId: number;
  columnName: string;

  // File metadata
  filename: string;
  mimeType: string | null;
  sizeBytes: number;

  // Storage details
  storageType: StorageType;
  fileData: Buffer | null;  // For BLOB storage
  filePath: string | null;  // For filesystem storage

  // Optional compression
  isCompressed: boolean;
  compressionType: CompressionType;
  originalSize: number | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Options for storing a file
 */
export interface StoreFileOptions {
  tableId: string;
  rowId: number;
  columnName: string;
  filename: string;
  mimeType?: string;
  data: Buffer;
  forceStorageType?: StorageType;  // Override automatic decision
  compress?: boolean;  // Whether to compress (auto-decided if not specified)
}

/**
 * Result of storing a file
 */
export interface StoreFileResult {
  fileId: string;
  storageType: StorageType;
  isCompressed: boolean;
  storedSize: number;
  originalSize: number;
}

/**
 * Options for retrieving a file
 */
export interface GetFileOptions {
  fileId?: string;
  tableId?: string;
  rowId?: number;
  columnName?: string;
}

/**
 * Result of retrieving a file
 */
export interface GetFileResult {
  fileId: string;
  filename: string;
  mimeType: string | null;
  data: Buffer;
  sizeBytes: number;
}

/**
 * File storage statistics
 */
export interface FileStorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  blobStorageCount: number;
  blobStorageBytes: number;
  filesystemStorageCount: number;
  filesystemStorageBytes: number;
  compressedCount: number;
  compressionSavedBytes: number;
}

/**
 * Configuration for file storage
 */
export interface FileStorageConfig {
  /**
   * Size threshold in bytes for BLOB vs filesystem storage
   * Files smaller than this go to BLOB, larger to filesystem
   * Default: 100KB (102400 bytes)
   */
  blobThreshold: number;

  /**
   * Size threshold for automatic compression
   * Files between this and blobThreshold get compressed
   * Default: 10KB (10240 bytes)
   */
  compressionThreshold: number;

  /**
   * Base directory for filesystem storage
   * Default: userData/files
   */
  filesystemBaseDir: string;

  /**
   * Use hash-based subdirectories for filesystem storage
   * Prevents too many files in one directory
   * Default: true
   */
  useHashedDirectories: boolean;
}

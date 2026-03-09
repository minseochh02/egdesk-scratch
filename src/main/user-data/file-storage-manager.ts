/**
 * File Storage Manager
 *
 * Manages file storage for user data tables with hybrid BLOB/filesystem approach
 * - Small files (<100KB): Stored in BLOB
 * - Medium files (10KB-100KB): Stored in BLOB with compression
 * - Large files (>100KB): Stored in filesystem
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import {
  UserDataFile,
  StoreFileOptions,
  StoreFileResult,
  GetFileOptions,
  GetFileResult,
  FileStorageStats,
  FileStorageConfig,
  StorageType,
  CompressionType,
} from './file-storage-types';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Default file storage configuration
 */
const DEFAULT_CONFIG: FileStorageConfig = {
  blobThreshold: 100 * 1024, // 100KB
  compressionThreshold: 10 * 1024, // 10KB
  filesystemBaseDir: 'files',
  useHashedDirectories: true,
};

/**
 * FileStorageManager
 * Handles file storage and retrieval with automatic BLOB vs filesystem decision
 */
export class FileStorageManager {
  private config: FileStorageConfig;
  private baseDir: string;

  constructor(
    private database: Database.Database,
    private userDataDir: string,
    config?: Partial<FileStorageConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseDir = path.join(userDataDir, this.config.filesystemBaseDir);
  }

  /**
   * Initialize file storage (create tables and directories)
   */
  async initialize(): Promise<void> {
    // Create user_data_files table if it doesn't exist
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS user_data_files (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        row_id INTEGER NOT NULL,
        column_name TEXT NOT NULL,

        -- File metadata
        filename TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER NOT NULL,

        -- Storage details
        storage_type TEXT CHECK(storage_type IN ('blob', 'filesystem')) NOT NULL,
        file_data BLOB,
        file_path TEXT,

        -- Compression
        is_compressed INTEGER DEFAULT 0,
        compression_type TEXT DEFAULT 'none',
        original_size INTEGER,

        -- Metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (table_id) REFERENCES user_tables(id) ON DELETE CASCADE,
        UNIQUE(table_id, row_id, column_name)
      );

      CREATE INDEX IF NOT EXISTS idx_user_data_files_table_row
        ON user_data_files(table_id, row_id);

      CREATE INDEX IF NOT EXISTS idx_user_data_files_storage_type
        ON user_data_files(storage_type);
    `);

    // Create filesystem base directory if needed
    await this.ensureDirectoryExists(this.baseDir);
  }

  /**
   * Store a file with automatic storage type selection
   */
  async storeFile(options: StoreFileOptions): Promise<StoreFileResult> {
    const { tableId, rowId, columnName, filename, mimeType, data, forceStorageType, compress } = options;

    // Delete existing file if present
    await this.deleteFile({ tableId, rowId, columnName });

    const fileId = randomUUID();
    const originalSize = data.length;
    const now = new Date().toISOString();

    // Determine storage type
    let storageType: StorageType;
    if (forceStorageType) {
      storageType = forceStorageType;
    } else {
      storageType = originalSize < this.config.blobThreshold ? 'blob' : 'filesystem';
    }

    // Determine if we should compress
    const shouldCompress =
      compress !== undefined
        ? compress
        : originalSize >= this.config.compressionThreshold && originalSize < this.config.blobThreshold;

    let finalData = data;
    let isCompressed = false;
    let compressionType: CompressionType = 'none';

    if (shouldCompress) {
      try {
        const compressed = await gzipAsync(data);
        // Only use compression if it actually reduces size
        if (compressed.length < data.length * 0.9) {
          finalData = compressed;
          isCompressed = true;
          compressionType = 'gzip';
        }
      } catch (error) {
        console.error('Compression failed, storing uncompressed:', error);
      }
    }

    const storedSize = finalData.length;

    if (storageType === 'blob') {
      // Store in database as BLOB
      const stmt = this.database.prepare(`
        INSERT INTO user_data_files (
          id, table_id, row_id, column_name,
          filename, mime_type, size_bytes,
          storage_type, file_data, file_path,
          is_compressed, compression_type, original_size,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fileId,
        tableId,
        rowId,
        columnName,
        filename,
        mimeType || null,
        storedSize,
        'blob',
        finalData,
        null,
        isCompressed ? 1 : 0,
        compressionType,
        isCompressed ? originalSize : null,
        now,
        now
      );
    } else {
      // Store in filesystem
      const filePath = await this.writeToFilesystem(fileId, finalData);

      const stmt = this.database.prepare(`
        INSERT INTO user_data_files (
          id, table_id, row_id, column_name,
          filename, mime_type, size_bytes,
          storage_type, file_data, file_path,
          is_compressed, compression_type, original_size,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fileId,
        tableId,
        rowId,
        columnName,
        filename,
        mimeType || null,
        storedSize,
        'filesystem',
        null,
        filePath,
        isCompressed ? 1 : 0,
        compressionType,
        isCompressed ? originalSize : null,
        now,
        now
      );
    }

    return {
      fileId,
      storageType,
      isCompressed,
      storedSize,
      originalSize,
    };
  }

  /**
   * Retrieve a file by ID or by table/row/column
   */
  async getFile(options: GetFileOptions): Promise<GetFileResult | null> {
    let stmt: Database.Statement;
    let params: any[];

    if (options.fileId) {
      stmt = this.database.prepare('SELECT * FROM user_data_files WHERE id = ?');
      params = [options.fileId];
    } else if (options.tableId && options.rowId !== undefined && options.columnName) {
      stmt = this.database.prepare(
        'SELECT * FROM user_data_files WHERE table_id = ? AND row_id = ? AND column_name = ?'
      );
      params = [options.tableId, options.rowId, options.columnName];
    } else {
      throw new Error('Must provide either fileId or (tableId, rowId, columnName)');
    }

    const row = stmt.get(...params) as any;
    if (!row) {
      return null;
    }

    let data: Buffer;

    if (row.storage_type === 'blob') {
      data = row.file_data;
    } else {
      // Read from filesystem
      data = await fs.readFile(row.file_path);
    }

    // Decompress if needed
    if (row.is_compressed) {
      if (row.compression_type === 'gzip') {
        data = await gunzipAsync(data);
      }
    }

    return {
      fileId: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      data,
      sizeBytes: data.length,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(options: GetFileOptions): Promise<boolean> {
    let stmt: Database.Statement;
    let params: any[];

    if (options.fileId) {
      stmt = this.database.prepare('SELECT * FROM user_data_files WHERE id = ?');
      params = [options.fileId];
    } else if (options.tableId && options.rowId !== undefined && options.columnName) {
      stmt = this.database.prepare(
        'SELECT * FROM user_data_files WHERE table_id = ? AND row_id = ? AND column_name = ?'
      );
      params = [options.tableId, options.rowId, options.columnName];
    } else {
      return false;
    }

    const row = stmt.get(...params) as any;
    if (!row) {
      return false;
    }

    // Delete from filesystem if needed
    if (row.storage_type === 'filesystem' && row.file_path) {
      try {
        await fs.unlink(row.file_path);
      } catch (error) {
        console.error('Failed to delete file from filesystem:', error);
      }
    }

    // Delete from database
    const deleteStmt = this.database.prepare('DELETE FROM user_data_files WHERE id = ?');
    deleteStmt.run(row.id);

    return true;
  }

  /**
   * List all files for a table row
   */
  listFilesForRow(tableId: string, rowId: number): UserDataFile[] {
    const stmt = this.database.prepare(`
      SELECT * FROM user_data_files
      WHERE table_id = ? AND row_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(tableId, rowId) as any[];
    return rows.map(this.mapRowToFile);
  }

  /**
   * Get storage statistics
   */
  getStats(tableId?: string): FileStorageStats {
    let query = `
      SELECT
        COUNT(*) as total_files,
        SUM(size_bytes) as total_size,
        SUM(CASE WHEN storage_type = 'blob' THEN 1 ELSE 0 END) as blob_count,
        SUM(CASE WHEN storage_type = 'blob' THEN size_bytes ELSE 0 END) as blob_size,
        SUM(CASE WHEN storage_type = 'filesystem' THEN 1 ELSE 0 END) as fs_count,
        SUM(CASE WHEN storage_type = 'filesystem' THEN size_bytes ELSE 0 END) as fs_size,
        SUM(CASE WHEN is_compressed = 1 THEN 1 ELSE 0 END) as compressed_count,
        SUM(CASE WHEN is_compressed = 1 THEN (original_size - size_bytes) ELSE 0 END) as saved_bytes
      FROM user_data_files
    `;

    if (tableId) {
      query += ' WHERE table_id = ?';
    }

    const stmt = this.database.prepare(query);
    const row = (tableId ? stmt.get(tableId) : stmt.get()) as any;

    return {
      totalFiles: row.total_files || 0,
      totalSizeBytes: row.total_size || 0,
      blobStorageCount: row.blob_count || 0,
      blobStorageBytes: row.blob_size || 0,
      filesystemStorageCount: row.fs_count || 0,
      filesystemStorageBytes: row.fs_size || 0,
      compressedCount: row.compressed_count || 0,
      compressionSavedBytes: row.saved_bytes || 0,
    };
  }

  /**
   * Write data to filesystem with hash-based directory structure
   */
  private async writeToFilesystem(fileId: string, data: Buffer): Promise<string> {
    let filePath: string;

    if (this.config.useHashedDirectories) {
      // Use first 4 chars of UUID for subdirectory (ab/cd/abcd1234...)
      const hash = fileId.replace(/-/g, '').substring(0, 4);
      const dir1 = hash.substring(0, 2);
      const dir2 = hash.substring(2, 4);
      const dirPath = path.join(this.baseDir, dir1, dir2);
      await this.ensureDirectoryExists(dirPath);
      filePath = path.join(dirPath, fileId);
    } else {
      filePath = path.join(this.baseDir, fileId);
    }

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, filePath);

    return filePath;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Map database row to UserDataFile
   */
  private mapRowToFile(row: any): UserDataFile {
    return {
      id: row.id,
      tableId: row.table_id,
      rowId: row.row_id,
      columnName: row.column_name,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storageType: row.storage_type,
      fileData: row.file_data,
      filePath: row.file_path,
      isCompressed: row.is_compressed === 1,
      compressionType: row.compression_type,
      originalSize: row.original_size,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Clean up orphaned filesystem files
   * (Files that exist on filesystem but not in database)
   */
  async cleanupOrphanedFiles(): Promise<number> {
    let cleanedCount = 0;

    // Get all file paths from database
    const stmt = this.database.prepare('SELECT file_path FROM user_data_files WHERE storage_type = "filesystem"');
    const dbFiles = new Set((stmt.all() as any[]).map((row) => row.file_path).filter(Boolean));

    // Walk filesystem and check each file
    const walkDir = async (dirPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            if (!dbFiles.has(fullPath)) {
              // Orphaned file - delete it
              await fs.unlink(fullPath);
              cleanedCount++;
              console.log(`Cleaned up orphaned file: ${fullPath}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error walking directory ${dirPath}:`, error);
      }
    };

    await walkDir(this.baseDir);
    return cleanedCount;
  }
}

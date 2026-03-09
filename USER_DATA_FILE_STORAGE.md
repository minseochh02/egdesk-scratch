# User Data File Storage

This document describes the file storage system implemented for user data tables in EGDesk.

## Overview

The file storage system provides a hybrid approach to storing files and images in user data tables:

- **Small files (<100KB)**: Stored in SQLite BLOB
- **Medium files (10KB-100KB)**: Stored in BLOB with gzip compression
- **Large files (>100KB)**: Stored in filesystem with path reference

## Features

✅ **Native SQLite BLOB support** - No extensions required
✅ **Hybrid storage** - Automatic selection based on file size
✅ **Compression** - Automatic gzip compression for medium files
✅ **Transactional integrity** - Files linked to table rows
✅ **Cascading delete** - Files deleted when rows are deleted
✅ **Multiple storage backends** - BLOB for small files, filesystem for large
✅ **File metadata** - Filename, MIME type, size tracking
✅ **Orphan cleanup** - Tools to clean up abandoned filesystem files

## Architecture

### Database Schema

#### `user_data_files` Table

Stores file metadata and BLOB data for small files:

```sql
CREATE TABLE user_data_files (
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
```

### File Storage Manager

`FileStorageManager` class handles all file operations:

- **Location**: `src/main/user-data/file-storage-manager.ts`
- **Manages**: BLOB vs filesystem decision, compression, retrieval, cleanup

### Storage Thresholds

```typescript
const DEFAULT_CONFIG = {
  blobThreshold: 100 * 1024,        // 100KB
  compressionThreshold: 10 * 1024,  // 10KB
  filesystemBaseDir: 'files',
  useHashedDirectories: true
};
```

### Filesystem Structure

Files stored in filesystem use hash-based subdirectories:

```
userData/
  files/
    ab/
      cd/
        abcd1234-5678-90ef-ghij-klmnopqrstuv
    12/
      34/
        12345678-abcd-efgh-ijkl-mnopqrstuvwx
```

## Usage

### MCP Tools

#### 1. Upload a File

```typescript
// Tool: user_data_upload_file
{
  tableName: 'products',
  rowId: 123,
  columnName: 'thumbnail',
  filename: 'product-image.png',
  mimeType: 'image/png',
  data: '<base64-encoded-data>',
  // Optional overrides:
  forceStorageType: 'blob',  // Force BLOB storage
  compress: true              // Force compression
}
```

**Returns:**
```json
{
  "success": true,
  "fileId": "uuid",
  "storageType": "blob",
  "isCompressed": true,
  "storedSize": 45678,
  "originalSize": 87654
}
```

#### 2. Download a File

```typescript
// Tool: user_data_download_file
// Option A: By file ID
{ fileId: 'uuid' }

// Option B: By table/row/column
{
  tableName: 'products',
  rowId: 123,
  columnName: 'thumbnail'
}
```

**Returns:**
```json
{
  "fileId": "uuid",
  "filename": "product-image.png",
  "mimeType": "image/png",
  "sizeBytes": 87654,
  "data": "<base64-encoded-data>"
}
```

#### 3. Delete a File

```typescript
// Tool: user_data_delete_file
{ fileId: 'uuid' }
// OR
{ tableName: 'products', rowId: 123, columnName: 'thumbnail' }
```

#### 4. List Files for a Row

```typescript
// Tool: user_data_list_files
{ tableName: 'products', rowId: 123 }
```

**Returns:**
```json
{
  "tableName": "products",
  "rowId": 123,
  "files": [
    {
      "fileId": "uuid",
      "filename": "product-image.png",
      "mimeType": "image/png",
      "sizeBytes": 87654,
      "storageType": "blob",
      "isCompressed": true,
      "columnName": "thumbnail",
      "createdAt": "2025-03-09T..."
    }
  ],
  "totalFiles": 1
}
```

#### 5. Get Storage Statistics

```typescript
// Tool: user_data_get_file_stats
{ tableName: 'products' }  // Optional: omit for all tables
```

**Returns:**
```json
{
  "totalFiles": 150,
  "totalSizeBytes": 12345678,
  "blobStorageCount": 120,
  "blobStorageBytes": 2345678,
  "filesystemStorageCount": 30,
  "filesystemStorageBytes": 10000000,
  "compressedCount": 80,
  "compressionSavedBytes": 567890
}
```

### IPC Handlers (for Renderer)

```typescript
// Upload file
await window.electron.ipcRenderer.invoke('user-data:upload-file', {
  tableId: 'uuid',
  rowId: 123,
  columnName: 'thumbnail',
  filename: 'image.png',
  mimeType: 'image/png',
  data: buffer
});

// Download file
const file = await window.electron.ipcRenderer.invoke('user-data:download-file', {
  tableId: 'uuid',
  rowId: 123,
  columnName: 'thumbnail'
});

// Delete file
await window.electron.ipcRenderer.invoke('user-data:delete-file', {
  fileId: 'uuid'
});

// List files
const files = await window.electron.ipcRenderer.invoke('user-data:list-files',
  'table-uuid',
  123
);

// Get stats
const stats = await window.electron.ipcRenderer.invoke('user-data:get-file-stats',
  'table-uuid'  // Optional
);

// Cleanup orphaned files
const result = await window.electron.ipcRenderer.invoke('user-data:cleanup-orphaned-files');
```

### Direct API Usage (Main Process)

```typescript
import { getSQLiteManager } from '../sqlite/manager';

const manager = getSQLiteManager();
const userDataManager = manager.getUserDataManager();
const fileManager = userDataManager.getFileStorageManager();

// Initialize (creates table and directories)
await fileManager.initialize();

// Store file
const result = await fileManager.storeFile({
  tableId: 'uuid',
  rowId: 123,
  columnName: 'thumbnail',
  filename: 'image.png',
  mimeType: 'image/png',
  data: buffer
});

// Retrieve file
const file = await fileManager.getFile({
  tableId: 'uuid',
  rowId: 123,
  columnName: 'thumbnail'
});

// Delete file
await fileManager.deleteFile({ fileId: 'uuid' });

// List files for row
const files = fileManager.listFilesForRow('table-uuid', 123);

// Get statistics
const stats = fileManager.getStats('table-uuid');

// Cleanup orphaned files
const cleanedCount = await fileManager.cleanupOrphanedFiles();
```

## Creating Tables with File Columns

### Using MCP Tool

```typescript
// Tool: user_data_create_table
{
  displayName: 'Products',
  schema: [
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'thumbnail', type: 'BLOB' },      // File column
    { name: 'datasheet', type: 'BLOB' },      // Another file column
    { name: 'price', type: 'REAL' }
  ]
}
```

**Note:** The `BLOB` type in schema indicates this column can store files. However, actual files are managed via the `user_data_files` table, not directly in the column.

## Implementation Details

### Storage Decision Logic

```typescript
function determineStorageType(fileSize: number): StorageType {
  if (fileSize < 100 * 1024) {  // 100KB
    return 'blob';
  } else {
    return 'filesystem';
  }
}
```

### Compression Decision Logic

```typescript
function shouldCompress(fileSize: number): boolean {
  // Compress files between 10KB and 100KB
  return fileSize >= 10 * 1024 && fileSize < 100 * 1024;
}
```

### Compression Benefit Check

Compression is only applied if it reduces file size by at least 10%:

```typescript
if (compressed.length < original.length * 0.9) {
  // Use compressed version
}
```

## Performance Characteristics

| File Size | Storage | Compression | Read Performance | Write Performance |
|-----------|---------|-------------|------------------|-------------------|
| <10KB     | BLOB    | No          | Excellent        | Excellent         |
| 10-100KB  | BLOB    | Yes (gzip)  | Good             | Good              |
| >100KB    | Filesystem | No       | Excellent        | Good              |

### BLOB Advantages
- ✅ Transactional integrity with data
- ✅ Single-file backup (database includes files)
- ✅ Faster for small files (<100KB)
- ✅ No filesystem fragmentation

### Filesystem Advantages
- ✅ Database stays small
- ✅ Faster for large files (>1MB)
- ✅ OS-level caching
- ✅ Independent concurrent access
- ✅ Easier external file access

## Maintenance

### Orphaned Files

Files may become orphaned if:
- Database transaction fails but file was written
- Manual database edits
- Application crashes during file operations

**Cleanup:**
```typescript
const cleanedCount = await fileManager.cleanupOrphanedFiles();
console.log(`Cleaned up ${cleanedCount} orphaned files`);
```

### Database Vacuum

After deleting many files from BLOB storage, run VACUUM to reclaim space:

```sql
VACUUM;
```

**Note:** VACUUM can be slow on large databases. Consider running during maintenance windows.

## Best Practices

### 1. Use Appropriate Column Names
```typescript
// Good
{ name: 'product_image', type: 'BLOB' }
{ name: 'user_avatar', type: 'BLOB' }
{ name: 'invoice_pdf', type: 'BLOB' }

// Avoid generic names
{ name: 'file', type: 'BLOB' }
{ name: 'data', type: 'BLOB' }
```

### 2. Always Provide MIME Types
```typescript
// Good
{ mimeType: 'image/jpeg' }
{ mimeType: 'application/pdf' }

// Avoid
{ mimeType: undefined }
```

### 3. Handle File Deletion

When deleting rows, files are automatically deleted via CASCADE. But if updating a file column, manually delete the old file first:

```typescript
// Before uploading new file
await fileManager.deleteFile({ tableId, rowId, columnName });

// Then upload new file
await fileManager.storeFile({ tableId, rowId, columnName, ... });
```

### 4. Check File Size Before Upload

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (fileBuffer.length > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

### 5. Monitor Storage Statistics

Regularly check storage stats to understand usage patterns:

```typescript
const stats = fileManager.getStats();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Total size: ${(stats.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Compression saved: ${(stats.compressionSavedBytes / 1024).toFixed(2)} KB`);
```

## Troubleshooting

### Issue: "File not found" when downloading

**Cause:** File may have been deleted or filesystem file is missing.

**Solution:**
```typescript
// Check if file exists first
const files = fileManager.listFilesForRow(tableId, rowId);
if (files.length === 0) {
  console.log('No files attached');
}
```

### Issue: Database growing too large

**Cause:** Too many files stored in BLOB.

**Solution:**
- Reduce `blobThreshold` to move more files to filesystem
- Run VACUUM to reclaim space after deletions
- Consider migrating existing BLOBs to filesystem

### Issue: Orphaned files filling disk

**Cause:** Failed transactions left files in filesystem.

**Solution:**
```typescript
// Run cleanup periodically
const cleanedCount = await fileManager.cleanupOrphanedFiles();
```

## Migration from Path-Based Storage

If you're currently storing file paths directly in columns:

**Before:**
```typescript
// Old approach: Store path in TEXT column
{ product_image: '/path/to/image.png' }
```

**After:**
```typescript
// New approach: Use file storage manager
await fileManager.storeFile({
  tableId,
  rowId,
  columnName: 'product_image',
  filename: 'image.png',
  data: buffer
});

// Retrieve
const file = await fileManager.getFile({ tableId, rowId, columnName: 'product_image' });
```

## Related Files

- **Types**: `src/main/user-data/file-storage-types.ts`
- **Manager**: `src/main/user-data/file-storage-manager.ts`
- **Migration**: `src/main/sqlite/user-data-init.ts`
- **MCP Service**: `src/main/mcp/user-data/user-data-mcp-service.ts`
- **IPC Handlers**: `src/main/user-data/user-data-ipc-handler.ts`
- **User Data Types**: `src/main/user-data/types.ts`

## Summary

The file storage system provides a complete solution for storing files in user data tables:

✅ No SQLite extensions required (native BLOB support)
✅ Hybrid storage optimizes for different file sizes
✅ Automatic compression saves space
✅ Transactional integrity ensures data consistency
✅ MCP tools and IPC handlers provide easy access
✅ Maintenance tools prevent orphaned files

Use BLOB columns in your table schema, then use the file storage manager to handle actual file storage and retrieval.

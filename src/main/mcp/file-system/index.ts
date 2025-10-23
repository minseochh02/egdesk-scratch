/**
 * File System MCP Server - Main Exports
 * 
 * Provides a complete MCP server implementation for file system operations,
 * similar to Claude Desktop's file system tools.
 */

// Main server class
export { FileSystemMCPServer, createFileSystemMCPServer } from './file-system';
export type { FileSystemMCPServerConfig } from './file-system';

// Core service
export { FileSystemService, createFileSystemService, validateFilePath } from './file-system-service';
export type {
  FileInfo,
  DirectoryEntry,
  SearchResult,
  EditOperation
} from './file-system-service';

// Protocol handlers
export { FileSystemHTTPStreamHandler } from './http-stream-handler';
export { FileSystemSSEHandler } from './sse-handler';




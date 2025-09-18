/**
 * Main Process Tools
 * 
 * These tools run in the main process (Node.js environment) and have
 * full access to system APIs. They are exposed to the renderer process
 * via IPC handlers in main.ts.
 * 
 * Tools in this folder should:
 * - Read/write files
 * - Access databases  
 * - Execute system commands
 * - Access OS APIs
 * - Do anything requiring Node.js
 */

export { ReadFileTool, type ReadFileToolParams, type ReadFileResult, type FileInfoResult } from './read-file';
export { WriteFileTool, type WriteFileToolParams, type WriteFileResult } from './write-file';
export { ListDirectoryTool, type ListDirectoryParams, type ListDirectoryResult, type FileEntry } from './list-directory';
export { EditFileTool, type EditFileParams, type EditFileResult } from './edit-file';

// Future tools can be added here:
// export { DatabaseTool } from './database';
// export { SystemCommandTool } from './system-command';

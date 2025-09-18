/**
 * Homepage Editor Tools (Renderer Process)
 * 
 * These are client-side tools that run in the renderer process.
 * For file system operations, they use IPC to communicate with 
 * the main process tools that have the actual Node.js capabilities.
 * 
 * Tools in this folder should:
 * - Work with UI/React state
 * - Process data that's already in memory  
 * - Make HTTP requests (which browsers can do)
 * - Manipulate strings, arrays, objects, etc.
 * - Be simple IPC wrappers for main process tools
 */

export { ReadFileTool, type ReadFileToolParams, type ReadFileResult, type FileInfoResult } from './read-file';
export { WriteFileTool, type WriteFileToolParams, type WriteFileResult } from './write-file';

// Future tools can be added here:
// export { TextProcessor } from './text-processor';
// export { DataFormatter } from './data-formatter';

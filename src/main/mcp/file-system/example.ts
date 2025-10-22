/**
 * File System MCP Server - Example Usage
 * 
 * This file demonstrates how to use the File System MCP Server
 */

import { createFileSystemMCPServer } from './index';

/**
 * Example 1: Basic server setup
 */
async function basicExample() {
  console.log('📝 Example 1: Basic server setup');
  
  // Create a server with default configuration
  const server = createFileSystemMCPServer({
    allowedDirectories: [process.cwd()], // Allow access to current directory
    port: 3000,
    host: 'localhost'
  });

  // Start the server
  await server.start();
  console.log('✅ Server started');

  // Server is now running and can accept MCP connections
  // You can connect to it using:
  // - HTTP Streaming: POST http://localhost:3000/mcp
  // - SSE: GET http://localhost:3000/sse
  // - Health check: GET http://localhost:3000/health

  // Stop the server when done
  // await server.stop();
}

/**
 * Example 2: Multiple allowed directories
 */
async function multipleDirectoriesExample() {
  console.log('📝 Example 2: Multiple allowed directories');
  
  const server = createFileSystemMCPServer({
    allowedDirectories: [
      '/Users/username/projects',
      '/Users/username/documents',
      process.cwd()
    ],
    port: 3001
  });

  await server.start();
  console.log('✅ Server started with multiple allowed directories');
  
  // List allowed directories
  const allowedDirs = server.getService().listAllowedDirectories();
  console.log('📁 Allowed directories:', allowedDirs);
}

/**
 * Example 3: Using the service directly (without HTTP server)
 */
async function directServiceExample() {
  console.log('📝 Example 3: Using FileSystemService directly');
  
  const server = createFileSystemMCPServer({
    allowedDirectories: [process.cwd()]
  });

  const service = server.getService();

  try {
    // Read a file
    const content = await service.readFile('package.json');
    console.log('📄 Read package.json:', content.substring(0, 100) + '...');

    // List directory
    const entries = await service.listDirectory('.');
    console.log('📁 Directory entries:', entries.length);

    // Get file info
    const fileInfo = await service.getFileInfo('package.json');
    console.log('ℹ️ File info:', fileInfo);

    // Search files
    const searchResults = await service.searchFiles('.', '*.ts', {
      maxResults: 10
    });
    console.log('🔍 Search results:', searchResults.length);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 4: Testing with curl
 */
function curlExamples() {
  console.log('📝 Example 4: Testing with curl');
  console.log('\n1. Health check:');
  console.log('curl http://localhost:3000/health');
  
  console.log('\n2. Server info:');
  console.log('curl http://localhost:3000/');
  
  console.log('\n3. Initialize MCP session (HTTP Streaming):');
  console.log(`curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'`);
  
  console.log('\n4. List available tools:');
  console.log(`curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`);
  
  console.log('\n5. Call a tool (read file):');
  console.log(`curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"fs_read_file","arguments":{"path":"package.json"}}}'`);
}

/**
 * Available MCP Tools:
 * 
 * 1. fs_read_file - Read file contents
 * 2. fs_write_file - Write/overwrite file
 * 3. fs_edit_file - Make targeted edits
 * 4. fs_list_directory - List directory contents
 * 5. fs_create_directory - Create directories
 * 6. fs_move_file - Move/rename files
 * 7. fs_copy_file - Copy files
 * 8. fs_delete_file - Delete files/directories
 * 9. fs_search_files - Search for files
 * 10. fs_get_file_info - Get file metadata
 * 11. fs_get_directory_tree - Get directory tree
 * 12. fs_list_allowed_directories - List accessible directories
 */

// Run examples
if (require.main === module) {
  console.log('🚀 File System MCP Server Examples\n');
  
  // Uncomment the example you want to run:
  
  // basicExample();
  // multipleDirectoriesExample();
  // directServiceExample();
  curlExamples();
}

export {
  basicExample,
  multipleDirectoriesExample,
  directServiceExample,
  curlExamples
};


/**
 * File Conversion MCP Server - Main Exports
 * 
 * Provides file format conversion tools via MCP protocol
 */

// Main MCP service
export { FileConversionMCPService, createFileConversionMCPService } from './file-conversion-mcp-service';

// Core conversion service
export { FileConversionService, createFileConversionService } from './file-conversion-service';
export type { ConversionResult } from './file-conversion-service';

// Standalone server (for stdio/Claude Desktop)
// Import './file-conversion' for standalone MCP server


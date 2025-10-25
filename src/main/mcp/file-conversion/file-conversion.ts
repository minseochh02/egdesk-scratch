#!/usr/bin/env node
/**
 * File Conversion MCP Server
 * 
 * Provides Model Context Protocol server for file format conversions.
 * This server enables AI assistants to convert between various file formats.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FileConversionMCPService } from './file-conversion-mcp-service';

// Create MCP service instance
const conversionService = new FileConversionMCPService();

// Create MCP server
const server = new Server(
  conversionService.getServerInfo(),
  {
    capabilities: conversionService.getCapabilities(),
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: conversionService.listTools(),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    return await conversionService.executeTool(name, args || {});
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Initialize service
  await conversionService.initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('File Conversion MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});


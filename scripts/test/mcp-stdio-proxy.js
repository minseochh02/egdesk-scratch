#!/usr/bin/env node
/**
 * MCP Stdio Proxy for Claude Desktop
 * 
 * This wrapper allows Claude Desktop to connect to EGDesk's HTTP MCP server
 * via stdio transport by proxying requests between stdin/stdout and HTTP.
 * 
 * Usage in claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "egdesk-user-data": {
 *       "command": "node",
 *       "args": ["/path/to/egdesk-scratch/mcp-stdio-proxy.js", "user-data"]
 *     }
 *   }
 * }
 */

const http = require('http');
const readline = require('readline');

// Configuration
const BASE_URL = process.env.EGDESK_MCP_URL || 'http://localhost:8080';
const SERVICE = process.argv[2] || 'user-data'; // user-data, gmail, sheets, etc.
const SERVICE_URL = `${BASE_URL}/${SERVICE}`;

// Setup stdin/stdout communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Prevent readline from closing stdin prematurely
rl.on('close', () => {
  log('Connection closed');
  process.exit(0);
});

// Keep process alive
process.stdin.resume();

// Log to stderr (Claude Desktop ignores stderr)
function log(message) {
  console.error(`[MCP Stdio Proxy] ${message}`);
}

/**
 * Make HTTP request to local MCP server
 */
async function makeRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = `${SERVICE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    log(`${method} ${url}`);

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          resolve({ error: `Failed to parse response: ${err.message}` });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`HTTP request failed: ${err.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Handle MCP protocol messages
 */
async function handleMessage(message) {
  try {
    const request = JSON.parse(message);
    log(`Received: ${request.method || request.type}`);

    let response;

    // Handle different MCP message types
    switch (request.method) {
      case 'initialize':
        // Get server info and capabilities
        const info = await makeRequest('/tools', 'GET');
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: `egdesk-${SERVICE}`,
              version: '1.0.0'
            }
          }
        };
        break;

      case 'tools/list':
        // List available tools
        const toolsResponse = await makeRequest('/tools', 'GET');
        
        // Handle both array and object responses
        const toolsList = Array.isArray(toolsResponse) ? toolsResponse : (toolsResponse.tools || []);
        
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: toolsList
          }
        };
        break;

      case 'tools/call':
        // Execute tool
        const toolResult = await makeRequest('/tools/call', 'POST', {
          tool: request.params.name,
          arguments: request.params.arguments
        });
        
        // Ensure content is properly formatted
        let contentText;
        if (typeof toolResult.content === 'string') {
          contentText = toolResult.content;
        } else if (toolResult.content && Array.isArray(toolResult.content)) {
          // If content is already an array, extract text from first item
          contentText = toolResult.content[0]?.text || JSON.stringify(toolResult.content);
        } else {
          // Format as JSON string
          contentText = JSON.stringify(toolResult.content || toolResult, null, 2);
        }
        
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: contentText
              }
            ],
            isError: toolResult.isError || false
          }
        };
        break;

      case 'notifications/initialized':
        // Client confirms initialization - no response needed
        log('Client initialized');
        return;

      default:
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }

    // Send response to Claude Desktop via stdout
    if (response) {
      console.log(JSON.stringify(response));
      log(`Sent response for ${request.method}`);
    }

  } catch (err) {
    log(`Error handling message: ${err.message}`);
    const errorResponse = {
      jsonrpc: '2.0',
      id: 'error',
      error: {
        code: -32603,
        message: err.message
      }
    };
    console.log(JSON.stringify(errorResponse));
  }
}

// Main loop: read JSON-RPC messages from stdin
log(`Starting MCP stdio proxy for service: ${SERVICE}`);
log(`HTTP endpoint: ${SERVICE_URL}`);

rl.on('line', (line) => {
  if (line.trim()) {
    handleMessage(line);
  }
});

// Don't include this here - already defined above
// rl.on('close', () => {
//   log('Connection closed');
//   process.exit(0);
// });

// Handle process termination
process.on('SIGINT', () => {
  log('Received SIGINT, exiting');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, exiting');
  process.exit(0);
});

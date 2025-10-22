/**
 * Test HTTP Streamable MCP Protocol
 * 
 * This script demonstrates how to use the new HTTP Streamable transport
 * for MCP protocol communication.
 */

const http = require('http');

// Configuration
const HOST = 'localhost';
const PORT = 3000;
const MCP_ENDPOINT = '/mcp';

/**
 * Send a JSON-RPC request via HTTP Streamable
 */
function sendStreamableRequest(requests, onResponse, onEnd, onError) {
  console.log(`\n🚀 Connecting to http://${HOST}:${PORT}${MCP_ENDPOINT}`);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: MCP_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    }
  };

  const req = http.request(options, (res) => {
    console.log(`📡 Connection established (Status: ${res.statusCode})`);
    
    if (res.statusCode !== 200) {
      console.error(`❌ Unexpected status code: ${res.statusCode}`);
      let errorBody = '';
      res.on('data', chunk => {
        errorBody += chunk.toString();
      });
      res.on('end', () => {
        console.error('Error response:', errorBody);
        onError(new Error(`Server returned ${res.statusCode}: ${errorBody}`));
      });
      return;
    }

    // Buffer for incomplete JSON
    let buffer = '';

    // Handle incoming data stream
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Process complete JSON-RPC responses (newline-delimited)
      const lines = buffer.split('\n');
      
      // Keep the last line in buffer (might be incomplete)
      buffer = lines.pop() || '';
      
      // Process complete lines
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            console.log(`\n📨 Received response:`, JSON.stringify(response, null, 2));
            if (onResponse) {
              onResponse(response);
            }
          } catch (error) {
            console.error('❌ Error parsing JSON response:', error.message);
            console.error('Raw line:', line);
          }
        }
      }
    });

    res.on('end', () => {
      console.log('\n✅ Stream ended');
      if (onEnd) {
        onEnd();
      }
    });

    res.on('error', (error) => {
      console.error('❌ Response error:', error.message);
      if (onError) {
        onError(error);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    if (onError) {
      onError(error);
    }
  });

  // Send all requests
  console.log(`\n📤 Sending ${requests.length} request(s)...`);
  for (const request of requests) {
    const requestData = JSON.stringify(request) + '\n';
    console.log(`📤 Sending:`, JSON.stringify(request, null, 2));
    req.write(requestData);
  }

  // Note: Don't end the request immediately if you want to keep the stream open
  // for bidirectional communication. For this test, we'll end after sending.
  setTimeout(() => {
    console.log('\n🔚 Closing request stream');
    req.end();
  }, 1000);
}

/**
 * Test 1: Initialize and list tools
 */
function test1_InitializeAndListTools() {
  console.log('\n=== Test 1: Initialize and List Tools ===');
  
  const requests = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }
  ];

  let responseCount = 0;
  
  sendStreamableRequest(
    requests,
    (response) => {
      responseCount++;
      console.log(`✅ Response ${responseCount} received for ID: ${response.id}`);
    },
    () => {
      console.log(`\n✅ Test 1 completed: ${responseCount}/${requests.length} responses received`);
    },
    (error) => {
      console.error(`\n❌ Test 1 failed:`, error.message);
    }
  );
}

/**
 * Test 2: Ping test
 */
function test2_Ping() {
  console.log('\n=== Test 2: Ping Test ===');
  
  const requests = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'ping',
      params: {}
    }
  ];

  sendStreamableRequest(
    requests,
    (response) => {
      if (response.result && response.result.message === 'pong') {
        console.log('✅ PING/PONG successful!');
      } else {
        console.log('⚠️  Unexpected ping response:', response);
      }
    },
    () => {
      console.log('\n✅ Test 2 completed');
    },
    (error) => {
      console.error(`\n❌ Test 2 failed:`, error.message);
    }
  );
}

/**
 * Test 3: Full workflow (initialize + list + call tool)
 */
function test3_FullWorkflow() {
  console.log('\n=== Test 3: Full Workflow (Initialize + List + Call Tool) ===');
  
  const requests = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'gmail_list_users',
        arguments: {}
      }
    }
  ];

  let responseCount = 0;
  
  sendStreamableRequest(
    requests,
    (response) => {
      responseCount++;
      console.log(`✅ Response ${responseCount} received for ID: ${response.id}`);
      
      if (response.id === 2 && response.result && response.result.tools) {
        console.log(`📋 Found ${response.result.tools.length} tools`);
      }
      
      if (response.id === 3 && response.result) {
        console.log(`🔧 Tool execution result available`);
      }
    },
    () => {
      console.log(`\n✅ Test 3 completed: ${responseCount}/${requests.length} responses received`);
    },
    (error) => {
      console.error(`\n❌ Test 3 failed:`, error.message);
    }
  );
}

// Run tests
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   HTTP Streamable MCP Protocol Test Suite                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\n📍 Server: http://${HOST}:${PORT}${MCP_ENDPOINT}`);
console.log('⚠️  Note: Make sure the server is running and Gmail MCP is enabled!\n');

// Parse command line arguments
const args = process.argv.slice(2);
const testToRun = args[0] || 'all';

switch (testToRun) {
  case '1':
    test1_InitializeAndListTools();
    break;
  case '2':
    test2_Ping();
    break;
  case '3':
    test3_FullWorkflow();
    break;
  case 'all':
  default:
    console.log('Running all tests...\n');
    test1_InitializeAndListTools();
    
    setTimeout(() => {
      test2_Ping();
    }, 3000);
    
    setTimeout(() => {
      test3_FullWorkflow();
    }, 6000);
    break;
}

console.log('\n💡 Usage: node test-http-streamable.js [test_number]');
console.log('   test_number: 1, 2, 3, or "all" (default)');


/**
 * Simple test for the tunnel service connection
 * Tests the WebSocket connection without importing the full MCP server
 */

const WebSocket = require('ws');
const http = require('http');

// Create a simple local HTTP server to test with
const localPort = 3456;
const localServer = http.createServer((req, res) => {
  console.log(`[Local Server] Received: ${req.method} ${req.url}`);
  
  // Read body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Hello from local server!',
      method: req.method,
      path: req.url,
      timestamp: new Date().toISOString()
    }));
  });
});

localServer.listen(localPort, () => {
  console.log(`✅ Local test server running on http://localhost:${localPort}`);
  
  // Connect to tunnel service
  const tunnelServerUrl = 'https://tunneling-service.onrender.com';
  const wsUrl = tunnelServerUrl.replace('https://', 'wss://') + '/tunnel/connect';
  
  console.log(`🔌 Connecting to tunnel server: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log(`✅ WebSocket connected`);
  });
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'connected') {
        console.log('\n🎉 Tunnel established!');
        console.log('=====================================');
        console.log(`📡 Tunnel ID: ${message.tunnel_id}`);
        console.log(`🌐 Public URL: ${message.public_url}`);
        console.log('=====================================\n');
        console.log('Try accessing your public URL in a browser or with curl!');
        console.log(`Example: curl ${message.public_url}`);
        console.log('\nPress Ctrl+C to stop\n');
        
      } else if (message.type === 'request') {
        console.log(`\n→ ${message.method} ${message.path}`);
        
        // Forward request to local server
        const options = {
          hostname: 'localhost',
          port: localPort,
          path: message.path,
          method: message.method,
          headers: message.headers,
        };
        
        const req = http.request(options, (res) => {
          let responseBody = '';
          
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          
          res.on('end', () => {
            // Convert headers to plain object
            const headers = {};
            Object.entries(res.headers).forEach(([key, value]) => {
              if (typeof value === 'string') {
                headers[key] = value;
              } else if (Array.isArray(value)) {
                headers[key] = value.join(', ');
              }
            });
            
            // Send response back through tunnel
            const response = {
              type: 'response',
              request_id: message.request_id,
              status_code: res.statusCode,
              headers: headers,
              body: responseBody
            };
            
            ws.send(JSON.stringify(response));
            console.log(`← ${res.statusCode} ${message.method} ${message.path}`);
          });
        });
        
        req.on('error', (err) => {
          console.error('Error forwarding request:', err);
          // Send error response
          const errorResponse = {
            type: 'response',
            request_id: message.request_id,
            status_code: 502,
            headers: {},
            body: JSON.stringify({ error: err.message })
          };
          ws.send(JSON.stringify(errorResponse));
        });
        
        // Send request body if present
        if (message.body) {
          req.write(message.body);
        }
        
        req.end();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('❌ WebSocket disconnected');
    process.exit(0);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  // Handle cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    ws.close();
    localServer.close();
    process.exit(0);
  });
});



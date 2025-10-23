/**
 * Test script for the updated tunnel client
 * This connects to https://tunneling-service.onrender.com/
 */

const { TunnelClient } = require('./dist-mcp/server.js'); // Adjust path if needed
const http = require('http');

// Create a simple local HTTP server to test with
const localPort = 3456;
const localServer = http.createServer((req, res) => {
  console.log(`[Local Server] Received: ${req.method} ${req.url}`);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Hello from local server!',
    method: req.method,
    path: req.url,
    timestamp: new Date().toISOString()
  }));
});

localServer.listen(localPort, () => {
  console.log(`✅ Local test server running on http://localhost:${localPort}`);
  
  // Create tunnel client
  const tunnelClient = new TunnelClient({
    tunnelServerUrl: 'https://tunneling-service.onrender.com',
    localServerUrl: `http://localhost:${localPort}`,
    reconnectInterval: 5000
  });

  // Start the tunnel
  tunnelClient.start().then(() => {
    console.log('\n🎉 Tunnel client started!');
    console.log('Waiting for public URL...\n');
    
    // Wait a bit for connection, then show the public URL
    setTimeout(() => {
      const publicUrl = tunnelClient.getPublicUrl();
      const tunnelId = tunnelClient.getTunnelId();
      
      if (publicUrl) {
        console.log('\n📌 TUNNEL READY!');
        console.log('=====================================');
        console.log(`🌐 Public URL: ${publicUrl}`);
        console.log(`🔑 Tunnel ID: ${tunnelId}`);
        console.log('=====================================\n');
        console.log('Try accessing your public URL in a browser or with curl!');
        console.log(`Example: curl ${publicUrl}`);
      } else {
        console.log('⏳ Still connecting... Please wait a moment.');
      }
    }, 2000);
  }).catch(error => {
    console.error('❌ Failed to start tunnel:', error);
    process.exit(1);
  });

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await tunnelClient.stop();
    localServer.close();
    process.exit(0);
  });
});





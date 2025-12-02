// Store active WebSocket connections: mcpName -> Set of WebSockets
const connections = new Map<string, Set<WebSocket>>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve((req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const mcpName = url.searchParams.get('name');
    
    console.log(`📥 Incoming request: ${req.method} ${url.pathname}?name=${mcpName}`);
    
    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.get('upgrade') || '';
    
    if (upgrade.toLowerCase() !== 'websocket') {
      console.log(`❌ Not a WebSocket upgrade request. Upgrade header: ${upgrade}`);
      return new Response("Request must be a WebSocket upgrade", { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!mcpName) {
      console.log(`❌ Missing 'name' parameter`);
      return new Response("Missing 'name' parameter for MCP server", { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    console.log(`🔄 Upgrading to WebSocket for: ${mcpName}`);
    
    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log(`🔌 WebSocket opened for MCP: ${mcpName}`);
      
      // Add this socket to the connections map
      if (!connections.has(mcpName)) {
        connections.set(mcpName, new Set());
      }
      connections.get(mcpName)!.add(socket);
      
      console.log(`📊 Active connections for ${mcpName}:`, connections.get(mcpName)!.size);
    };

    socket.onmessage = (e) => {
      try {
        console.log(`📨 Message received for ${mcpName}:`, e.data.substring(0, 100));
        
        // Parse the message
        const message = JSON.parse(e.data);
        
        // Broadcast to all other connections for this MCP server
        const mcpConnections = connections.get(mcpName);
        if (mcpConnections) {
          for (const conn of mcpConnections) {
            if (conn !== socket && conn.readyState === WebSocket.OPEN) {
              conn.send(e.data);
              console.log(`📤 Forwarded message to another connection`);
            }
          }
        }
        
        // Echo back for testing/acknowledgment
        if (message.type === 'ping') {
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            originalTimestamp: message.timestamp
          }));
          console.log(`🏓 Sent PONG response`);
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    };

    socket.onerror = (e) => {
      console.error(`❌ WebSocket error for ${mcpName}:`, e);
    };

    socket.onclose = () => {
      console.log(`🔌 WebSocket closed for MCP: ${mcpName}`);
      
      // Remove this socket from the connections map
      const mcpConnections = connections.get(mcpName);
      if (mcpConnections) {
        mcpConnections.delete(socket);
        console.log(`📊 Remaining connections for ${mcpName}:`, mcpConnections.size);
        
        // Clean up empty connection sets
        if (mcpConnections.size === 0) {
          connections.delete(mcpName);
          console.log(`🧹 Removed empty connection set for ${mcpName}`);
        }
      }
    };

    return response;
  } catch (error) {
    console.error('❌ Fatal error in edge function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

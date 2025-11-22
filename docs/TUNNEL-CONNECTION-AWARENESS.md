# Tunnel Service Connection Awareness

## Overview

The tunnel service now has **connection awareness** to detect when WebSocket tunnels or HTTP/SSE streams get disconnected. This prevents resource leaks and ensures the system properly handles network interruptions.

## Problem Solved

Previously, the tunnel service was unaware when:
1. **WebSocket tunnels** silently disconnected (network issues, client crashes)
2. **SSE streams** closed on the client side (browser tab closed, network dropped)
3. **HTTP streams** were abandoned without proper cleanup

This led to:
- Resource leaks (memory, file descriptors)
- Active stream requests continuing unnecessarily
- No detection of stale connections

## Solution Implemented

### 1. WebSocket Heartbeat (Ping/Pong)

**Server Side (`tunnel-service/main.py`):**
- Sends `ping` messages every 30 seconds to all connected tunnel clients
- Monitors for `pong` responses to verify connection health
- Automatically cleans up dead connections

```python
async def heartbeat():
    """Send periodic pings to detect connection health"""
    try:
        while True:
            await asyncio.sleep(30)  # Ping every 30 seconds
            try:
                await websocket.send_json({"type": "ping", "timestamp": datetime.now().isoformat()})
            except Exception as e:
                print(f"💔 Heartbeat failed for {tunnel_id}: {e}")
                break
    except asyncio.CancelledError:
        pass
```

**Client Side (`tunnel-client.ts`):**
- Listens for `ping` messages
- Responds with `pong` to acknowledge connection is alive

```typescript
else if (message.type === 'ping') {
    // Respond to heartbeat ping
    console.log(`💓 Received heartbeat ping`);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'pong',
            timestamp: message.timestamp
        }));
    }
}
```

### 2. SSE Stream Disconnect Detection

**Server Side (`tunnel-service/main.py`):**
- Detects when SSE client disconnects via `asyncio.CancelledError`
- Notifies tunnel client to stop streaming
- Cleans up stream queues

```python
except asyncio.CancelledError:
    # Client disconnected - this is raised when the HTTP connection closes
    print(f"🔌 SSE client disconnected: {request_id}")
    client_disconnected.set()
    
    # Notify tunnel client to stop streaming
    try:
        await websocket.send_json({
            "type": "stream_cancel",
            "request_id": request_id
        })
    except:
        pass
```

**Client Side (`tunnel-client.ts`):**
- Listens for `stream_cancel` messages
- Destroys active HTTP requests
- Stops unnecessary data transmission

```typescript
else if (message.type === 'stream_cancel') {
    // Client disconnected from SSE stream - cancel the request
    const requestId = message.request_id;
    console.log(`🛑 Received stream cancellation for ${requestId}`);
    const activeRequest = this.activeStreamRequests.get(requestId);
    if (activeRequest) {
        activeRequest.destroy();
        this.activeStreamRequests.delete(requestId);
        console.log(`✅ Cancelled stream request ${requestId}`);
    }
}
```

### 3. Active Stream Request Tracking

**Client Side (`tunnel-client.ts`):**
- Tracks all active SSE stream requests in a Map
- Allows cancellation by request ID
- Automatic cleanup on disconnect

```typescript
private activeStreamRequests: Map<string, http.ClientRequest> = new Map();

// Track streaming request
this.activeStreamRequests.set(request.request_id, req);

// Clean up on completion
res.on('end', () => {
    this.activeStreamRequests.delete(request.request_id);
});

// Clean up all on disconnect
if (this.activeStreamRequests.size > 0) {
    console.log(`🧹 Cleaning up ${this.activeStreamRequests.size} active stream request(s)`);
    for (const [requestId, req] of this.activeStreamRequests.entries()) {
        req.destroy();
    }
    this.activeStreamRequests.clear();
}
```

## Benefits

### 1. **Resource Management**
- No memory leaks from abandoned streams
- Proper cleanup of file descriptors
- Efficient queue management

### 2. **Network Resilience**
- Detects silent disconnections
- Automatic reconnection on failure
- Graceful degradation

### 3. **Observability**
- Clear logging of connection states
- Heartbeat acknowledgments
- Stream lifecycle tracking

### 4. **User Experience**
- Faster detection of connection issues
- Cleaner error handling
- Predictable behavior

## Message Protocol

### New Message Types

#### `ping` (Server → Client)
```json
{
    "type": "ping",
    "timestamp": "2025-10-25T12:34:56.789Z"
}
```

#### `pong` (Client → Server)
```json
{
    "type": "pong",
    "timestamp": "2025-10-25T12:34:56.789Z"
}
```

#### `stream_cancel` (Server → Client)
```json
{
    "type": "stream_cancel",
    "request_id": "abc-123-def-456"
}
```

## Configuration

### Heartbeat Interval
Default: **30 seconds**

Can be adjusted in `main.py`:
```python
await asyncio.sleep(30)  # Ping every 30 seconds
```

### SSE Keepalive Timeout
Default: **30 seconds**

Can be adjusted in `main.py`:
```python
chunk_data = await asyncio.wait_for(stream_queue.get(), timeout=30.0)
```

## Testing

### Test Heartbeat
1. Start tunnel server and client
2. Observe ping/pong messages every 30 seconds
3. Kill client process
4. Server should detect disconnect and clean up

### Test SSE Cancellation
1. Start SSE stream from browser
2. Close browser tab or navigate away
3. Server detects cancellation
4. Client receives `stream_cancel` and stops streaming
5. Verify cleanup in logs

## Monitoring

Look for these log messages:

**Heartbeat:**
- `💓 Heartbeat acknowledged for {tunnel_id}` - Connection is healthy
- `💔 Heartbeat failed for {tunnel_id}` - Connection is dead

**Stream Management:**
- `🔌 SSE client disconnected: {request_id}` - Client closed connection
- `🛑 Cancelling stream: {request_id}` - Client stopped streaming
- `🧹 Cleaned up stream: {request_id}` - Resources freed

**Connection Lifecycle:**
- `✓ Tunnel established: {tunnel_id}` - New connection
- `✗ Tunnel disconnected: {tunnel_id}` - Clean disconnect
- `✗ Tunnel error for {tunnel_id}: {error}` - Error disconnect

## Architecture

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│   Browser   │                    │    Tunnel    │                    │   Tunnel    │
│  (SSE)      │◄──────────────────►│   Server     │◄──────────────────►│   Client    │
│             │   HTTP/SSE         │  (FastAPI)   │   WebSocket        │ (TypeScript)│
└─────────────┘                    └──────────────┘                    └─────────────┘
                                           │                                    │
                                           │                                    │
                                    ┌──────▼──────┐                      ┌──────▼──────┐
                                    │  Heartbeat  │                      │   Stream    │
                                    │   Monitor   │                      │   Tracker   │
                                    │             │                      │             │
                                    │ - Ping/Pong │                      │ - Active    │
                                    │ - 30s int.  │                      │   Requests  │
                                    │ - Auto      │                      │ - Cancel    │
                                    │   cleanup   │                      │   Support   │
                                    └─────────────┘                      └─────────────┘
```

## Future Enhancements

1. **Configurable Timeouts**
   - Make heartbeat interval configurable per tunnel
   - Allow custom SSE keepalive timeouts

2. **Connection Quality Metrics**
   - Track ping response times
   - Monitor packet loss
   - Report connection quality

3. **Graceful Stream Migration**
   - Resume SSE streams on reconnect
   - Preserve stream state
   - Avoid data duplication

4. **Advanced Monitoring**
   - Prometheus metrics
   - Connection health dashboard
   - Alert on repeated failures

## Related Files

- `/tunnel-service/main.py` - Server-side implementation
- `/tunnel-service/client.py` - Python client implementation
- `/egdesk-scratch/src/main/mcp/server-creator/tunnel-client.ts` - TypeScript client
- `/egdesk-scratch/src/main/mcp/server-creator/tunneling-manager.ts` - Tunnel manager

## Version History

- **v2.0** (Oct 2025) - Added connection awareness
  - Heartbeat ping/pong
  - SSE disconnect detection
  - Active request tracking
  - Automatic cleanup

- **v1.0** (Earlier) - Basic tunnel functionality
  - WebSocket tunneling
  - SSE streaming
  - Authentication


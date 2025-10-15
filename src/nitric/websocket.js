import { websocket, bucket } from "@nitric/sdk";

// Real-time WebSocket API with auto-scaling
const socket = websocket("realtime");
const connectionStorage = bucket("websocket-connections").allow("read", "write", "delete");
const messageStorage = bucket("messages").allow("read", "write", "delete");

// Handle new connections
socket.on("connect", async (ctx) => {
  const connectionId = ctx.req.connectionId;
  const timestamp = new Date().toISOString();
  
  console.log(`New WebSocket connection: ${connectionId}`);
  
  // Store connection metadata
  await connectionStorage.file(`${connectionId}.json`).write(JSON.stringify({
    connectionId,
    connectedAt: timestamp,
    userAgent: ctx.req.headers["user-agent"] || "unknown",
    status: "active"
  }));
  
  // Send welcome message
  await ctx.res.send(JSON.stringify({
    type: "welcome",
    connectionId,
    message: "Connected to Nitric WebSocket API",
    timestamp,
    capabilities: {
      realTime: true,
      autoScaling: true,
      globalDistribution: true,
      serverless: true
    }
  }));
});

// Handle incoming messages
socket.on("message", async (ctx) => {
  const connectionId = ctx.req.connectionId;
  const messageData = JSON.parse(ctx.req.data);
  const messageId = Date.now().toString();
  
  console.log(`Message from ${connectionId}:`, messageData);
  
  try {
    // Store message
    await messageStorage.file(`${messageId}.json`).write(JSON.stringify({
      messageId,
      connectionId,
      data: messageData,
      timestamp: new Date().toISOString(),
      processed: false
    }));
    
    // Process different message types
    let response;
    
    switch (messageData.type) {
      case "ping":
        response = {
          type: "pong",
          timestamp: new Date().toISOString(),
          originalMessage: messageData
        };
        break;
        
      case "ai-request":
        response = {
          type: "ai-response",
          requestId: messageData.requestId || messageId,
          result: `AI processed: ${messageData.prompt?.substring(0, 50)}...`,
          timestamp: new Date().toISOString(),
          model: "claude-3-sonnet",
          serverless: true
        };
        break;
        
      case "history-update":
        // Update browser history in real-time
        response = {
          type: "history-updated",
          entries: messageData.entries || [],
          count: messageData.entries?.length || 0,
          timestamp: new Date().toISOString()
        };
        break;
        
      case "status-check":
        response = {
          type: "status-response",
          status: "healthy",
          uptime: Math.floor(process.uptime()),
          framework: "nitric",
          serverless: true,
          timestamp: new Date().toISOString()
        };
        break;
        
      default:
        response = {
          type: "echo",
          originalMessage: messageData,
          timestamp: new Date().toISOString(),
          note: "Message echoed back"
        };
    }
    
    // Send response back to client
    await ctx.res.send(JSON.stringify(response));
    
    // Mark message as processed
    await messageStorage.file(`${messageId}.json`).write(JSON.stringify({
      messageId,
      connectionId,
      data: messageData,
      timestamp: new Date().toISOString(),
      processed: true,
      response
    }));
    
  } catch (error) {
    console.error(`Error processing message from ${connectionId}:`, error);
    
    // Send error response
    await ctx.res.send(JSON.stringify({
      type: "error",
      message: "Failed to process message",
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
});

// Handle disconnections
socket.on("disconnect", async (ctx) => {
  const connectionId = ctx.req.connectionId;
  
  console.log(`WebSocket disconnected: ${connectionId}`);
  
  try {
    // Update connection status
    const connectionData = await connectionStorage.file(`${connectionId}.json`).read();
    const connection = JSON.parse(connectionData);
    
    connection.status = "disconnected";
    connection.disconnectedAt = new Date().toISOString();
    connection.duration = new Date() - new Date(connection.connectedAt);
    
    await connectionStorage.file(`${connectionId}.json`).write(JSON.stringify(connection));
    
  } catch (error) {
    console.error(`Error handling disconnect for ${connectionId}:`, error);
  }
});
#!/usr/bin/env node

/**
 * Deployment Verification Test
 * Tests the AI Bridge server endpoints and functionality
 */

import { createAIBridgeServer } from './src/ai-bridge.js';
import { WebSocket } from 'ws';

async function runDeploymentTest() {
  console.log('🧪 Starting Deployment Verification Test...');
  
  let server;
  
  try {
    // Start the server
    console.log('📡 Starting AI Bridge Server...');
    server = await createAIBridgeServer({
      wsPort: 0, // Use random available port
      httpPort: 0, // Use random available port
      logger: {
        log: () => {}, // Suppress logs during test
        error: console.error,
        warn: () => {}
      }
    });
    
    const { ws: wsPort, http: httpPort } = server.ports;
    console.log(`✅ Server started on HTTP:${httpPort}, WS:${wsPort}`);
    
    // Test HTTP endpoints
    console.log('\n🌐 Testing HTTP Endpoints...');
    
    // Test /health endpoint
    const healthResponse = await fetch(`http://localhost:${httpPort}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ /health endpoint:', healthData.status);
    } else {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    // Test /api/status endpoint
    const statusResponse = await fetch(`http://localhost:${httpPort}/api/status`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ /api/status endpoint:', statusData.service);
      console.log('   - Uptime:', statusData.uptime + 's');
      console.log('   - WebSocket enabled:', statusData.websocket.enabled);
    } else {
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }
    
    // Test root endpoint
    const rootResponse = await fetch(`http://localhost:${httpPort}/`);
    if (rootResponse.ok) {
      const rootData = await rootResponse.json();
      console.log('✅ Root endpoint:', rootData.service);
    } else {
      throw new Error(`Root endpoint failed: ${rootResponse.status}`);
    }
    
    // Test WebSocket connection
    console.log('\n🔌 Testing WebSocket Connection...');
    
    const ws = new WebSocket(`ws://localhost:${wsPort}`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket connected');
        
        // Test agent registration
        ws.send(JSON.stringify({
          type: 'register',
          role: 'test-agent',
          clientId: 'test-123'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'registered') {
          console.log('✅ Agent registration successful:', message.client.id);
          ws.close();
          resolve();
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // Test message routing
    console.log('\n📨 Testing Message Routing...');
    
    const sendResponse = await fetch(`http://localhost:${httpPort}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'test.message',
        payload: { test: 'deployment verification' }
      })
    });
    
    if (sendResponse.ok) {
      const sendData = await sendResponse.json();
      console.log('✅ Message routing:', sendData.status);
    } else {
      throw new Error(`Message routing failed: ${sendResponse.status}`);
    }
    
    // Performance test
    console.log('\n⚡ Testing Performance...');
    const perfStart = Date.now();
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(fetch(`http://localhost:${httpPort}/health`));
    }
    
    await Promise.all(promises);
    const perfTime = Date.now() - perfStart;
    console.log(`✅ Performance test: 10 requests in ${perfTime}ms (${(perfTime/10).toFixed(1)}ms avg)`);
    
    // Final verification
    const finalStatusResponse = await fetch(`http://localhost:${httpPort}/api/status`);
    const finalStatusData = await finalStatusResponse.json();
    
    console.log('\n📊 Final Status Report:');
    console.log('   - Service:', finalStatusData.service);
    console.log('   - Status:', finalStatusData.status);
    console.log('   - Messages Processed:', finalStatusData.performance.messagesProcessed);
    console.log('   - Connected Clients:', finalStatusData.performance.connectedClients);
    console.log('   - Errors:', finalStatusData.performance.errors);
    
    console.log('\n🎉 All tests passed! Deployment verification successful.');
    console.log('\n✅ Ready for production deployment!');
    
  } catch (error) {
    console.error('\n❌ Deployment verification failed:', error.message);
    process.exit(1);
  } finally {
    if (server) {
      await server.close();
      console.log('🔒 Server stopped');
    }
  }
}

// Add fetch polyfill for Node.js
if (!globalThis.fetch) {
  console.log('Adding fetch polyfill...');
  const { default: fetch } = await import('node-fetch');
  globalThis.fetch = fetch;
}

// Run the test
runDeploymentTest().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
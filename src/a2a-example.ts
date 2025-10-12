/**
 * Example usage of A2A Agent Server
 * 
 * This file demonstrates how to create and run an A2A (Agent-to-Agent) protocol server
 * with proper configuration and error handling.
 */

import { createA2AServer } from './a2a-agent-server';

// Configuration for the A2A agent
const agentConfig = {
  name: 'Example A2A Agent',
  version: '1.0.0',
  description: 'An example Agent-to-Agent protocol implementation',
  supportedTransports: ['http'], // Only advertise HTTP for now
  endpoints: {
    http: 'http://localhost:3000'
    // Note: WebSocket endpoint is optional and only included if implemented
    // websocket: 'ws://localhost:3000'
  }
};

// Server configuration
const serverConfig = {
  port: 3000,
  agentConfig,
  enableWebSocket: false // Set to true to enable WebSocket support
};

// Create and start the A2A server
try {
  const { app, server } = createA2AServer(serverConfig);

  console.log('\n=== A2A Agent Server Started ===');
  console.log('Server is running with the following endpoints:');
  console.log('- Health Check: http://localhost:3000/health');
  console.log('- Status: http://localhost:3000/status');
  console.log('- Capabilities: http://localhost:3000/capabilities');
  console.log('\nAgent will only advertise configured transports.');
  console.log('Status will show: initializing, ready, or error\n');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nShutting down A2A server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down A2A server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('Failed to start A2A server:', error);
  process.exit(1);
}

// Export for testing
export { agentConfig, serverConfig };

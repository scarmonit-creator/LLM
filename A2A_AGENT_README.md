# A2A Agent (Agent-to-Agent Protocol) Implementation

## Overview

This implementation provides a robust Agent-to-Agent (A2A) protocol server with proper initialization error handling, retry logic, and comprehensive endpoint management.

## Features

✅ **Robust Initialization** - Proper error handling with automatic retry logic (up to 3 attempts)
✅ **No Half-Built Instances** - Cached agents are cleared automatically after failed initialization
✅ **Health Check Endpoints** - Real-time agent status reporting ('initializing', 'ready', or 'error')
✅ **Accurate Capability Advertisement** - Only advertises actually implemented transports and endpoints
✅ **WebSocket Support** - Optional WebSocket transport (only advertised if configured)
✅ **TypeScript** - Full type safety with TypeScript implementation
✅ **Comprehensive Tests** - Full test coverage for all functionality
✅ **Express Middleware** - Easy integration with existing Express applications

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the A2A Agent Server

```bash
npm run a2a
```

The server will start on port 3000 with the following endpoints:
- Health Check: http://localhost:3000/health
- Status: http://localhost:3000/status
- Capabilities: http://localhost:3000/capabilities

### 3. Run in Development Mode (with auto-reload)

```bash
npm run a2a:dev
```

## Architecture

### Core Components

#### 1. A2AAgent Class
- Handles agent initialization with retry logic
- Validates configuration (name, transports, endpoints)
- Manages agent lifecycle and status
- Ensures only valid transports are advertised

#### 2. Express Middleware
- Creates/caches agent instances per request
- Clears failed agents from cache to prevent half-built instances
- Attaches agent to request object for downstream use
- Returns 500 error if initialization fails after retries

#### 3. Health Check Endpoints

**GET /health**
- Returns: `{ status: 'initializing' | 'ready' | 'error', lastHealthCheck: Date, error?: string }`
- Status: 200 (if agent exists), 503 (if not initialized)
- Use this for monitoring and load balancer health checks

**GET /status**
- Returns: `{ id: string, status: string, lastHealthCheck: Date, error?: string, uptime: number }`
- Status: 200 (if agent exists), 503 (if not initialized)
- Provides detailed agent status information

**GET /capabilities**
- Returns: Agent capabilities with ONLY implemented transports and endpoints
- Status: 200 (if agent exists), 503 (if not initialized)
- Example response:
```json
{
  "name": "Example A2A Agent",
  "version": "1.0.0",
  "description": "An example Agent-to-Agent protocol implementation",
  "supportedTransports": ["http"],
  "endpoints": {
    "http": "http://localhost:3000"
  }
}
```

## Configuration

### Agent Configuration Object

```typescript
const agentConfig = {
  name: 'My A2A Agent',              // Required: Agent name
  version: '1.0.0',                  // Required: Agent version
  description: 'Agent description',  // Optional: Agent description
  supportedTransports: ['http'],     // Required: List of transports
  endpoints: {
    http: 'http://localhost:3000'    // Required if 'http' in transports
    // websocket: 'ws://localhost:3000'  // Required if 'websocket' in transports
  }
};
```

### Server Configuration Object

```typescript
const serverConfig = {
  port: 3000,                        // Server port
  agentConfig,                       // Agent configuration (see above)
  enableWebSocket: false             // Enable WebSocket support (optional)
};
```

## Error Handling

### Initialization Failures

The A2A agent implements robust error handling:

1. **Validation Errors**: Invalid configurations are caught immediately
2. **Retry Logic**: Failed initializations are retried up to 3 times with exponential backoff
3. **Cache Clearing**: Failed agents are removed from cache to prevent half-built instances
4. **Error Reporting**: Errors are properly propagated and logged

### Common Initialization Errors

- **Empty agent name**: Agent name is required
- **Invalid transport**: Only 'http' and 'websocket' are supported
- **Missing endpoint**: HTTP endpoint required when HTTP transport is enabled
- **Mismatched configuration**: WebSocket transport enabled but no endpoint configured

## Transport Advertisement

The A2A agent **only advertises transports that are actually configured**:

- If `supportedTransports: ['http']` and no WebSocket endpoint → Only HTTP is advertised
- If `supportedTransports: ['http', 'websocket']` but `enableWebSocket: false` → WebSocket is removed
- If WebSocket endpoint is configured but `enableWebSocket: false` → WebSocket is not advertised

This ensures the capabilities endpoint always reflects the actual server configuration.

## Testing

### Run A2A Tests

```bash
npm run test:a2a
```

### Run All Tests

```bash
npm run test:all
```

### Build and Verify

```bash
npm run verify:all
```

This runs:
1. TypeScript compilation
2. ESLint linting
3. Prettier formatting
4. All test suites (including A2A tests)

## Example Usage

See `src/a2a-example.ts` for a complete working example:

```typescript
import { createA2AServer } from './a2a-agent-server';

const { app, server } = createA2AServer({
  port: 3000,
  agentConfig: {
    name: 'Example A2A Agent',
    version: '1.0.0',
    supportedTransports: ['http'],
    endpoints: {
      http: 'http://localhost:3000'
    }
  },
  enableWebSocket: false
});
```

## API Integration

### Using the Middleware

```typescript
import express from 'express';
import { createA2AMiddleware, healthCheckHandler, statusHandler, capabilitiesHandler } from './a2a-agent-server';

const app = express();

// Apply A2A middleware
app.use(createA2AMiddleware({
  name: 'My Agent',
  version: '1.0.0',
  supportedTransports: ['http'],
  endpoints: { http: 'http://localhost:3000' }
}));

// Add health check endpoints
app.get('/health', healthCheckHandler);
app.get('/status', statusHandler);
app.get('/capabilities', capabilitiesHandler);

// Your custom routes
app.get('/api/data', (req, res) => {
  // Agent is available on req.agent
  const agent = (req as any).agent;
  res.json({ agent: agent.id, status: agent.status });
});
```

## WebSocket Support

To enable WebSocket support:

```typescript
const { app, server } = createA2AServer({
  port: 3000,
  agentConfig: {
    name: 'WebSocket Agent',
    version: '1.0.0',
    supportedTransports: ['http', 'websocket'],
    endpoints: {
      http: 'http://localhost:3000',
      websocket: 'ws://localhost:3000'
    }
  },
  enableWebSocket: true  // Enable WebSocket server
});
```

WebSocket connections will be available at `ws://localhost:3000`.

## Monitoring and Health Checks

### Health Check Status Values

- **initializing**: Agent is currently initializing (temporary state)
- **ready**: Agent is fully initialized and ready to process requests
- **error**: Agent initialization failed (includes error details)

### Load Balancer Integration

Use the `/health` endpoint for load balancer health checks:

```bash
# Example health check
curl http://localhost:3000/health

# Expected response when healthy:
{
  "status": "ready",
  "lastHealthCheck": "2025-10-12T19:46:00.000Z"
}

# Expected response when initializing:
{
  "status": "initializing",
  "message": "Agent not initialized"
}
```

## Troubleshooting

### Agent Stuck in "initializing" State

**Problem**: The health check always returns "initializing"

**Solution**: This issue is fixed in the current implementation. The agent cache is properly cleared after failed initialization, and retry logic ensures the agent eventually reaches "ready" or "error" state.

### Half-Built Instance Issue (FIXED)

**Previous Problem**: Initialization failures left the middleware stuck with a half-built instance that was never retried.

**Solution Implemented**:
1. Agent cache is cleared immediately after initialization failure
2. Next request triggers a fresh initialization attempt
3. Retry logic (up to 3 attempts) ensures transient errors are handled
4. Failed agents never remain in cache

### WebSocket Not Advertised

**Problem**: WebSocket is in `supportedTransports` but not in capabilities response

**Solution**: Check that:
1. `enableWebSocket: true` in server config
2. `websocket` endpoint is configured in agent config
3. Both HTTP and WebSocket endpoints are valid URLs

## Files

- **src/a2a-agent-server.ts**: Core A2A agent implementation
- **src/a2a-example.ts**: Example usage
- **tests/a2a-agent-server.test.ts**: Comprehensive test suite
- **package.json**: Dependencies and scripts
- **A2A_AGENT_README.md**: This file

## Dependencies

### Production
- `express` (^4.18.2): Web framework
- `ws` (^8.14.2): WebSocket support

### Development
- `@types/express` (^4.17.20): TypeScript types for Express
- `@types/ws` (^8.5.10): TypeScript types for WebSocket
- `@jest/globals` (^29.7.0): Testing framework
- `supertest` (^6.3.3): API endpoint testing
- `@types/supertest` (^2.0.16): TypeScript types for supertest
- `typescript` (^5.9.3): TypeScript compiler
- `tsx` (^4.20.6): TypeScript execution

## Contributing

When contributing to the A2A agent implementation:

1. Ensure all tests pass: `npm run test:a2a`
2. Build succeeds: `npm run build`
3. Code is properly formatted: `npm run format`
4. No linting errors: `npm run lint`
5. Full verification passes: `npm run verify:all`

## License

MIT

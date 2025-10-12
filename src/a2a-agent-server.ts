import express, { Express, Request, Response, NextFunction } from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

// Agent status types
type AgentStatus = 'initializing' | 'ready' | 'error';

// Agent instance interface
interface AgentInstance {
  id: string;
  status: AgentStatus;
  error?: string;
  capabilities: AgentCapabilities;
  transports: string[];
  lastHealthCheck: Date;
}

// Agent capabilities interface
interface AgentCapabilities {
  name: string;
  version: string;
  description: string;
  supportedTransports: string[];
  endpoints: {
    http?: string;
    websocket?: string;
  };
}

// Agent cache
let agentCache: Map<string, AgentInstance> = new Map();

// A2A Agent class
class A2AAgent {
  private id: string;
  private status: AgentStatus;
  private capabilities: AgentCapabilities;
  private error?: string;
  private maxRetries: number = 3;
  private retryCount: number = 0;

  constructor(id: string, config: Partial<AgentCapabilities>) {
    this.id = id;
    this.status = 'initializing';
    this.capabilities = {
      name: config.name || 'A2A Agent',
      version: config.version || '1.0.0',
      description: config.description || 'Agent-to-Agent Protocol Implementation',
      supportedTransports: config.supportedTransports || ['http'],
      endpoints: config.endpoints || {},
    };
  }

  async initialize(): Promise<void> {
    try {
      this.status = 'initializing';

      // Simulate initialization logic
      await this.performInitialization();

      this.status = 'ready';
      this.error = undefined;
      this.retryCount = 0;
    } catch (error) {
      this.status = 'error';
      this.error = error instanceof Error ? error.message : 'Unknown error';

      // Clear from cache on error
      agentCache.delete(this.id);

      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Initialization failed. Retrying... (${this.retryCount}/${this.maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * this.retryCount));
        return this.initialize();
      }

      throw new Error(
        `Failed to initialize agent after ${this.maxRetries} attempts: ${this.error}`
      );
    }
  }

  private async performInitialization(): Promise<void> {
    // Validate configuration
    if (!this.capabilities.name) {
      throw new Error('Agent name is required');
    }

    // Validate transports
    const validTransports = ['http', 'websocket'];
    for (const transport of this.capabilities.supportedTransports) {
      if (!validTransports.includes(transport)) {
        throw new Error(`Invalid transport: ${transport}`);
      }
    }

    // Ensure endpoints match supported transports
    if (
      this.capabilities.supportedTransports.includes('http') &&
      !this.capabilities.endpoints.http
    ) {
      throw new Error('HTTP transport enabled but no HTTP endpoint configured');
    }

    if (
      this.capabilities.supportedTransports.includes('websocket') &&
      !this.capabilities.endpoints.websocket
    ) {
      // WebSocket is optional, only warn
      console.warn('WebSocket transport enabled but no WebSocket endpoint configured');
      // Remove websocket from supported transports if not configured
      this.capabilities.supportedTransports = this.capabilities.supportedTransports.filter(
        (t) => t !== 'websocket'
      );
    }

    // Additional initialization logic here
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getCapabilities(): AgentCapabilities {
    return this.capabilities;
  }

  getError(): string | undefined {
    return this.error;
  }

  getId(): string {
    return this.id;
  }

  getTransports(): string[] {
    return this.capabilities.supportedTransports;
  }
}

// Express middleware for A2A agent
export function createA2AMiddleware(config: Partial<AgentCapabilities>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentId = (req.headers['x-agent-id'] as string) || 'default';

    try {
      let agent = agentCache.get(agentId);

      if (!agent || agent.status === 'error') {
        // Create new agent instance
        const newAgent = new A2AAgent(agentId, config);

        try {
          await newAgent.initialize();

          // Cache the agent
          agent = {
            id: agentId,
            status: newAgent.getStatus(),
            capabilities: newAgent.getCapabilities(),
            transports: newAgent.getTransports(),
            lastHealthCheck: new Date(),
          };

          agentCache.set(agentId, agent);
        } catch (error) {
          // Ensure agent is cleared from cache on failure
          agentCache.delete(agentId);
          throw error;
        }
      }

      // Attach agent to request
      (req as any).agent = agent;
      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: 'Agent initialization failed',
        message: errorMessage,
        status: 'error',
      });
    }
  };
}

// Health check endpoint
export function healthCheckHandler(req: Request, res: Response) {
  const agentId = (req.headers['x-agent-id'] as string) || 'default';
  const agent = agentCache.get(agentId);

  if (!agent) {
    return res.status(503).json({
      status: 'initializing',
      message: 'Agent not initialized',
    });
  }

  res.json({
    status: agent.status,
    lastHealthCheck: agent.lastHealthCheck,
    error: agent.error,
  });
}

// Status endpoint
export function statusHandler(req: Request, res: Response) {
  const agentId = (req.headers['x-agent-id'] as string) || 'default';
  const agent = agentCache.get(agentId);

  if (!agent) {
    return res.status(503).json({
      status: 'initializing',
      message: 'Agent not initialized',
    });
  }

  res.json({
    id: agent.id,
    status: agent.status,
    lastHealthCheck: agent.lastHealthCheck,
    error: agent.error,
    uptime: Date.now() - agent.lastHealthCheck.getTime(),
  });
}

// Capabilities endpoint
export function capabilitiesHandler(req: Request, res: Response) {
  const agentId = (req.headers['x-agent-id'] as string) || 'default';
  const agent = agentCache.get(agentId);

  if (!agent) {
    return res.status(503).json({
      error: 'Agent not initialized',
    });
  }

  // Only advertise actual transports and endpoints
  const capabilities = {
    ...agent.capabilities,
    supportedTransports: agent.transports,
    endpoints: {
      ...(agent.transports.includes('http') && agent.capabilities.endpoints.http
        ? { http: agent.capabilities.endpoints.http }
        : {}),
      ...(agent.transports.includes('websocket') && agent.capabilities.endpoints.websocket
        ? { websocket: agent.capabilities.endpoints.websocket }
        : {}),
    },
  };

  res.json(capabilities);
}

// Clear agent cache (for testing/admin)
export function clearAgentCache(agentId?: string) {
  if (agentId) {
    agentCache.delete(agentId);
  } else {
    agentCache.clear();
  }
}

// Create A2A server
export function createA2AServer(config: {
  port: number;
  agentConfig: Partial<AgentCapabilities>;
  enableWebSocket?: boolean;
}) {
  const app: Express = express();
  const server = http.createServer(app);

  // Middleware
  app.use(express.json());
  app.use(createA2AMiddleware(config.agentConfig));

  // Health check endpoints
  app.get('/health', healthCheckHandler);
  app.get('/status', statusHandler);
  app.get('/capabilities', capabilitiesHandler);

  // WebSocket support (optional)
  if (config.enableWebSocket) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      console.log('WebSocket connection established');

      ws.on('message', (message) => {
        console.log('Received:', message.toString());
        ws.send(JSON.stringify({ status: 'received', message: message.toString() }));
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }

  // Start server
  server.listen(config.port, () => {
    console.log(`A2A Agent Server running on port ${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`Status: http://localhost:${config.port}/status`);
    console.log(`Capabilities: http://localhost:${config.port}/capabilities`);
    if (config.enableWebSocket) {
      console.log(`WebSocket: ws://localhost:${config.port}`);
    }
  });

  return { app, server };
}

// Export for use in other modules
export { A2AAgent, AgentStatus, AgentInstance, AgentCapabilities, agentCache };

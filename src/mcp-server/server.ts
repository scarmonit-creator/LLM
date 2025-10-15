/**
 * Model Context Protocol (MCP) Server Implementation
 * Exposes LLM framework capabilities as consumable tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HTTPServerTransport } from '@modelcontextprotocol/sdk/server/http.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import tool implementations
import { ClaudeTool } from './tools/claude-tool.js';
import { JulesTool } from './tools/jules-tool.js';
import { OllamaTool } from './tools/ollama-tool.js';
import { RAGTool } from './tools/rag-tool.js';
import { BrowserHistoryTool } from './tools/browser-history-tool.js';
import { KnowledgeGraphTool } from './tools/knowledge-graph-tool.js';
import { AIBridgeTool } from './tools/ai-bridge-tool.js';

// Import middleware
import { SecurityMiddleware } from './middleware/security.js';
import { LoggingMiddleware } from './middleware/logging.js';
import { MonitoringMiddleware } from './middleware/monitoring.js';

// Import authentication
import { AuthenticationManager } from './auth/authentication.js';
import { RateLimiter } from './auth/rate-limiter.js';
import { SessionManager } from './auth/session-manager.js';

class MCPServer {
  private server: Server;
  private tools: Map<string, any>;
  private authManager: AuthenticationManager;
  private rateLimiter: RateLimiter;
  private sessionManager: SessionManager;
  private securityMiddleware: SecurityMiddleware;
  private loggingMiddleware: LoggingMiddleware;
  private monitoringMiddleware: MonitoringMiddleware;
  private isRunning: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'llm-framework-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          logging: {},
          prompts: {},
        },
      }
    );

    // Initialize middleware and authentication
    this.authManager = new AuthenticationManager();
    this.rateLimiter = new RateLimiter();
    this.sessionManager = new SessionManager();
    this.securityMiddleware = new SecurityMiddleware();
    this.loggingMiddleware = new LoggingMiddleware();
    this.monitoringMiddleware = new MonitoringMiddleware();

    // Initialize tools
    this.tools = new Map();
    this.initializeTools();
    this.setupHandlers();

    console.log('🌐 MCP Server initialized with 7 core tools');
  }

  /**
   * Initialize all MCP tools
   */
  private initializeTools() {
    const toolInstances = [
      new ClaudeTool(),
      new JulesTool(),
      new OllamaTool(),
      new RAGTool(),
      new BrowserHistoryTool(),
      new KnowledgeGraphTool(),
      new AIBridgeTool(),
    ];

    for (const tool of toolInstances) {
      this.tools.set(tool.name, tool);
      console.log(`  ✅ Registered tool: ${tool.name}`);
    }
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      const clientId = this.getClientId(request);
      
      // Authentication check
      if (!await this.authManager.validateClient(clientId)) {
        throw new Error('Authentication required');
      }
      
      // Rate limiting check
      if (!await this.rateLimiter.checkLimit(clientId, 'list_tools')) {
        throw new Error('Rate limit exceeded');
      }
      
      // Log request
      this.loggingMiddleware.logRequest(clientId, 'list_tools', request);
      
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const clientId = this.getClientId(request);
      const { name, arguments: args } = request.params;
      
      try {
        // Authentication check
        if (!await this.authManager.validateClient(clientId)) {
          throw new Error('Authentication required');
        }
        
        // Rate limiting check
        if (!await this.rateLimiter.checkLimit(clientId, 'call_tool')) {
          throw new Error('Rate limit exceeded');
        }
        
        // Security validation
        const sanitizedArgs = await this.securityMiddleware.sanitizeInput(args);
        
        // Log request
        this.loggingMiddleware.logRequest(clientId, 'call_tool', { name, args: sanitizedArgs });
        
        // Get tool instance
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Tool '${name}' not found`);
        }
        
        // Execute tool with monitoring
        const startTime = Date.now();
        const result = await tool.execute(sanitizedArgs);
        const executionTime = Date.now() - startTime;
        
        // Monitor performance
        this.monitoringMiddleware.recordExecution(name, executionTime, true);
        
        // Log response
        this.loggingMiddleware.logResponse(clientId, 'call_tool', { name, executionTime, success: true });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const executionTime = Date.now() - Date.now();
        
        // Monitor error
        this.monitoringMiddleware.recordExecution(name, executionTime, false);
        
        // Log error
        this.loggingMiddleware.logError(clientId, 'call_tool', { name, error: error.message });
        
        throw error;
      }
    });
  }

  /**
   * Extract client ID from request
   */
  private getClientId(request: any): string {
    // Extract client ID from request metadata or generate one
    return request.meta?.clientId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start MCP server with transport
   */
  async start(transport: 'stdio' | 'http' = 'stdio', port?: number) {
    if (this.isRunning) {
      console.log('🌐 MCP Server is already running');
      return;
    }

    try {
      let serverTransport;
      
      if (transport === 'stdio') {
        serverTransport = new StdioServerTransport();
        console.log('🌐 Starting MCP Server with stdio transport...');
      } else {
        const httpPort = port || 3000;
        serverTransport = new HTTPServerTransport({ port: httpPort });
        console.log(`🌐 Starting MCP Server with HTTP transport on port ${httpPort}...`);
      }

      await this.server.connect(serverTransport);
      this.isRunning = true;
      
      console.log('✅ MCP Server started successfully!');
      console.log('');
      console.log('🛠️  Available Tools:');
      for (const [name, tool] of this.tools) {
        console.log(`  📋 ${name}: ${tool.description}`);
      }
      console.log('');
      console.log('🔧 Security Features:');
      console.log('  🔐 API Key Authentication');
      console.log('  ⏰ Rate Limiting');
      console.log('  🛡️ Input Sanitization');
      console.log('  📊 Performance Monitoring');
      console.log('  📝 Audit Logging');
      
    } catch (error) {
      console.error('❌ Failed to start MCP Server:', error.message);
      throw error;
    }
  }

  /**
   * Stop MCP server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.server.close();
      this.isRunning = false;
      console.log('🛑 MCP Server stopped');
    } catch (error) {
      console.error('❌ Error stopping MCP Server:', error.message);
      throw error;
    }
  }

  /**
   * Get server status and statistics
   */
  getStatus() {
    return {
      running: this.isRunning,
      toolsCount: this.tools.size,
      tools: Array.from(this.tools.keys()),
      authentication: this.authManager.getStats(),
      rateLimiting: this.rateLimiter.getStats(),
      monitoring: this.monitoringMiddleware.getStats(),
      sessions: this.sessionManager.getStats(),
    };
  }

  /**
   * Health check for MCP server
   */
  async healthCheck() {
    const status = this.getStatus();
    const memUsage = process.memoryUsage();
    
    return {
      status: this.isRunning ? 'healthy' : 'stopped',
      timestamp: new Date().toISOString(),
      server: {
        running: this.isRunning,
        toolsLoaded: this.tools.size,
        expectedTools: 7
      },
      performance: {
        memory: {
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        uptime: process.uptime()
      },
      security: {
        authenticationEnabled: true,
        rateLimitingEnabled: true,
        inputSanitizationEnabled: true
      },
      monitoring: status.monitoring
    };
  }
}

// Export for use in other modules
export { MCPServer };
export default MCPServer;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcpServer = new MCPServer();
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down MCP Server...');
    await mcpServer.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down MCP Server...');
    await mcpServer.stop();
    process.exit(0);
  });
  
  // Start server
  const transport = process.argv[2] === 'http' ? 'http' : 'stdio';
  const port = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  
  mcpServer.start(transport, port).catch((error) => {
    console.error('💥 Failed to start MCP Server:', error.message);
    process.exit(1);
  });
}
// Advanced MCP Server Implementation for LLM Framework Tool Integration
// Comprehensive Model Context Protocol server exposing framework capabilities

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { config } from 'dotenv';

config();

// Tool implementations
import { ClaudeTool } from './tools/claude-tool.js';
import { JulesTool } from './tools/jules-tool.js';
import { OllamaTool } from './tools/ollama-tool.js';
import { RAGTool } from './tools/rag-tool.js';
import { BrowserHistoryTool } from './tools/browser-history-tool.js';
import { KnowledgeGraphTool } from './tools/knowledge-graph-tool.js';
import { AIBridgeTool } from './tools/ai-bridge-tool.js';

interface MCPServerConfig {
  port: number;
  enableHTTP: boolean;
  enableStdio: boolean;
  enableAuth: boolean;
  apiKey?: string;
  rateLimit: {
    windowMs: number;
    max: number;
  };
  tools: {
    [key: string]: boolean;
  };
}

class LLMMCPServer {
  private server: Server;
  private config: MCPServerConfig;
  private tools: Map<string, any>;
  private clients: Set<string>;
  private performance: Map<string, number[]>;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.tools = new Map();
    this.clients = new Set();
    this.performance = new Map();
    this.server = new Server(
      {
        name: 'llm-framework-mcp-server',
        version: '1.0.0',
        description: 'Advanced MCP server exposing LLM framework capabilities as tools',
        author: 'LLM Framework',
        homepage: 'https://github.com/scarmonit-creator/LLM',
        license: 'MIT'
      },
      {
        capabilities: {
          tools: {},
          logging: {},
          prompts: {},
          resources: {}
        }
      }
    );

    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    const toolInstances = {
      claude: new ClaudeTool(),
      jules: new JulesTool(),
      ollama: new OllamaTool(),
      rag: new RAGTool(),
      browserHistory: new BrowserHistoryTool(),
      knowledgeGraph: new KnowledgeGraphTool(),
      aiBridge: new AIBridgeTool()
    };

    // Register enabled tools
    Object.entries(toolInstances).forEach(([name, tool]) => {
      if (this.config.tools[name] !== false) {
        this.tools.set(name, tool);
        console.log(`✅ Tool registered: ${name}`);
      }
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.entries()).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      console.log(`📋 Listed ${tools.length} available tools`);
      return { tools };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const { name, arguments: args } = request.params;
      
      try {
        // Validate tool exists
        if (!this.tools.has(name)) {
          throw new Error(`Tool '${name}' not found`);
        }

        // Authentication check
        if (this.config.enableAuth && !this.validateAuth(request)) {
          throw new Error('Authentication failed');
        }

        // Execute tool
        const tool = this.tools.get(name);
        const result = await tool.execute(args);
        
        // Record performance
        const duration = Date.now() - startTime;
        this.recordPerformance(name, duration);
        
        console.log(`⚡ Tool executed: ${name} (${duration}ms)`);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ],
          isError: false
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Tool error: ${name} (${duration}ms)`, error);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool '${name}': ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private validateAuth(request: any): boolean {
    if (!this.config.apiKey) return true;
    
    const authHeader = request.meta?.authorization;
    return authHeader === `Bearer ${this.config.apiKey}`;
  }

  private recordPerformance(toolName: string, duration: number): void {
    if (!this.performance.has(toolName)) {
      this.performance.set(toolName, []);
    }
    
    const times = this.performance.get(toolName)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  public getPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [toolName, times] of this.performance.entries()) {
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        stats[toolName] = {
          averageMs: Math.round(avg),
          minMs: min,
          maxMs: max,
          totalCalls: times.length
        };
      }
    }
    
    return stats;
  }

  // Start stdio server
  public async startStdio(): Promise<void> {
    if (!this.config.enableStdio) {
      console.log('📝 Stdio transport disabled');
      return;
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🔗 MCP Server connected via stdio');
  }

  // Start HTTP server
  public async startHTTP(): Promise<void> {
    if (!this.config.enableHTTP) {
      console.log('🌐 HTTP transport disabled');
      return;
    }

    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: { error: 'Too many requests' },
      standardHeaders: true,
      legacyHeaders: false
    });
    app.use('/api/', limiter);

    app.use(express.json({ limit: '10mb' }));

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        tools: Array.from(this.tools.keys()),
        clients: this.clients.size,
        performance: this.getPerformanceStats()
      });
    });

    // Performance metrics endpoint
    app.get('/api/metrics', (req, res) => {
      const stats = this.getPerformanceStats();
      const prometheus = this.generatePrometheusMetrics(stats);
      
      res.set('Content-Type', 'text/plain');
      res.send(prometheus);
    });

    app.listen(this.config.port, () => {
      console.log(`🚀 MCP HTTP Server listening on port ${this.config.port}`);
    });
  }

  private generatePrometheusMetrics(stats: Record<string, any>): string {
    let metrics = '# HELP mcp_tool_duration_ms Tool execution duration in milliseconds\n';
    metrics += '# TYPE mcp_tool_duration_ms histogram\n';
    
    for (const [tool, data] of Object.entries(stats)) {
      metrics += `mcp_tool_duration_ms{tool="${tool}",quantile="avg"} ${data.averageMs}\n`;
      metrics += `mcp_tool_duration_ms{tool="${tool}",quantile="min"} ${data.minMs}\n`;
      metrics += `mcp_tool_duration_ms{tool="${tool}",quantile="max"} ${data.maxMs}\n`;
      metrics += `mcp_tool_calls_total{tool="${tool}"} ${data.totalCalls}\n`;
    }
    
    return metrics;
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down MCP Server...');
    await this.server.close();
    console.log('✅ MCP Server shutdown complete');
  }
}

// Configuration from environment
const config: MCPServerConfig = {
  port: parseInt(process.env.MCP_PORT || '3001'),
  enableHTTP: process.env.MCP_ENABLE_HTTP !== 'false',
  enableStdio: process.env.MCP_ENABLE_STDIO !== 'false',
  enableAuth: process.env.MCP_ENABLE_AUTH === 'true',
  apiKey: process.env.MCP_API_KEY,
  rateLimit: {
    windowMs: parseInt(process.env.MCP_RATE_WINDOW_MS || '60000'),
    max: parseInt(process.env.MCP_RATE_MAX || '100')
  },
  tools: {
    claude: process.env.MCP_TOOL_CLAUDE !== 'false',
    jules: process.env.MCP_TOOL_JULES !== 'false',
    ollama: process.env.MCP_TOOL_OLLAMA !== 'false',
    rag: process.env.MCP_TOOL_RAG !== 'false',
    browserHistory: process.env.MCP_TOOL_BROWSER_HISTORY !== 'false',
    knowledgeGraph: process.env.MCP_TOOL_KNOWLEDGE_GRAPH !== 'false',
    aiBridge: process.env.MCP_TOOL_AI_BRIDGE !== 'false'
  }
};

// Start server
async function main() {
  const mcpServer = new LLMMCPServer(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await mcpServer.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await mcpServer.shutdown();
    process.exit(0);
  });
  
  // Start transports
  await Promise.all([
    mcpServer.startStdio(),
    mcpServer.startHTTP()
  ]);
  
  console.log('🎯 MCP Server fully operational');
  console.log(`📊 Tools available: ${Object.keys(config.tools).filter(k => config.tools[k]).join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { LLMMCPServer, type MCPServerConfig };
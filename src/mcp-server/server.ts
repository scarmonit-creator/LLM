import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ClaudeTool } from './tools/claude-tool.js';
import { JulesTool } from './tools/jules-tool.js';
import { OllamaTool } from './tools/ollama-tool.js';
import { RAGTool } from './tools/rag-tool.js';
import { BrowserHistoryTool } from './tools/browser-history-tool.js';
import { KnowledgeGraphTool } from './tools/knowledge-graph-tool.js';
import { AIBridgeTool } from './tools/ai-bridge-tool.js';
import { MCPConfig, ToolDefinition } from './types.js';

/**
 * MCP Server Implementation for LLM Framework
 * Exposes 7 core tools as MCP-compliant services
 */
export class MCPServer {
  private server: Server;
  private tools: Map<string, any> = new Map();
  private config: MCPConfig;
  private requestCounts: Map<string, number> = new Map();

  constructor(config: MCPConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'llm-framework-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    // Initialize all 7 core tools
    this.tools.set('claude_chat', new ClaudeTool(this.config.claude));
    this.tools.set('jules_analyze_repo', new JulesTool(this.config.jules));
    this.tools.set('ollama_query', new OllamaTool(this.config.ollama));
    this.tools.set('rag_query', new RAGTool(this.config.rag));
    this.tools.set('get_browser_history', new BrowserHistoryTool(this.config.browserHistory));
    this.tools.set('knowledge_graph_query', new KnowledgeGraphTool(this.config.knowledgeGraph));
    this.tools.set('ai_bridge_coordinate', new AIBridgeTool(this.config.aiBridge));

    console.log(`✅ MCP Server initialized with ${this.tools.size} tools`);
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolDefinitions: ToolDefinition[] = [
        {
          name: 'claude_chat',
          description: 'Direct access to Claude AI conversations with context management',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to send to Claude' },
              conversation_id: { type: 'string', description: 'Optional conversation context ID' }
            },
            required: ['message']
          }
        },
        {
          name: 'jules_analyze_repo',
          description: 'Repository analysis and code generation with Jules AI',
          inputSchema: {
            type: 'object',
            properties: {
              repo_url: { type: 'string', description: 'GitHub repository URL to analyze' },
              analysis_type: { type: 'string', enum: ['structure', 'quality', 'security', 'performance'] }
            },
            required: ['repo_url', 'analysis_type']
          }
        },
        {
          name: 'rag_query',
          description: 'ChromaDB vector search and document retrieval',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query for vector similarity' },
              collection: { type: 'string', description: 'ChromaDB collection name' },
              limit: { type: 'number', description: 'Maximum results to return', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'get_browser_history',
          description: 'Access and analyze browser history data',
          inputSchema: {
            type: 'object',
            properties: {
              browser: { type: 'string', enum: ['chrome', 'firefox', 'safari', 'edge'] },
              days: { type: 'number', description: 'Number of days to look back', default: 7 },
              pattern: { type: 'string', description: 'URL or title pattern to match' }
            }
          }
        }
      ];

      return { tools: toolDefinitions };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.tools.has(name)) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Rate limiting
      this.requestCounts.set(name, (this.requestCounts.get(name) || 0) + 1);

      const tool = this.tools.get(name)!;
      
      try {
        const sanitizedArgs = this.sanitizeInputs(args);
        const result = await this.executeWithRateLimit(tool, name, sanitizedArgs);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        console.error(`❌ Tool execution error for ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2),
          }],
          isError: true,
        };
      }
    });
  }

  private sanitizeInputs(inputs: any): any {
    if (typeof inputs === 'string') {
      return inputs.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
    }
    if (Array.isArray(inputs)) {
      return inputs.map(item => this.sanitizeInputs(item));
    }
    if (typeof inputs === 'object' && inputs !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(inputs)) {
        sanitized[key] = this.sanitizeInputs(value);
      }
      return sanitized;
    }
    return inputs;
  }

  private async executeWithRateLimit(tool: any, toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'claude_chat':
        return await tool.chat(args.message, args.conversation_id);
      case 'jules_analyze_repo':
        return await tool.analyzeRepository(args.repo_url, args.analysis_type);
      case 'rag_query':
        return await tool.search(args.query, args.collection, args.limit);
      case 'get_browser_history':
        return await tool.getHistory(args.browser, args.days, args.pattern);
      default:
        throw new Error(`Unknown tool method: ${toolName}`);
    }
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🚀 MCP Server started and ready to handle requests');
  }

  public async stop(): Promise<void> {
    await this.server.close();
    console.log('⏹️  MCP Server stopped');
  }

  public getStats() {
    return {
      toolsAvailable: this.tools.size,
      requestCounts: Object.fromEntries(this.requestCounts),
      uptime: process.uptime()
    };
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: MCPConfig = {
    claude: { apiKey: process.env.CLAUDE_API_KEY },
    jules: { endpoint: process.env.JULES_ENDPOINT },
    ollama: { endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434' },
    rag: { chromaEndpoint: process.env.CHROMA_ENDPOINT },
    browserHistory: { enabled: true },
    knowledgeGraph: { endpoint: process.env.KG_ENDPOINT },
    aiBridge: { enabled: true }
  };

  const mcpServer = new MCPServer(config);
  
  process.on('SIGINT', async () => {
    await mcpServer.stop();
    process.exit(0);
  });

  mcpServer.start().catch(console.error);
}

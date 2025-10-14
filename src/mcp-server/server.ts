#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { claudeTool } from './tools/claude-tool.js';
import { julesTool } from './tools/jules-tool.js';
import { ollamaTool } from './tools/ollama-tool.js';
import { ragTool } from './tools/rag-tool.js';
import { browserHistoryTool } from './tools/browser-history-tool.js';
import { knowledgeGraphTool } from './tools/knowledge-graph-tool.js';
import { aiBridgeTool } from './tools/ai-bridge-tool.js';
import { getConfig } from './config.js';
import type { MCPTool, ServerConfig } from './types.js';

/**
 * LLM Framework MCP Server
 * 
 * Exposes the LLM framework's capabilities as MCP tools that can be consumed
 * by other agents and systems via the Model Context Protocol.
 */
class LLMMCPServer {
  private server: Server;
  private config: ServerConfig;
  private tools: Map<string, MCPTool>;

  constructor(config: ServerConfig) {
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
      },
    );
    this.tools = new Map();
    this.setupTools();
    this.setupHandlers();
  }

  private setupTools(): void {
    const availableTools = [
      claudeTool,
      julesTool,
      ollamaTool,
      ragTool,
      browserHistoryTool,
      knowledgeGraphTool,
      aiBridgeTool,
    ];

    // Register enabled tools
    for (const tool of availableTools) {
      if (this.config.enabledTools.includes(tool.name)) {
        this.tools.set(tool.name, tool);
        console.log(`Registered tool: ${tool.name}`);
      }
    }
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        console.log(`Executing tool: ${name} with args:`, args);
        const result = await tool.execute(args);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Tool execution error for ${name}:`, errorMessage);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    console.log('Starting LLM Framework MCP Server...');
    console.log(`Enabled tools: ${Array.from(this.tools.keys()).join(', ')}`);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('MCP Server started successfully');
    console.log('Waiting for client connections...');
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  const server = new LLMMCPServer(config);
  
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down MCP server...');
    process.exit(0);
  });
}

export { LLMMCPServer };
export default LLMMCPServer;

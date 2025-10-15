/**
 * MCP Server Implementation
 * 
 * Implements Model Context Protocol server with 7 core tools:
 * - Claude Chat Tool (AI conversations)
 * - Jules Repository Analysis Tool
 * - Ollama Local LLM Tool
 * - RAG Query Tool (ChromaDB)
 * - Browser History Tool
 * - Knowledge Graph Tool
 * - AI Bridge Coordination Tool
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent,
  ImageContent
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { getSecurityManager } from '../../extensions/security/security-manager.js';
import { getCache } from '../performance/multi-tier-cache.js';

interface MCPServerConfig {
  name: string;
  version: string;
  enableSecurity: boolean;
  enableCaching: boolean;
  enableRateLimiting: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
}

class ClaudeTool {
  async execute(args: { message: string; conversation_id?: string }): Promise<CallToolResult> {
    try {
      // Validate inputs
      const securityManager = getSecurityManager();
      const validation = securityManager.validateInput(args.message, {
        required: true,
        type: 'string',
        maxLength: 10000,
        pattern: 'text'
      });
      
      if (!validation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Input validation failed: ${validation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      // Check cache first
      const cache = getCache();
      const cacheKey = `claude:${crypto.createHash('sha256').update(args.message + (args.conversation_id || '')).digest('hex')}`;
      const cached = await cache.get<string>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: cached
          }]
        };
      }
      
      // Simulate Claude API call (replace with actual implementation)
      const response = await this.callClaudeAPI(validation.sanitized, args.conversation_id);
      
      // Cache the response
      await cache.set(cacheKey, response, 300000); // 5 minutes
      
      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Claude tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async callClaudeAPI(message: string, conversationId?: string): Promise<string> {
    // Mock implementation - replace with actual Claude API integration
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
    
    return `Claude response to: "${message.substring(0, 50)}..."`;
  }
}

class JulesTool {
  async execute(args: { repo_url: string; analysis_type: string }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate repository URL
      const urlValidation = securityManager.validateInput(args.repo_url, {
        required: true,
        type: 'string',
        pattern: 'url'
      });
      
      if (!urlValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Invalid repository URL: ${urlValidation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      // Validate analysis type
      const typeValidation = securityManager.validateInput(args.analysis_type, {
        required: true,
        type: 'string',
        allowedValues: ['structure', 'quality', 'security', 'performance']
      });
      
      if (!typeValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Invalid analysis type: ${typeValidation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      // Check cache
      const cache = getCache();
      const cacheKey = `jules:${crypto.createHash('sha256').update(args.repo_url + args.analysis_type).digest('hex')}`;
      const cached = await cache.get<any>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }]
        };
      }
      
      // Simulate Jules analysis
      const analysis = await this.analyzeRepository(urlValidation.sanitized, typeValidation.sanitized);
      
      // Cache result
      await cache.set(cacheKey, analysis, 1800000); // 30 minutes
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Jules tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async analyzeRepository(repoUrl: string, analysisType: string): Promise<any> {
    // Mock implementation - replace with actual Jules integration
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      repository: repoUrl,
      analysis_type: analysisType,
      results: {
        score: 85,
        findings: [
          `Repository ${analysisType} analysis completed`,
          'No critical issues found',
          '3 optimization opportunities identified'
        ],
        recommendations: [
          'Consider implementing additional test coverage',
          'Update dependencies to latest versions',
          'Add performance monitoring'
        ]
      },
      timestamp: new Date().toISOString()
    };
  }
}

class OllamaTool {
  async execute(args: { model: string; prompt: string; options?: any }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate inputs
      const modelValidation = securityManager.validateInput(args.model, {
        required: true,
        type: 'string',
        pattern: 'alphanumeric',
        maxLength: 100
      });
      
      const promptValidation = securityManager.validateInput(args.prompt, {
        required: true,
        type: 'string',
        maxLength: 50000
      });
      
      if (!modelValidation.isValid || !promptValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Validation failed: ${[...modelValidation.errors, ...promptValidation.errors].join(', ')}`
          }],
          isError: true
        };
      }
      
      // Check cache
      const cache = getCache();
      const cacheKey = `ollama:${crypto.createHash('sha256')
        .update(args.model + args.prompt + JSON.stringify(args.options || {}))
        .digest('hex')}`;
      const cached = await cache.get<string>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: cached
          }]
        };
      }
      
      // Simulate Ollama API call
      const response = await this.callOllama(
        modelValidation.sanitized,
        promptValidation.sanitized,
        args.options
      );
      
      // Cache response
      await cache.set(cacheKey, response, 600000); // 10 minutes
      
      return {
        content: [{
          type: 'text',
          text: response
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Ollama tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async callOllama(model: string, prompt: string, options?: any): Promise<string> {
    // Mock implementation - replace with actual Ollama integration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return `Ollama ${model} response to: "${prompt.substring(0, 50)}..."`;
  }
}

class RAGTool {
  async execute(args: { query: string; collection?: string; limit?: number }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate query
      const queryValidation = securityManager.validateInput(args.query, {
        required: true,
        type: 'string',
        maxLength: 5000
      });
      
      if (!queryValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Query validation failed: ${queryValidation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      const limit = Math.min(args.limit || 10, 100); // Cap at 100 results
      
      // Check cache
      const cache = getCache();
      const cacheKey = `rag:${crypto.createHash('sha256')
        .update(args.query + (args.collection || 'default') + limit)
        .digest('hex')}`;
      const cached = await cache.get<any[]>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }]
        };
      }
      
      // Simulate ChromaDB query
      const results = await this.queryChromaDB(queryValidation.sanitized, args.collection, limit);
      
      // Cache results
      await cache.set(cacheKey, results, 900000); // 15 minutes
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `RAG tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async queryChromaDB(query: string, collection?: string, limit: number = 10): Promise<any[]> {
    // Mock implementation - replace with actual ChromaDB integration
    await new Promise(resolve => setTimeout(resolve, 80));
    
    return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `doc_${i + 1}`,
      content: `Document ${i + 1} related to: "${query.substring(0, 30)}..."`,
      similarity: 0.9 - (i * 0.1),
      metadata: {
        collection: collection || 'default',
        indexed: new Date().toISOString()
      }
    }));
  }
}

class BrowserHistoryTool {
  async execute(args: { browser?: string; days?: number; pattern?: string }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate inputs
      const daysValidation = securityManager.validateInput(args.days || 7, {
        type: 'number',
        customValidator: (v: number) => v > 0 && v <= 365
      });
      
      if (!daysValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Invalid days parameter: ${daysValidation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      const days = Math.min(args.days || 7, 30); // Limit to 30 days for privacy
      
      // Check cache
      const cache = getCache();
      const cacheKey = `history:${crypto.createHash('sha256')
        .update((args.browser || 'all') + days + (args.pattern || ''))
        .digest('hex')}`;
      const cached = await cache.get<any[]>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }]
        };
      }
      
      // Get browser history (mock implementation)
      const history = await this.getBrowserHistory(args.browser, days, args.pattern);
      
      // Cache with short TTL for privacy
      await cache.set(cacheKey, history, 300000); // 5 minutes only
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(history, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Browser history tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async getBrowserHistory(browser?: string, days: number = 7, pattern?: string): Promise<any[]> {
    // Mock implementation - replace with actual browser history access
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const mockHistory = [
      { url: 'https://github.com/scarmonit-creator/LLM', title: 'LLM Repository', visitTime: Date.now() - 3600000, visitCount: 15 },
      { url: 'https://console.cloud.google.com', title: 'Google Cloud Console', visitTime: Date.now() - 7200000, visitCount: 8 },
      { url: 'https://docs.anthropic.com', title: 'Anthropic Documentation', visitTime: Date.now() - 10800000, visitCount: 3 },
      { url: 'https://railway.com', title: 'Railway Platform', visitTime: Date.now() - 14400000, visitCount: 5 },
      { url: 'https://fly.io/docs', title: 'Fly.io Documentation', visitTime: Date.now() - 18000000, visitCount: 2 }
    ];
    
    let filtered = mockHistory.filter(item => {
      const itemAge = (Date.now() - item.visitTime) / (1000 * 60 * 60 * 24);
      return itemAge <= days;
    });
    
    if (pattern) {
      const regex = new RegExp(pattern, 'i');
      filtered = filtered.filter(item => 
        regex.test(item.url) || regex.test(item.title)
      );
    }
    
    if (browser && browser !== 'all') {
      // In real implementation, filter by specific browser
      filtered = filtered.map(item => ({ ...item, browser }));
    }
    
    return filtered.slice(0, 50); // Limit results
  }
}

class KnowledgeGraphTool {
  async execute(args: { query: string; depth?: number; relationships?: string[] }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate inputs
      const queryValidation = securityManager.validateInput(args.query, {
        required: true,
        type: 'string',
        maxLength: 1000
      });
      
      if (!queryValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Query validation failed: ${queryValidation.errors.join(', ')}`
          }],
          isError: true
        };
      }
      
      const depth = Math.min(args.depth || 3, 5); // Limit depth
      const relationships = args.relationships || ['related_to', 'contains', 'uses'];
      
      // Check cache
      const cache = getCache();
      const cacheKey = `kg:${crypto.createHash('sha256')
        .update(args.query + depth + relationships.join(','))
        .digest('hex')}`;
      const cached = await cache.get<any>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }]
        };
      }
      
      // Query knowledge graph
      const graphResults = await this.queryKnowledgeGraph(queryValidation.sanitized, depth, relationships);
      
      // Cache results
      await cache.set(cacheKey, graphResults, 1800000); // 30 minutes
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(graphResults, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Knowledge graph tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async queryKnowledgeGraph(query: string, depth: number, relationships: string[]): Promise<any> {
    // Mock implementation - replace with actual knowledge graph
    await new Promise(resolve => setTimeout(resolve, 120));
    
    return {
      query,
      depth,
      relationships,
      nodes: [
        { id: 'node1', type: 'concept', label: 'AI Framework', properties: { category: 'software' } },
        { id: 'node2', type: 'concept', label: 'Performance Optimization', properties: { category: 'technique' } },
        { id: 'node3', type: 'concept', label: 'Memory Management', properties: { category: 'system' } }
      ],
      edges: [
        { from: 'node1', to: 'node2', relationship: 'uses', weight: 0.9 },
        { from: 'node2', to: 'node3', relationship: 'contains', weight: 0.8 }
      ],
      metadata: {
        query_time: Date.now(),
        result_count: 3,
        confidence: 0.85
      }
    };
  }
}

class AIBridgeTool {
  async execute(args: { providers: string[]; message: string; strategy?: string }): Promise<CallToolResult> {
    try {
      const securityManager = getSecurityManager();
      
      // Validate inputs
      const messageValidation = securityManager.validateInput(args.message, {
        required: true,
        type: 'string',
        maxLength: 10000
      });
      
      const providersValidation = securityManager.validateInput(args.providers, {
        required: true,
        type: 'array',
        customValidator: (arr: string[]) => arr.length > 0 && arr.length <= 5
      });
      
      if (!messageValidation.isValid || !providersValidation.isValid) {
        return {
          content: [{
            type: 'text',
            text: `Validation failed: ${[...messageValidation.errors, ...providersValidation.errors].join(', ')}`
          }],
          isError: true
        };
      }
      
      const strategy = args.strategy || 'best_response';
      const allowedStrategies = ['consensus', 'best_response', 'aggregate'];
      
      if (!allowedStrategies.includes(strategy)) {
        return {
          content: [{
            type: 'text',
            text: `Invalid strategy: ${strategy}. Allowed: ${allowedStrategies.join(', ')}`
          }],
          isError: true
        };
      }
      
      // Check cache
      const cache = getCache();
      const cacheKey = `bridge:${crypto.createHash('sha256')
        .update(args.providers.join(',') + args.message + strategy)
        .digest('hex')}`;
      const cached = await cache.get<any>(cacheKey);
      
      if (cached) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }]
        };
      }
      
      // Coordinate multiple AI providers
      const results = await this.coordinateProviders(
        providersValidation.sanitized,
        messageValidation.sanitized,
        strategy
      );
      
      // Cache results
      await cache.set(cacheKey, results, 600000); // 10 minutes
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `AI Bridge tool error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async coordinateProviders(providers: string[], message: string, strategy: string): Promise<any> {
    // Mock implementation - replace with actual AI bridge coordination
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const responses = providers.map((provider, i) => ({
      provider,
      response: `${provider} response to: "${message.substring(0, 30)}..."`,
      confidence: 0.9 - (i * 0.1),
      latency: 100 + (i * 50)
    }));
    
    let finalResponse;
    switch (strategy) {
      case 'best_response':
        finalResponse = responses.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        break;
      case 'consensus':
        finalResponse = {
          provider: 'consensus',
          response: responses.map(r => r.response).join('\n\n---\n\n'),
          confidence: responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length
        };
        break;
      case 'aggregate':
        finalResponse = {
          provider: 'aggregate',
          responses,
          summary: 'Multiple provider responses aggregated'
        };
        break;
      default:
        finalResponse = responses[0];
    }
    
    return {
      strategy,
      providers,
      result: finalResponse,
      metadata: {
        total_providers: providers.length,
        execution_time: Date.now(),
        strategy_used: strategy
      }
    };
  }
}

export class MCPServer extends EventEmitter {
  private server: Server;
  private config: MCPServerConfig;
  private tools: Map<string, any>;
  private activeRequests: Map<string, { startTime: number; tool: string }> = new Map();
  private requestCounter = 0;
  private rateLimiter: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(config: Partial<MCPServerConfig> = {}) {
    super();
    
    this.config = {
      name: 'LLM Framework MCP Server',
      version: '1.0.0',
      enableSecurity: true,
      enableCaching: true,
      enableRateLimiting: true,
      maxConcurrentRequests: 100,
      requestTimeout: 30000,
      ...config
    };
    
    this.server = new Server({
      name: this.config.name,
      version: this.config.version
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.tools = new Map([
      ['claude_chat', new ClaudeTool()],
      ['jules_analyze_repo', new JulesTool()],
      ['ollama_query', new OllamaTool()],
      ['rag_query', new RAGTool()],
      ['get_browser_history', new BrowserHistoryTool()],
      ['knowledge_graph_query', new KnowledgeGraphTool()],
      ['ai_bridge_coordinate', new AIBridgeTool()]
    ]);
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
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
              analysis_type: { 
                type: 'string', 
                enum: ['structure', 'quality', 'security', 'performance'],
                description: 'Type of analysis to perform'
              }
            },
            required: ['repo_url', 'analysis_type']
          }
        },
        {
          name: 'ollama_query',
          description: 'Local LLM interactions via Ollama with model selection',
          inputSchema: {
            type: 'object',
            properties: {
              model: { type: 'string', description: 'Ollama model name to use' },
              prompt: { type: 'string', description: 'Prompt to send to the model' },
              options: { type: 'object', description: 'Model-specific options' }
            },
            required: ['model', 'prompt']
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
              browser: { 
                type: 'string', 
                enum: ['chrome', 'firefox', 'safari', 'edge', 'all'],
                description: 'Specific browser to query'
              },
              days: { type: 'number', description: 'Number of days to look back', default: 7 },
              pattern: { type: 'string', description: 'URL or title pattern to match' }
            }
          }
        },
        {
          name: 'knowledge_graph_query',
          description: 'Graph-based knowledge queries and relationship analysis',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Knowledge graph query' },
              depth: { type: 'number', description: 'Maximum relationship depth', default: 3 },
              relationships: {
                type: 'array',
                items: { type: 'string' },
                description: 'Relationship types to include'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'ai_bridge_coordinate',
          description: 'Multi-provider LLM coordination and response aggregation',
          inputSchema: {
            type: 'object',
            properties: {
              providers: {
                type: 'array',
                items: { type: 'string' },
                description: 'LLM providers to coordinate'
              },
              message: { type: 'string', description: 'Message to send to all providers' },
              strategy: {
                type: 'string',
                enum: ['consensus', 'best_response', 'aggregate'],
                default: 'best_response',
                description: 'Coordination strategy'
              }
            },
            required: ['providers', 'message']
          }
        }
      ];
      
      return { tools };
    });
    
    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestId = `req_${++this.requestCounter}_${Date.now()}`;
      const startTime = performance.now();
      
      try {
        // Rate limiting
        if (this.config.enableRateLimiting) {
          const clientId = 'default'; // In real implementation, extract from request
          if (!this.checkRateLimit(clientId)) {
            return {
              content: [{
                type: 'text',
                text: 'Rate limit exceeded. Please try again later.'
              }],
              isError: true
            };
          }
        }
        
        // Check concurrent request limit
        if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
          return {
            content: [{
              type: 'text',
              text: 'Server busy. Maximum concurrent requests exceeded.'
            }],
            isError: true
          };
        }
        
        // Track active request
        this.activeRequests.set(requestId, {
          startTime: Date.now(),
          tool: request.params.name
        });
        
        // Get tool implementation
        const tool = this.tools.get(request.params.name);
        if (!tool) {
          return {
            content: [{
              type: 'text',
              text: `Unknown tool: ${request.params.name}`
            }],
            isError: true
          };
        }
        
        // Execute tool with timeout
        const timeoutPromise = new Promise<CallToolResult>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Tool execution timeout'));
          }, this.config.requestTimeout);
        });
        
        const executionPromise = tool.execute(request.params.arguments || {});
        
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        const duration = performance.now() - startTime;
        
        // Log successful execution
        if (this.config.enableSecurity) {
          const securityManager = getSecurityManager();
          securityManager.logSecurityEvent('access', 'low', 'MCPServer', {
            tool: request.params.name,
            duration,
            success: !result.isError
          });
        }
        
        this.emit('toolExecuted', {
          requestId,
          tool: request.params.name,
          duration,
          success: !result.isError
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        if (this.config.enableSecurity) {
          const securityManager = getSecurityManager();
          securityManager.logSecurityEvent('suspicious', 'medium', 'MCPServer', {
            tool: request.params.name,
            error: error.message,
            duration
          });
        }
        
        return {
          content: [{
            type: 'text',
            text: `Tool execution failed: ${error.message}`
          }],
          isError: true
        };
      } finally {
        this.activeRequests.delete(requestId);
      }
    });
  }
  
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(clientId);
    
    if (!limit || now > limit.resetTime) {
      // Reset rate limit window (1 minute)
      this.rateLimiter.set(clientId, {
        count: 1,
        resetTime: now + 60000
      });
      return true;
    }
    
    if (limit.count >= 100) { // 100 requests per minute
      return false;
    }
    
    limit.count++;
    return true;
  }
  
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('MCP Server started successfully');
    console.log(`Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    
    this.emit('started');
  }
  
  getMetrics(): {
    activeRequests: number;
    totalRequests: number;
    averageResponseTime: number;
    toolUsage: Record<string, number>;
    errorRate: number;
  } {
    // This would calculate actual metrics in a real implementation
    return {
      activeRequests: this.activeRequests.size,
      totalRequests: this.requestCounter,
      averageResponseTime: 150, // ms
      toolUsage: Object.fromEntries(Array.from(this.tools.keys()).map(tool => [tool, Math.floor(Math.random() * 100)])),
      errorRate: 0.05 // 5%
    };
  }
  
  async stop(): Promise<void> {
    await this.server.close();
    this.removeAllListeners();
    console.log('MCP Server stopped');
  }
}

// Export factory function
export function createMCPServer(config?: Partial<MCPServerConfig>): MCPServer {
  return new MCPServer(config);
}

// CLI runner
if (require.main === module) {
  const server = createMCPServer();
  
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down MCP server...');
    await server.stop();
    process.exit(0);
  });
}
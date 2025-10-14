/**
 * Type definitions for the LLM Framework MCP Server
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>) => Promise<any>;
}

export interface ServerConfig {
  enabledTools: string[];
  anthropicApiKey?: string;
  julesApiKey?: string;
  julesBaseUrl?: string;
  ollamaBaseUrl?: string;
  chromaHost?: string;
  chromaPort?: number;
  bridgePort?: number;
  bridgeWsPort?: number;
  maxConcurrentConnections?: number;
  rateLimitPerMinute?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface ClaudeToolArgs {
  message: string;
  conversation_id?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface JulesToolArgs {
  action: 'analyze_repo' | 'generate_code' | 'review_code';
  repo_url?: string;
  code?: string;
  prompt?: string;
  language?: string;
}

export interface OllamaToolArgs {
  model: string;
  prompt: string;
  temperature?: number;
  top_k?: number;
  top_p?: number;
}

export interface RAGToolArgs {
  query: string;
  collection?: string;
  limit?: number;
  include_metadata?: boolean;
  similarity_threshold?: number;
}

export interface BrowserHistoryToolArgs {
  browser?: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'brave' | 'all';
  days?: number;
  pattern?: string;
  limit?: number;
  include_visits?: boolean;
}

export interface KnowledgeGraphToolArgs {
  action: 'query' | 'add_entity' | 'add_relationship' | 'get_neighbors';
  query?: string;
  entity_id?: string;
  entity_type?: string;
  relationship_type?: string;
  target_entity_id?: string;
  properties?: Record<string, any>;
}

export interface AIBridgeToolArgs {
  action: 'send_message' | 'get_status' | 'list_connections';
  provider?: 'claude' | 'codex' | 'gemini' | 'perplexity' | 'ollama';
  message?: string;
  session_id?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  created_at: Date;
  updated_at: Date;
}

export interface BrowserHistoryEntry {
  url: string;
  title: string;
  visit_count: number;
  last_visit_time: Date;
  browser: string;
}

export interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, any>;
  similarity_score?: number;
}

export interface KnowledgeGraphEntity {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships?: KnowledgeGraphRelationship[];
}

export interface KnowledgeGraphRelationship {
  id: string;
  type: string;
  source_id: string;
  target_id: string;
  properties?: Record<string, any>;
}

export interface AIBridgeConnection {
  id: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error';
  last_activity: Date;
  message_count: number;
}

import { config } from 'dotenv';
import type { ServerConfig } from './types.js';

// Load environment variables
config();

/**
 * Get MCP server configuration from environment variables
 */
export function getConfig(): ServerConfig {
  const enabledToolsEnv = process.env.MCP_ENABLED_TOOLS;
  const defaultTools = [
    'claude_chat',
    'jules_analyze_repo',
    'ollama_chat',
    'rag_query',
    'get_browser_history',
    'knowledge_graph_query',
    'ai_bridge_message'
  ];

  return {
    enabledTools: enabledToolsEnv
      ? enabledToolsEnv.split(',')
      : defaultTools,
    
    // LLM Provider Configurations
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    julesApiKey: process.env.JULES_API_KEY,
    julesBaseUrl: process.env.JULES_BASE_URL || 'https://api.jules.ai',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    
    // ChromaDB Configuration
    chromaHost: process.env.CHROMA_HOST || 'localhost',
    chromaPort: parseInt(process.env.CHROMA_PORT || '8000', 10),
    
    // AI Bridge Configuration
    bridgePort: parseInt(process.env.BRIDGE_PORT || '3000', 10),
    bridgeWsPort: parseInt(process.env.BRIDGE_WS_PORT || '8080', 10),
    
    // Server Configuration
    maxConcurrentConnections: parseInt(
      process.env.MCP_MAX_CONNECTIONS || '10',
      10
    ),
    rateLimitPerMinute: parseInt(
      process.env.MCP_RATE_LIMIT || '60',
      10
    ),
    logLevel: (process.env.MCP_LOG_LEVEL as any) || 'info',
  };
}

/**
 * Validate required configuration
 */
export function validateConfig(config: ServerConfig): void {
  const errors: string[] = [];

  // Check if any tools are enabled
  if (!config.enabledTools || config.enabledTools.length === 0) {
    errors.push('At least one tool must be enabled');
  }

  // Validate Claude configuration if Claude tool is enabled
  if (config.enabledTools.includes('claude_chat')) {
    if (!config.anthropicApiKey) {
      errors.push('ANTHROPIC_API_KEY is required when Claude tool is enabled');
    }
  }

  // Validate Jules configuration if Jules tool is enabled
  if (config.enabledTools.includes('jules_analyze_repo')) {
    if (!config.julesApiKey) {
      errors.push('JULES_API_KEY is required when Jules tool is enabled');
    }
  }

  // Validate numeric configurations
  if (config.chromaPort && (config.chromaPort < 1 || config.chromaPort > 65535)) {
    errors.push('CHROMA_PORT must be between 1 and 65535');
  }

  if (config.bridgePort && (config.bridgePort < 1 || config.bridgePort > 65535)) {
    errors.push('BRIDGE_PORT must be between 1 and 65535');
  }

  if (config.bridgeWsPort && (config.bridgeWsPort < 1 || config.bridgeWsPort > 65535)) {
    errors.push('BRIDGE_WS_PORT must be between 1 and 65535');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration with validation
 */
export function getValidatedConfig(): ServerConfig {
  const config = getConfig();
  validateConfig(config);
  return config;
}

/**
 * Print configuration summary (without sensitive data)
 */
export function printConfigSummary(config: ServerConfig): void {
  console.log('MCP Server Configuration:');
  console.log(`  Enabled Tools: ${config.enabledTools.join(', ')}`);
  console.log(`  Log Level: ${config.logLevel}`);
  console.log(`  Max Connections: ${config.maxConcurrentConnections}`);
  console.log(`  Rate Limit: ${config.rateLimitPerMinute}/min`);
  
  if (config.enabledTools.includes('claude_chat')) {
    console.log(`  Claude API: ${config.anthropicApiKey ? '✓ Configured' : '✗ Missing'}`);
  }
  
  if (config.enabledTools.includes('jules_analyze_repo')) {
    console.log(`  Jules API: ${config.julesApiKey ? '✓ Configured' : '✗ Missing'}`);
    console.log(`  Jules URL: ${config.julesBaseUrl}`);
  }
  
  if (config.enabledTools.includes('ollama_chat')) {
    console.log(`  Ollama URL: ${config.ollamaBaseUrl}`);
  }
  
  if (config.enabledTools.includes('rag_query')) {
    console.log(`  ChromaDB: ${config.chromaHost}:${config.chromaPort}`);
  }
  
  if (config.enabledTools.includes('ai_bridge_message')) {
    console.log(`  AI Bridge: ${config.bridgePort} (WS: ${config.bridgeWsPort})`);
  }
}

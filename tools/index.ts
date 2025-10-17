/**
 * Tools Orchestration - Optimized Version
 * A collection of reusable tools for LLM agent workflows with:
 * - Lazy loading for better performance
 * - Proper TypeScript types
 * - Dynamic tool discovery
 * - Error boundaries and caching
 * - Comprehensive tool registry
 */

import { Tool } from './types.js';

// Core tool type definitions
export interface ToolDefinition extends Tool {
  name: string;
  description: string;
  version?: string;
  category?: 'analysis' | 'testing' | 'integration' | 'optimization' | 'utility';
  dependencies?: string[];
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<any> | any;
}

export interface ToolRegistry {
  [key: string]: () => Promise<Tool | ToolDefinition>;
}

export interface ToolCache {
  [key: string]: Tool | ToolDefinition;
}

// Tool registry with lazy loading
const toolRegistry: ToolRegistry = {
  // Browser and history tools
  browserHistory: () => import('./browser-history.js').then(m => new m.default()),
  
  // Git and version control
  gitOperations: () => import('./git-operations.js').then(m => m.default),
  
  // Email and communication
  emailIntegration: () => import('./email-integration.js').then(m => m.default),
  
  // API and orchestration
  apiOrchestration: () => import('./api-orchestration.js').then(m => m.default),
  
  // Code analysis and testing
  codeAnalysis: () => import('./code-analysis.js').then(m => m.codeAnalysis),
  testVerification: () => import('./test-verification.js').then(m => m.testVerification),
  
  // Coverage and monitoring
  coverallsApi: () => import('./coveralls-api.js').then(m => ({ 
    name: 'coveralls_api',
    description: 'Fetch and process coverage data from Coveralls API',
    category: 'integration' as const,
    version: '1.0.0',
    parameters: {
      type: 'object' as const,
      properties: {
        operation: {
          type: 'string',
          enum: ['getRepo', 'getBuilds', 'getBuild', 'getJob', 'getSourceFile'],
          description: 'Coveralls API operation to perform'
        },
        service: { type: 'string', description: 'Git service (github, bitbucket, etc.)' },
        username: { type: 'string', description: 'Repository owner username' },
        repo: { type: 'string', description: 'Repository name' },
        buildId: { type: 'string', description: 'Build ID for build operations' },
        jobId: { type: 'string', description: 'Job ID for job operations' },
        filePath: { type: 'string', description: 'File path for source file operations' },
        page: { type: 'number', description: 'Page number for paginated results' }
      },
      required: ['operation']
    },
    async execute(params: any) {
      const api = new m.CoverallsAPI();
      const { operation, service, username, repo, buildId, jobId, filePath, page = 1 } = params;
      
      try {
        switch (operation) {
          case 'getRepo':
            if (!service || !username || !repo) throw new Error('Missing required parameters: service, username, repo');
            return await api.getRepo(service, username, repo);
          
          case 'getBuilds':
            if (!service || !username || !repo) throw new Error('Missing required parameters: service, username, repo');
            return await api.getRepoBuilds(service, username, repo, page);
          
          case 'getBuild':
            if (!buildId) throw new Error('Missing required parameter: buildId');
            return await api.getBuild(buildId);
          
          case 'getJob':
            if (!jobId) throw new Error('Missing required parameter: jobId');
            return await api.getJob(jobId);
          
          case 'getSourceFile':
            if (!jobId || !filePath) throw new Error('Missing required parameters: jobId, filePath');
            return await api.getSourceFile(jobId, filePath);
          
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
  }))
};

// Built-in utility tools
const getDateTool: ToolDefinition = {
  name: 'getDate',
  description: 'Get the current date and time in ISO format',
  version: '1.0.0',
  category: 'utility',
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['iso', 'timestamp', 'locale'],
        description: 'Output format for the date'
      },
      timezone: {
        type: 'string',
        description: 'Timezone for the date (e.g., "UTC", "America/New_York")'
      }
    }
  },
  execute: (params: { format?: 'iso' | 'timestamp' | 'locale'; timezone?: string } = {}) => {
    const { format = 'iso', timezone } = params;
    const now = new Date();
    
    try {
      switch (format) {
        case 'timestamp':
          return { date: now.getTime(), format: 'timestamp' };
        case 'locale':
          return { 
            date: timezone ? now.toLocaleString('en-US', { timeZone: timezone }) : now.toLocaleString(),
            format: 'locale',
            timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          };
        default:
          return { 
            date: now.toISOString(),
            format: 'iso',
            timezone: 'UTC'
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

const testRepoTool: ToolDefinition = {
  name: 'testRepo',
  description: 'Test a GitHub repository with optional PR number and comprehensive test suite execution',
  version: '2.0.0',
  category: 'testing',
  dependencies: ['testVerification'],
  parameters: {
    type: 'object',
    properties: {
      repo: {
        type: 'string',
        description: 'Repository name in format owner/repo'
      },
      prNumber: {
        type: 'number',
        description: 'Optional PR number to test'
      },
      testType: {
        type: 'string',
        enum: ['unit', 'integration', 'e2e', 'all'],
        description: 'Type of tests to run'
      },
      coverage: {
        type: 'boolean',
        description: 'Enable coverage reporting'
      }
    },
    required: ['repo']
  },
  execute: async (params: { 
    repo: string; 
    prNumber?: number; 
    testType?: 'unit' | 'integration' | 'e2e' | 'all';
    coverage?: boolean;
  }) => {
    try {
      const testVerification = await loadTool('testVerification');
      const { repo, prNumber, testType = 'all', coverage = true } = params;
      
      const testParams = {
        operation: testType,
        path: prNumber ? `pr/${prNumber}` : '',
        coverage
      };
      
      const result = await testVerification.execute(testParams);
      
      return {
        success: true,
        repo,
        prNumber,
        testType,
        coverage,
        results: result,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

// Tool cache for performance optimization
const toolCache: ToolCache = {};

/**
 * Load a tool with caching and error handling
 */
export async function loadTool(toolName: string): Promise<Tool | ToolDefinition> {
  // Return cached tool if available
  if (toolCache[toolName]) {
    return toolCache[toolName];
  }
  
  // Check if tool exists in registry
  if (!toolRegistry[toolName]) {
    throw new Error(`Tool '${toolName}' not found in registry. Available tools: ${Object.keys(toolRegistry).join(', ')}`);
  }
  
  try {
    // Load tool with error boundary
    const tool = await toolRegistry[toolName]();
    
    // Validate tool structure
    if (!tool || !tool.name || !tool.execute || typeof tool.execute !== 'function') {
      throw new Error(`Invalid tool structure for '${toolName}'. Tool must have name and execute function.`);
    }
    
    // Cache the loaded tool
    toolCache[toolName] = tool;
    
    return tool;
  } catch (error: any) {
    throw new Error(`Failed to load tool '${toolName}': ${error.message}`);
  }
}

/**
 * Get all available tool names
 */
export function getAvailableTools(): string[] {
  return [...Object.keys(toolRegistry), 'getDate', 'testRepo'];
}

/**
 * Get tool information without loading
 */
export function getToolInfo(toolName: string): { name: string; available: boolean; cached: boolean } {
  return {
    name: toolName,
    available: toolName in toolRegistry || toolName === 'getDate' || toolName === 'testRepo',
    cached: toolName in toolCache
  };
}

/**
 * Load multiple tools in parallel
 */
export async function loadTools(toolNames: string[]): Promise<Record<string, Tool | ToolDefinition>> {
  const tools: Record<string, Tool | ToolDefinition> = {};

  const loadPromises = toolNames.map(async (name) => {
    try {
      tools[name] = await loadTool(name);
    } catch (error: any) {
      console.warn(`Failed to load tool '${name}': ${error.message}`);
    }
  });
  
  await Promise.allSettled(loadPromises);
  
  return tools;
}

/**
 * Clear tool cache (useful for development/testing)
 */
export function clearToolCache(): void {
  Object.keys(toolCache).forEach(key => delete toolCache[key]);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { 
  cachedTools: number; 
  availableTools: number; 
  cacheHitRate: number;
  cachedToolNames: string[];
} {
  const cachedCount = Object.keys(toolCache).length;
  const availableCount = getAvailableTools().length;
  
  return {
    cachedTools: cachedCount,
    availableTools: availableCount,
    cacheHitRate: availableCount > 0 ? cachedCount / availableCount : 0,
    cachedToolNames: Object.keys(toolCache)
  };
}

// Pre-defined tool collections for common workflows
export const tools: ToolDefinition[] = [getDateTool, testRepoTool];

// Workflow-specific tool collections
export const workflowTools = {
  development: ['codeAnalysis', 'testVerification', 'gitOperations'],
  testing: ['testVerification', 'coverallsApi', 'codeAnalysis'],
  integration: ['apiOrchestration', 'emailIntegration', 'coverallsApi'],
  analysis: ['codeAnalysis', 'browserHistory', 'coverallsApi'],
  all: getAvailableTools()
};

/**
 * Load tools for a specific workflow
 */
export async function loadWorkflowTools(workflow: keyof typeof workflowTools): Promise<Record<string, Tool | ToolDefinition>> {
  const toolNames = workflowTools[workflow] || [];
  return await loadTools(toolNames);
}

// Legacy exports for backward compatibility (with lazy loading)
export const BrowserHistoryTool = () => loadTool('browserHistory');
export const gitOperations = () => loadTool('gitOperations');  
export const emailIntegration = () => loadTool('emailIntegration');
export const apiOrchestration = () => loadTool('apiOrchestration');
export const codeAnalysis = () => loadTool('codeAnalysis');
export const testVerification = () => loadTool('testVerification');

export default tools;
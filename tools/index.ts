/**
 * Tools Orchestration
 * A collection of reusable tools for LLM agent workflows
 */
import BrowserHistoryTool from './browser-history.js';
import { gitOperations } from './git-operations.js';
import { emailIntegration } from './email-integration.js';
import { apiOrchestration } from './api-orchestration.js';
import { codeAnalysis } from './code-analysis.js';
import { testVerification } from './test-verification.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

/**
 * Get the current date and time
 */
const getDateTool: ToolDefinition = {
  name: 'getDate',
  description: 'Get the current date and time',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (): Promise<ToolExecutionResult> => {
    return {
      success: true,
      data: { date: new Date().toISOString() },
      timestamp: new Date().toISOString()
    };
  },
};

/**
 * Test a repository with optional PR number
 */
const testRepoTool: ToolDefinition = {
  name: 'testRepo',
  description: 'Test a GitHub repository with optional PR number',
  parameters: {
    type: 'object',
    properties: {
      repo: {
        type: 'string',
        description: 'Repository name in format owner/repo',
      },
      prNumber: {
        type: 'number',
        description: 'Optional PR number to test',
      },
    },
    required: ['repo'],
  },
  execute: async (params: { repo: string; prNumber?: number }): Promise<ToolExecutionResult> => {
    try {
      const result = await testVerification.execute(params);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },
};

/**
 * Code analysis tool wrapper
 */
const codeAnalysisTool: ToolDefinition = {
  name: 'codeAnalysis',
  description: 'Analyze code, identify issues, and apply automated fixes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['lint', 'format', 'test', 'fix', 'analyze', 'read', 'write', 'patch'],
        description: 'Code operation to perform',
      },
      path: {
        type: 'string',
        description: 'File or directory path',
      },
      content: {
        type: 'string',
        description: 'File content for write operations',
      },
      autoFix: {
        type: 'boolean',
        description: 'Automatically apply fixes (default: false)',
      },
    },
    required: ['operation'],
  },
  execute: async (params: any): Promise<ToolExecutionResult> => {
    try {
      const result = await codeAnalysis.execute(params);
      return {
        success: result.success || false,
        data: result,
        error: result.error,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },
};

/**
 * API orchestration tool wrapper
 */
const apiOrchestrationTool: ToolDefinition = {
  name: 'apiOrchestration',
  description: 'Make API requests and orchestrate external integrations',
  parameters: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        description: 'HTTP method',
      },
      url: {
        type: 'string',
        description: 'API endpoint URL',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers',
      },
      body: {
        type: 'object',
        description: 'Request body (for POST, PUT, PATCH)',
      },
    },
    required: ['method', 'url'],
  },
  execute: async (params: any): Promise<ToolExecutionResult> => {
    try {
      const result = await apiOrchestration.execute(params);
      return {
        success: result.success || false,
        data: result,
        error: result.error,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  },
};

// Tool registry for easy access and management
export const toolRegistry = new Map<string, ToolDefinition>([
  ['getDate', getDateTool],
  ['testRepo', testRepoTool],
  ['codeAnalysis', codeAnalysisTool],
  ['apiOrchestration', apiOrchestrationTool],
]);

// Export tools array for backward compatibility
export const tools: ToolDefinition[] = [
  getDateTool,
  testRepoTool,
  codeAnalysisTool,
  apiOrchestrationTool,
];

// Utility function to get a tool by name
export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

// Utility function to execute a tool safely
export async function executeTool(name: string, params: any): Promise<ToolExecutionResult> {
  const tool = getTool(name);
  if (!tool) {
    return {
      success: false,
      error: `Tool '${name}' not found`,
      timestamp: new Date().toISOString()
    };
  }

  try {
    return await tool.execute(params);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error',
      timestamp: new Date().toISOString()
    };
  }
}

// Export individual tools for direct access
export { 
  BrowserHistoryTool, 
  gitOperations, 
  emailIntegration, 
  apiOrchestration, 
  codeAnalysis, 
  testVerification 
};

export default tools;
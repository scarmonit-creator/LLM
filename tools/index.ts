/**
 * Tools Orchestration
 * A collection of reusable tools for LLM agent workflows
 */
import BrowserHistoryTool from './browser-history';
import gitOperations from './git-operations.js';
import emailIntegration from './email-integration.js';
import apiOrchestration from './api-orchestration.js';
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
  execute: (params: any) => any;
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
  execute: () => {
    return { date: new Date().toISOString() };
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
  execute: async (params: { repo: string; prNumber?: number }) => {
    return testVerification.execute(params);
  },
};

export const tools: ToolDefinition[] = [
  getDateTool,
  testRepoTool,
  // Placeholder for future tool integrations
];

export { BrowserHistoryTool, gitOperations, emailIntegration, apiOrchestration, codeAnalysis, testVerification };
export default tools;

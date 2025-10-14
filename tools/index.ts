/**
 * Tools Orchestration
 * A collection of reusable tools for LLM agent workflows
 */

import BrowserHistoryTool from './browser-history';
import gitOperations from './git-operations.js';
import emailIntegration from './email-integration.js';
import apiOrchestration from './api-orchestration.js';
import codeAnalysis from './code-analysis.js';
import testVerification from './test-verification.js';
import { Tool } from './types.js';

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
 * Sum an array of numbers
 */
const sumTool: ToolDefinition = {
  name: 'sum',
  description: 'Calculate the sum of an array of numbers',
  parameters: {
    type: 'object',
    properties: {
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers to sum',
      },
    },
    required: ['numbers'],
  },
  execute: ({ numbers }: { numbers: number[] }) => {
    if (!Array.isArray(numbers) || numbers.some((n) => typeof n !== 'number')) {
      throw new Error('Invalid input: expected an array of numbers');
    }
    return { result: numbers.reduce((acc, n) => acc + n, 0) };
  },
};

/**
 * Count words in a text string
 */
const wordCountTool: ToolDefinition = {
  name: 'wordCount',
  description: 'Count the number of words in a text string',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to count words in',
      },
    },
    required: ['text'],
  },
  execute: ({ text }: { text: string }) => {
    if (typeof text !== 'string') {
      throw new Error('Invalid input: expected a string');
    }
    const words = text.trim().split(/\s+/);
    return { count: words.length };
  },
};

/**
 * Generate a random password
 */
const generatePasswordTool: ToolDefinition = {
  name: 'generatePassword',
  description: 'Generate a random secure password',
  parameters: {
    type: 'object',
    properties: {
      length: {
        type: 'integer',
        default: 16,
        description: 'Length of the password',
      },
      includeSymbols: {
        type: 'boolean',
        default: true,
        description: 'Include special symbols in the password',
      },
    },
    required: [],
  },
  execute: ({
    length = 16,
    includeSymbols = true,
  }: {
    length?: number;
    includeSymbols?: boolean;
  }) => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let chars = lowercase + uppercase + numbers;
    if (includeSymbols) {
      chars += symbols;
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    return { password };
  },
};

/**
 * Browser History Tool - Access and manage browser history with autonomous syncing
 */
const browserHistoryTool: ToolDefinition = {
  name: 'browserHistory',
  description: 'Access browser history with autonomous syncing capabilities',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['recent', 'search', 'domain'],
        description:
          'The action to perform: recent (get recent history), search (search history), or domain (filter by domain)',
      },
      query: {
        type: 'string',
        description: 'Search query or domain name (required for search and domain actions)',
      },
      limit: {
        type: 'integer',
        default: 100,
        description: 'Maximum number of results to return',
      },
    },
    required: ['action'],
  },
  execute: async (params: {
    action: 'recent' | 'search' | 'domain';
    query?: string;
    limit?: number;
  }) => {
    const historyTool = new BrowserHistoryTool({ autoSync: true, syncInterval: 60000 });
    try {
      const result = await historyTool.execute(params);
      return result;
    } finally {
      historyTool.destroy();
    }
  },
};

/**
 * Export all tool definitions in a single object keyed by name. New tools
 * should be added to this object so they can be discovered by the
 * orchestrator or agents that need to call them.
 */
const tools: Record<string, ToolDefinition | Tool> = {
  [getDateTool.name]: getDateTool,
  [sumTool.name]: sumTool,
  [wordCountTool.name]: wordCountTool,
  [generatePasswordTool.name]: generatePasswordTool,
  [browserHistoryTool.name]: browserHistoryTool,
  // New autonomous agent tools
  [gitOperations.name]: gitOperations,
  [emailIntegration.name]: emailIntegration,
  [apiOrchestration.name]: apiOrchestration,
  [codeAnalysis.name]: codeAnalysis,
  [testVerification.name]: testVerification,
};

export default tools;

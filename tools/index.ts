/**
 * Tools Orchestration
 * A collection of reusable tools for LLM agent workflows
 */
import BrowserHistoryTool from './browser-history';

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
 * Sum two numbers
 */
const sumTool: ToolDefinition = {
  name: 'sum',
  description: 'Add two numbers together',
  parameters: {
    type: 'object',
    properties: {
      a: {
        type: 'number',
        description: 'The first number',
      },
      b: {
        type: 'number',
        description: 'The second number',
      },
    },
    required: ['a', 'b'],
  },
  execute: ({ a, b }: { a: number; b: number }) => {
    return { result: a + b };
  },
};

/**
 * Count words in text
 */
const wordCountTool: ToolDefinition = {
  name: 'wordCount',
  description: 'Count the number of words in a given text',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to analyse',
      },
    },
    required: ['text'],
  },
  execute: ({ text }: { text: string }) => {
    const count =
      typeof text === 'string' ? (text.trim().length ? text.trim().split(/\s+/).length : 0) : 0;
    return { count };
  },
};

/**
 * Generate a random password. Accepts an optional length and flags to include
 * numbers and symbols. If no arguments are provided a default 12 character
 * password containing letters, numbers and symbols will be generated.
 */
const generatePasswordTool: ToolDefinition = {
  name: 'generatePassword',
  description: 'Generate a random password with optional length, numbers and symbols',
  parameters: {
    type: 'object',
    properties: {
      length: {
        type: 'integer',
        minimum: 4,
        maximum: 64,
        default: 12,
        description: 'Desired password length (4–64 characters)',
      },
      numbers: {
        type: 'boolean',
        default: true,
        description: 'Include numeric characters',
      },
      symbols: {
        type: 'boolean',
        default: true,
        description: 'Include symbol characters',
      },
    },
    required: [],
  },
  execute: ({
    length = 12,
    numbers = true,
    symbols = true,
  }: {
    length?: number;
    numbers?: boolean;
    symbols?: boolean;
  }) => {
    // Build a character set based on options
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = lower.toUpperCase();
    const digits = '0123456789';
    const sym = '!@#$%^&*()-_=+[]{};:,.<>/?';

    let charset = lower + upper;
    if (numbers) charset += digits;
    if (symbols) charset += sym;

    let password = '';
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * charset.length);
      password += charset.charAt(idx);
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
 * Export all tool definitions in a single object keyed by name.  New tools
 * should be added to this object so they can be discovered by the
 * orchestrator or agents that need to call them.
 */
const tools: Record<string, ToolDefinition> = {
  [getDateTool.name]: getDateTool,
  [sumTool.name]: sumTool,
  [wordCountTool.name]: wordCountTool,
  [generatePasswordTool.name]: generatePasswordTool,
  [browserHistoryTool.name]: browserHistoryTool,
};

export default tools;

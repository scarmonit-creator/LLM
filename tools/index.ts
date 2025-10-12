/**
 * A collection of simple tool functions that can be invoked by the multi‑agent
 * system.  These tools are intentionally small and self‑contained so they
 * operate entirely within the sandbox without requiring network access.
 *
 * Each tool exposes metadata describing its name, description and expected
 * parameters, along with an `execute` function that performs the work and
 * returns a JSON‑serializable result.  Additional tools can be added here
 * following the same structure.
 */

export interface ToolDefinition {
  /**
   * Unique tool name.  This should match the name used when invoking the
   * tool from within a model message or envelope.
   */
  name: string;
  /** Human‑friendly description of what the tool does. */
  description: string;
  /** JSON Schema describing the tool arguments. */
  parameters: any;
  /**
   * Execute the tool.  Accepts a single argument object which will be
   * validated against the `parameters` schema (validation is optional and
   * should be added by the caller if needed).  Returns a JSON‑serializable
   * result.
   */
  execute: (args: any) => Promise<any> | any;
}

/**
 * Returns the current date/time as an ISO string.  No arguments are
 * required.  The result object contains a single key `now`.
 */
const getDateTool: ToolDefinition = {
  name: 'getDate',
  description: 'Return the current date and time in ISO format',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: () => {
    return { now: new Date().toISOString() };
  },
};

/**
 * Sum an array of numbers.  Accepts one argument `numbers`, which must be
 * an array of numeric values.  Returns an object with a single key `sum`.
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
        description: 'An array of numbers to sum',
      },
    },
    required: ['numbers'],
  },
  execute: ({ numbers }: { numbers: number[] }) => {
    const total = Array.isArray(numbers)
      ? numbers.reduce((acc: number, val: number) => acc + Number(val || 0), 0)
      : 0;
    return { sum: total };
  },
};

/**
 * Count the number of words in a string.  Accepts one argument `text`.
 * Words are separated by whitespace.  Returns an object with a single
 * key `count`.
 */
const wordCountTool: ToolDefinition = {
  name: 'wordCount',
  description: 'Count the number of words in the provided text',
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
    const count = typeof text === 'string'
      ? (text.trim().length ? text.trim().split(/\s+/).length : 0)
      : 0;
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
        description: 'Desired password length (4–64 characters)'
      },
      numbers: {
        type: 'boolean',
        default: true,
        description: 'Include numeric characters'
      },
      symbols: {
        type: 'boolean',
        default: true,
        description: 'Include symbol characters'
      }
    },
    required: [],
  },
  execute: ({ length = 12, numbers = true, symbols = true }: { length?: number; numbers?: boolean; symbols?: boolean }) => {
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
  }
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
};

export default tools;
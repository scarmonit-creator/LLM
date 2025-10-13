import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReActAgent,
  parseReActOutput,
  executeToolCall,
  runReActLoop,
  formatToolResponse,
} from '../src/react-tool-reasoning.js';

describe('ReAct Tool Reasoning Module', () => {
  describe('ReActAgent class', () => {
    let agent;

    beforeEach(() => {
      const tools = {
        calculator: (expr) => eval(expr),
        search: (query) => `Search results for: ${query}`,
        weather: (location) => `Weather in ${location}: Sunny, 72°F`,
      };
      agent = new ReActAgent({ tools, maxIterations: 5 });
    });

    it('should create agent with tools', () => {
      expect(agent).toBeDefined();
      expect(agent.tools).toBeDefined();
      expect(agent.maxIterations).toBe(5);
    });

    it('should process thought-action-observation cycle', async () => {
      const query = 'What is 25 + 17?';
      const result = await agent.run(query);

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should use calculator tool', async () => {
      const query = 'Calculate 100 * 5';
      const result = await agent.run(query);

      expect(result).toBeDefined();
      expect(result.toolsUsed).toContain('calculator');
      expect(result.answer).toContain('500');
    });

    it('should chain multiple tool calls', async () => {
      const query = 'Search for weather and calculate 2+2';
      const result = await agent.run(query);

      expect(result).toBeDefined();
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
      expect(result.toolsUsed.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parseReActOutput', () => {
    it('should parse thought from output', () => {
      const output = 'Thought: I need to calculate the sum\nAction: calculator[25+17]';
      const parsed = parseReActOutput(output);

      expect(parsed).toBeDefined();
      expect(parsed.thought).toBe('I need to calculate the sum');
    });

    it('should parse action and input', () => {
      const output = 'Thought: Need to search\nAction: search[AI developments]';
      const parsed = parseReActOutput(output);

      expect(parsed).toBeDefined();
      expect(parsed.action).toBe('search');
      expect(parsed.actionInput).toBe('AI developments');
    });

    it('should handle observation in output', () => {
      const output = 'Observation: The result is 42';
      const parsed = parseReActOutput(output);

      expect(parsed).toBeDefined();
      expect(parsed.observation).toBe('The result is 42');
    });

    it('should parse final answer', () => {
      const output = 'Thought: I have all the information\nFinal Answer: The sum is 42';
      const parsed = parseReActOutput(output);

      expect(parsed).toBeDefined();
      expect(parsed.finalAnswer).toBe('The sum is 42');
    });

    it('should handle malformed output gracefully', () => {
      const output = 'Invalid format without proper tags';
      const parsed = parseReActOutput(output);

      expect(parsed).toBeDefined();
      expect(parsed.thought).toBe('');
    });
  });

  describe('executeToolCall', () => {
    const tools = {
      calculator: (expr) => eval(expr),
      uppercase: (text) => text.toUpperCase(),
      concat: (a, b) => a + b,
    };

    it('should execute valid tool call', async () => {
      const result = await executeToolCall('calculator', '10 * 5', tools);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toBe(50);
    });

    it('should handle tool execution errors', async () => {
      const result = await executeToolCall('calculator', 'invalid expression', tools);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-existent tool', async () => {
      const result = await executeToolCall('nonexistent', 'input', tools);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should pass correct arguments to tool', async () => {
      const result = await executeToolCall('uppercase', 'hello', tools);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO');
    });
  });

  describe('runReActLoop', () => {
    const tools = {
      calculator: (expr) => eval(expr),
      search: (q) => `Results for ${q}`,
    };

    it('should complete ReAct loop successfully', async () => {
      const query = 'What is 15 + 30?';
      const result = await runReActLoop(query, tools, { maxIterations: 5 });

      expect(result).toBeDefined();
      expect(result.finalAnswer).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should track reasoning steps', async () => {
      const query = 'Calculate 2 * 3';
      const result = await runReActLoop(query, tools);

      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should respect max iterations limit', async () => {
      const query = 'Complex query';
      const result = await runReActLoop(query, tools, { maxIterations: 3 });

      expect(result).toBeDefined();
      expect(result.steps.length).toBeLessThanOrEqual(3);
    });

    it('should handle tool failures gracefully', async () => {
      const failingTools = {
        broken: () => {
          throw new Error('Tool error');
        },
      };
      const query = 'Use broken tool';
      const result = await runReActLoop(query, failingTools);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('formatToolResponse', () => {
    it('should format successful tool response', () => {
      const response = { success: true, output: 'Result' };
      const formatted = formatToolResponse(response);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Result');
    });

    it('should format error response', () => {
      const response = { success: false, error: 'Error message' };
      const formatted = formatToolResponse(response);

      expect(formatted).toBeDefined();
      expect(formatted).toContain('Error');
      expect(formatted).toContain('Error message');
    });

    it('should handle complex output objects', () => {
      const response = { success: true, output: { data: [1, 2, 3] } };
      const formatted = formatToolResponse(response);

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Integration tests', () => {
    it('should solve multi-step reasoning problem', async () => {
      const tools = {
        calculator: (expr) => eval(expr),
        memory: (() => {
          const store = {};
          return {
            set: (key, val) => {
              store[key] = val;
              return `Stored ${key}`;
            },
            get: (key) => store[key] || 'Not found',
          };
        })(),
      };

      const agent = new ReActAgent({ tools, maxIterations: 10 });
      const query = 'Calculate 10 * 5 and remember the result';
      const result = await agent.run(query);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.finalAnswer).toBeDefined();
    });

    it('should provide detailed reasoning trace', async () => {
      const tools = { calculator: (expr) => eval(expr) };
      const agent = new ReActAgent({ tools });
      const query = 'What is (25 + 15) * 2?';
      const result = await agent.run(query);

      expect(result).toBeDefined();
      expect(result.reasoningTrace).toBeDefined();
      expect(result.reasoningTrace.length).toBeGreaterThan(0);
    });
  });
});

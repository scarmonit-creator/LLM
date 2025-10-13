import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
      assert.ok(agent);
      assert.ok(agent.tools);
      assert.equal(agent.maxSteps, 5);
    });
  });

  describe('parseReActOutput', () => {
    it('should parse thought from output', () => {
      const output = 'Thought: I need to calculate the sum\nAction: calculator[25+17]';
      const parsed = parseReActOutput(output);

      assert.ok(parsed);
      assert.equal(parsed.thought, 'I need to calculate the sum');
    });

    it('should parse action and input', () => {
      const output = 'Thought: Need to search\nAction: search[AI developments]';
      const parsed = parseReActOutput(output);

      assert.ok(parsed);
      assert.equal(parsed.action, 'search');
      assert.equal(parsed.input, 'AI developments');
    });

    it('should handle observation in output', () => {
      const output = 'Observation: The result is 42';
      const parsed = parseReActOutput(output);

      assert.ok(parsed);
      assert.equal(parsed.observation, 'The result is 42');
    });

    it('should parse final answer', () => {
      const output = 'Thought: I have all the information\nFinal Answer: The sum is 42';
      const parsed = parseReActOutput(output);

      assert.ok(parsed);
      assert.equal(parsed.finish, 'The sum is 42');
    });

    it('should handle malformed output gracefully', () => {
      const output = 'Invalid format without proper tags';
      const parsed = parseReActOutput(output);

      assert.ok(parsed);
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

      assert.ok(result);
      assert.equal(result, 50);
    });

    it('should handle non-existent tool', async () => {
      await assert.rejects(
        async () => await executeToolCall('nonexistent', 'input', tools),
        { message: /not found/ }
      );
    });

    it('should pass correct arguments to tool', async () => {
      const result = await executeToolCall('uppercase', 'hello', tools);

      assert.ok(result);
      assert.equal(result, 'HELLO');
    });
  });

  describe('runReActLoop', () => {
    const tools = {
      calculator: (expr) => eval(expr),
      search: (q) => `Results for ${q}`,
    };

    const mockLLM = {
      generate: async (prompt) => {
        if (prompt.includes('15 + 30')) {
          return 'Thought: I need to calculate\nAction: calculator[15+30]';
        }
        return 'Thought: Done\nFinish: 45';
      },
    };

    it('should complete ReAct loop successfully', async () => {
      const query = 'What is 15 + 30?';
      const result = await runReActLoop(query, tools, mockLLM, 5);

      assert.ok(result);
      assert.ok(result.answer !== undefined);
    });
  });

  describe('formatToolResponse', () => {
    it('should format tool response', () => {
      const formatted = formatToolResponse('calculator', 42);

      assert.ok(formatted);
      assert.ok(formatted.includes('calculator'));
      assert.ok(formatted.includes('42'));
    });

    it('should handle complex output objects', () => {
      const formatted = formatToolResponse('tool', { data: [1, 2, 3] });

      assert.ok(formatted);
      assert.equal(typeof formatted, 'string');
    });
  });
});

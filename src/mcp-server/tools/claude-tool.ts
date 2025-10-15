// Claude Tool Implementation for MCP Server
// Provides direct access to Claude conversations through MCP

import { BaseTool } from './base-tool.js';

interface ClaudeArgs {
  message: string;
  conversation_id?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export class ClaudeTool extends BaseTool {
  public readonly name = 'claude_chat';
  public readonly description = 'Direct access to Claude conversations with context support';
  public readonly inputSchema = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message to send to Claude'
      },
      conversation_id: {
        type: 'string',
        description: 'Optional conversation ID to maintain context'
      },
      model: {
        type: 'string',
        description: 'Claude model to use (claude-3-sonnet, claude-3-opus, etc.)',
        default: 'claude-3-sonnet-20240229'
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens in response',
        default: 1000,
        minimum: 1,
        maximum: 4096
      },
      temperature: {
        type: 'number',
        description: 'Response creativity (0.0-1.0)',
        default: 0.7,
        minimum: 0,
        maximum: 1
      }
    },
    required: ['message']
  };

  async execute(args: ClaudeArgs): Promise<any> {
    const { message, conversation_id, model = 'claude-3-sonnet-20240229', max_tokens = 1000, temperature = 0.7 } = args;

    try {
      // Import Claude client (assuming it exists in the framework)
      const { ClaudeClient } = await import('../../claude/claude-client.js');
      
      const client = new ClaudeClient({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model,
        maxTokens: max_tokens,
        temperature
      });

      const response = await client.sendMessage(message, {
        conversationId: conversation_id
      });

      return {
        success: true,
        response: response.content,
        conversation_id: response.conversationId,
        model_used: model,
        tokens_used: response.usage?.total_tokens || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Claude tool error:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to communicate with Claude',
        timestamp: new Date().toISOString()
      };
    }
  }
}
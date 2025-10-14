import type { MCPTool, ClaudeToolArgs, ToolResult } from '../types.js';

// Import Claude client from existing framework
let ClaudeClient: any;
try {
  const module = await import('../../claude-client.js');
  ClaudeClient = module.default;
} catch (error) {
  console.warn('Claude client not available:', error);
}

/**
 * Claude Chat Tool - Provides access to Claude conversations via MCP
 */
class ClaudeToolImplementation {
  private client: any;
  private conversations: Map<string, any> = new Map();

  constructor() {
    if (ClaudeClient) {
      this.client = new ClaudeClient();
    }
  }

  async execute(args: ClaudeToolArgs): Promise<ToolResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Claude client not available. Check ANTHROPIC_API_KEY configuration.',
      };
    }

    try {
      const {
        message,
        conversation_id,
        model = 'claude-3-5-sonnet-20241022',
        max_tokens = 4096,
        temperature = 0.7,
      } = args;

      if (!message) {
        return {
          success: false,
          error: 'Message is required',
        };
      }

      let conversationContext = null;
      if (conversation_id) {
        conversationContext = this.conversations.get(conversation_id);
      }

      // Use existing Claude client method
      const response = await this.client.query(message, {
        model,
        max_tokens,
        temperature,
        conversation_id: conversationContext?.id,
      });

      // Update conversation context
      if (conversation_id) {
        const context = this.conversations.get(conversation_id) || {
          id: conversation_id,
          messages: [],
          created_at: new Date(),
        };
        
        context.messages.push(
          {
            role: 'user',
            content: message,
            timestamp: new Date(),
          },
          {
            role: 'assistant',
            content: response,
            timestamp: new Date(),
          }
        );
        context.updated_at = new Date();
        
        this.conversations.set(conversation_id, context);
      }

      return {
        success: true,
        data: {
          response,
          conversation_id,
          model,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          tokens_used: response.length, // Approximate
          conversation_length: conversation_id
            ? this.conversations.get(conversation_id)?.messages.length || 0
            : 1,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Claude API error: ${errorMessage}`,
      };
    }
  }

  getConversation(conversationId: string) {
    return this.conversations.get(conversationId);
  }

  clearConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }
}

const implementation = new ClaudeToolImplementation();

export const claudeTool: MCPTool = {
  name: 'claude_chat',
  description: 'Chat with Claude AI assistant. Supports conversation context and various models.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to send to Claude',
      },
      conversation_id: {
        type: 'string',
        description: 'Optional conversation ID to maintain context across multiple calls',
      },
      model: {
        type: 'string',
        description: 'Claude model to use',
        enum: [
          'claude-3-5-sonnet-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ],
        default: 'claude-3-5-sonnet-20241022',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens in the response',
        minimum: 1,
        maximum: 8192,
        default: 4096,
      },
      temperature: {
        type: 'number',
        description: 'Temperature for response randomness',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
    },
    required: ['message'],
  },
  execute: (args: Record<string, any>) => implementation.execute(args as ClaudeToolArgs),
};

export default claudeTool;

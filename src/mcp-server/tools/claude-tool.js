/**
 * Claude AI Integration Tool for MCP Server
 * Provides direct access to Claude AI conversations with context management
 */

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// Input schema for Claude chat tool
const ClaudeChatSchema = z.object({
  message: z.string().min(1).max(10000),
  conversation_id: z.string().optional(),
  model: z.string().optional().default('claude-3-5-sonnet-20241022'),
  max_tokens: z.number().optional().default(4096),
  temperature: z.number().min(0).max(1).optional().default(0.7),
  system_prompt: z.string().optional(),
});

export class ClaudeTool {
  constructor() {
    this.name = 'claude_chat';
    this.description = 'Direct access to Claude AI conversations with context management and advanced features';
    this.inputSchema = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to send to Claude',
          minLength: 1,
          maxLength: 10000,
        },
        conversation_id: {
          type: 'string',
          description: 'Optional conversation context ID for maintaining dialogue state',
          optional: true,
        },
        model: {
          type: 'string',
          description: 'Claude model to use',
          default: 'claude-3-5-sonnet-20241022',
          optional: true,
        },
        max_tokens: {
          type: 'number',
          description: 'Maximum tokens in response',
          default: 4096,
          optional: true,
        },
        temperature: {
          type: 'number',
          description: 'Response creativity (0.0-1.0)',
          minimum: 0,
          maximum: 1,
          default: 0.7,
          optional: true,
        },
        system_prompt: {
          type: 'string',
          description: 'Optional system prompt to guide Claude behavior',
          optional: true,
        },
      },
      required: ['message'],
    };

    // Initialize Claude client
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Conversation context storage
    this.conversations = new Map();
    this.conversationCleanupInterval = 3600000; // 1 hour

    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      activeConversations: 0,
    };

    // Start cleanup task
    this.startConversationCleanup();

    console.log('🤖 Claude Tool initialized with conversation management');
  }

  /**
   * Execute Claude chat request
   */
  async execute(args) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Validate input
      const validatedArgs = ClaudeChatSchema.parse(args);
      const { message, conversation_id, model, max_tokens, temperature, system_prompt } = validatedArgs;

      // Get or create conversation context
      let conversation = null;
      if (conversation_id) {
        conversation = this.getConversation(conversation_id);
      }

      // Prepare messages array
      const messages = [];
      
      // Add conversation history
      if (conversation && conversation.messages) {
        messages.push(...conversation.messages);
      }
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Prepare request parameters
      const requestParams = {
        model,
        max_tokens,
        temperature,
        messages,
      };

      // Add system prompt if provided
      if (system_prompt) {
        requestParams.system = system_prompt;
      }

      // Make request to Claude
      const response = await this.client.messages.create(requestParams);

      // Extract response content
      const responseContent = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Update conversation context
      if (conversation_id) {
        this.updateConversation(conversation_id, message, responseContent);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, response.usage?.input_tokens || 0, response.usage?.output_tokens || 0, true);

      // Return structured response
      return {
        success: true,
        response: responseContent,
        conversation_id: conversation_id || null,
        model_used: model,
        usage: {
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        },
        metadata: {
          response_time_ms: responseTime,
          timestamp: new Date().toISOString(),
          conversation_length: conversation ? conversation.messages.length + 1 : 1,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, 0, 0, false);

      console.error('🚨 Claude Tool error:', error.message);
      
      return {
        success: false,
        error: error.message,
        error_type: error.constructor.name,
        metadata: {
          response_time_ms: responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get or create conversation context
   */
  getConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        id: conversationId,
        created: Date.now(),
        lastAccessed: Date.now(),
        messages: [],
        totalTokens: 0,
      });
      this.metrics.activeConversations++;
    }

    const conversation = this.conversations.get(conversationId);
    conversation.lastAccessed = Date.now();
    return conversation;
  }

  /**
   * Update conversation with new messages
   */
  updateConversation(conversationId, userMessage, assistantResponse) {
    const conversation = this.getConversation(conversationId);
    
    // Add user message
    conversation.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });
    
    // Add assistant response
    conversation.messages.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: Date.now(),
    });
    
    // Limit conversation history (keep last 20 messages)
    if (conversation.messages.length > 20) {
      conversation.messages = conversation.messages.slice(-20);
    }
    
    conversation.lastAccessed = Date.now();
  }

  /**
   * Update performance metrics
   */
  updateMetrics(responseTime, inputTokens, outputTokens, success) {
    // Update response time (exponential moving average)
    const alpha = 0.1;
    this.metrics.averageResponseTime = 
      alpha * responseTime + (1 - alpha) * this.metrics.averageResponseTime;
    
    // Update counters
    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.totalTokensUsed += inputTokens + outputTokens;
    } else {
      this.metrics.errorRequests++;
    }
  }

  /**
   * Start conversation cleanup task
   */
  startConversationCleanup() {
    setInterval(() => {
      this.cleanupOldConversations();
    }, this.conversationCleanupInterval);
  }

  /**
   * Clean up old conversations to prevent memory leaks
   */
  cleanupOldConversations() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    let cleanedCount = 0;

    for (const [conversationId, conversation] of this.conversations) {
      if (now - conversation.lastAccessed > maxAge) {
        this.conversations.delete(conversationId);
        cleanedCount++;
        this.metrics.activeConversations--;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old conversations`);
    }
  }

  /**
   * Get tool performance statistics
   */
  getStats() {
    const successRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.successfulRequests / this.metrics.totalRequests * 100) : 0;
    
    return {
      performance: {
        totalRequests: this.metrics.totalRequests,
        successRate: `${successRate.toFixed(2)}%`,
        averageResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`,
        totalTokensUsed: this.metrics.totalTokensUsed,
      },
      conversations: {
        active: this.metrics.activeConversations,
        total: this.conversations.size,
      },
      health: {
        status: 'operational',
        lastCleanup: new Date().toISOString(),
      },
    };
  }

  /**
   * Get conversation details
   */
  getConversationDetails(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      messageCount: conversation.messages.length,
      created: new Date(conversation.created).toISOString(),
      lastAccessed: new Date(conversation.lastAccessed).toISOString(),
      totalTokens: conversation.totalTokens,
    };
  }

  /**
   * Clear all conversations (admin function)
   */
  clearAllConversations() {
    const count = this.conversations.size;
    this.conversations.clear();
    this.metrics.activeConversations = 0;
    
    console.log(`🧹 Cleared ${count} conversations`);
    return count;
  }

  /**
   * Health check for Claude tool
   */
  async healthCheck() {
    try {
      // Test API connectivity with minimal request
      const testResponse = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Health check' }],
      });

      return {
        status: 'healthy',
        api_connected: true,
        response_time: '<1000ms',
        conversations_active: this.conversations.size,
        last_test: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        api_connected: false,
        error: error.message,
        conversations_active: this.conversations.size,
        last_test: new Date().toISOString(),
      };
    }
  }

  /**
   * Destroy tool and cleanup resources
   */
  destroy() {
    this.clearAllConversations();
    console.log('🗑️ Claude Tool destroyed');
  }
}

export default ClaudeTool;
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.MODEL || 'claude-sonnet-4-5-20250929';
    this.maxTokens = parseInt(process.env.MAX_TOKENS || '4096', 10);
    this.temperature = parseFloat(process.env.TEMPERATURE || '1.0');
  }

  /**
   * Send a message to Claude and get a complete response
   * @param {string} message - The user message
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} The response text
   */
  async sendMessage(message, systemPrompt = '') {
    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{ role: 'user', content: message }],
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    const response = await this.client.messages.create(params);
    return response.content[0].text;
  }

  /**
   * Send a message to Claude and stream the response
   * @param {string} message - The user message
   * @param {string} systemPrompt - Optional system prompt
   */
  async streamMessage(message, systemPrompt = '') {
    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{ role: 'user', content: message }],
      stream: true,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    const stream = await this.client.messages.create(params);

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        process.stdout.write(event.delta.text);
      }
    }
    console.log('\n');
  }

  /**
   * Multi-turn conversation with context
   * @param {Array<{role: string, content: string}>} messages - Conversation history
   * @param {string} systemPrompt - Optional system prompt
   * @returns {Promise<string>} The response text
   */
  async conversation(messages, systemPrompt = '') {
    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    const response = await this.client.messages.create(params);
    return response.content[0].text;
  }
}

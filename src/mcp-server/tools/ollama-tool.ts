import type { MCPTool, OllamaToolArgs, ToolResult } from '../types.js';

// Import Ollama client from existing framework
let OllamaDemo: any;
try {
  const module = await import('../../ollama-demo.js');
  OllamaDemo = module.default;
} catch (error) {
  console.warn('Ollama client not available:', error);
}

/**
 * Ollama Tool - Provides access to local Ollama LLM models via MCP
 */
class OllamaToolImplementation {
  private client: any;
  private availableModels: string[] = [];

  constructor() {
    if (OllamaDemo) {
      this.client = new OllamaDemo();
      this.loadAvailableModels();
    }
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      if (this.client && this.client.listModels) {
        const models = await this.client.listModels();
        this.availableModels = models.map((model: any) => model.name || model);
      } else {
        // Default common models if listing fails
        this.availableModels = [
          'llama2',
          'llama2:7b',
          'llama2:13b',
          'codellama',
          'mistral',
          'neural-chat',
          'starling-lm',
        ];
      }
    } catch (error) {
      console.warn('Could not load Ollama models:', error);
      this.availableModels = ['llama2'];
    }
  }

  async execute(args: OllamaToolArgs): Promise<ToolResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Ollama client not available. Check OLLAMA_BASE_URL configuration and ensure Ollama is running.',
      };
    }

    try {
      const {
        model,
        prompt,
        temperature = 0.7,
        top_k = 40,
        top_p = 0.9,
      } = args;

      if (!model) {
        return {
          success: false,
          error: 'Model is required',
        };
      }

      if (!prompt) {
        return {
          success: false,
          error: 'Prompt is required',
        };
      }

      // Use existing Ollama client method
      const response = await this.client.run(model, prompt, {
        temperature,
        top_k,
        top_p,
      });

      return {
        success: true,
        data: {
          response,
          model,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          prompt_length: prompt.length,
          response_length: typeof response === 'string' ? response.length : 0,
          model_used: model,
          parameters: {
            temperature,
            top_k,
            top_p,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Ollama API error: ${errorMessage}`,
      };
    }
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  async refreshModels(): Promise<void> {
    await this.loadAvailableModels();
  }
}

const implementation = new OllamaToolImplementation();

export const ollamaTool: MCPTool = {
  name: 'ollama_chat',
  description: 'Chat with local Ollama LLM models. Supports various open-source models like Llama2, Mistral, CodeLlama, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        description: 'The Ollama model to use (e.g., llama2, mistral, codellama)',
      },
      prompt: {
        type: 'string',
        description: 'The prompt/message to send to the model',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for response randomness',
        minimum: 0,
        maximum: 2,
        default: 0.7,
      },
      top_k: {
        type: 'number',
        description: 'Top-K sampling parameter',
        minimum: 1,
        maximum: 100,
        default: 40,
      },
      top_p: {
        type: 'number',
        description: 'Top-P (nucleus) sampling parameter',
        minimum: 0,
        maximum: 1,
        default: 0.9,
      },
    },
    required: ['model', 'prompt'],
  },
  execute: (args: Record<string, any>) => implementation.execute(args as OllamaToolArgs),
};

export default ollamaTool;

import type { MCPTool, JulesToolArgs, ToolResult } from '../types.js';

// Import Jules client from existing framework
let JulesClient: any;
try {
  const module = await import('../../jules-client.js');
  JulesClient = module.default;
} catch (error) {
  console.warn('Jules client not available:', error);
}

/**
 * Jules Integration Tool - Provides repository analysis and code generation via MCP
 */
class JulesToolImplementation {
  private client: any;

  constructor() {
    if (JulesClient) {
      this.client = new JulesClient();
    }
  }

  async execute(args: JulesToolArgs): Promise<ToolResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Jules client not available. Check JULES_API_KEY configuration.',
      };
    }

    try {
      const { action, repo_url, code, prompt, language = 'javascript' } = args;

      if (!action) {
        return {
          success: false,
          error: 'Action is required (analyze_repo, generate_code, or review_code)',
        };
      }

      let result: any;
      let metadata: any = {
        action,
        language,
        timestamp: new Date().toISOString(),
      };

      switch (action) {
        case 'analyze_repo':
          if (!repo_url) {
            return {
              success: false,
              error: 'repo_url is required for analyze_repo action',
            };
          }

          result = await this.client.analyzeRepository(repo_url);
          metadata.repo_url = repo_url;
          break;

        case 'generate_code':
          if (!prompt) {
            return {
              success: false,
              error: 'prompt is required for generate_code action',
            };
          }

          result = await this.client.generateCode(prompt, {
            language,
            context: code,
          });
          metadata.prompt_length = prompt.length;
          metadata.has_context = !!code;
          break;

        case 'review_code':
          if (!code) {
            return {
              success: false,
              error: 'code is required for review_code action',
            };
          }

          result = await this.client.reviewCode(code, {
            language,
            context: prompt,
          });
          metadata.code_length = code.length;
          metadata.has_context = !!prompt;
          break;

        default:
          return {
            success: false,
            error: `Unknown action: ${action}. Supported actions: analyze_repo, generate_code, review_code`,
          };
      }

      return {
        success: true,
        data: {
          action,
          result,
          language,
          timestamp: new Date().toISOString(),
        },
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Jules API error: ${errorMessage}`,
      };
    }
  }
}

const implementation = new JulesToolImplementation();

export const julesTool: MCPTool = {
  name: 'jules_analyze_repo',
  description: 'Interact with Jules AI for repository analysis, code generation, and code review.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: ['analyze_repo', 'generate_code', 'review_code'],
      },
      repo_url: {
        type: 'string',
        description: 'Repository URL for analyze_repo action',
        format: 'uri',
      },
      code: {
        type: 'string',
        description: 'Code content for generate_code context or review_code input',
      },
      prompt: {
        type: 'string',
        description: 'Prompt for generate_code action or context for review_code',
      },
      language: {
        type: 'string',
        description: 'Programming language',
        enum: [
          'javascript',
          'typescript',
          'python',
          'java',
          'cpp',
          'c',
          'csharp',
          'php',
          'ruby',
          'go',
          'rust',
          'swift',
          'kotlin',
        ],
        default: 'javascript',
      },
    },
    required: ['action'],
  },
  execute: (args: Record<string, any>) => implementation.execute(args as JulesToolArgs),
};

export default julesTool;

// Base Tool Abstract Class for MCP Server Tools
// Provides common interface and functionality for all MCP tools

export abstract class BaseTool {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly inputSchema: object;
  
  // Abstract execute method that all tools must implement
  public abstract execute(args: any): Promise<any>;
  
  // Validate input against schema (basic implementation)
  protected validateInput(args: any): void {
    if (!args) {
      throw new Error('Arguments are required');
    }
    
    // Basic validation - could be enhanced with JSON schema validator
    const schema = this.inputSchema as any;
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in args)) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
    }
  }
  
  // Log tool execution
  protected logExecution(args: any, startTime: number): void {
    const duration = Date.now() - startTime;
    console.log(`[${this.name}] Executed in ${duration}ms`);
  }
  
  // Handle errors consistently
  protected handleError(error: any): any {
    console.error(`[${this.name}] Error:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      tool: this.name,
      timestamp: new Date().toISOString()
    };
  }
  
  // Wrapper for execute with validation and error handling
  public async safeExecute(args: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.validateInput(args);
      const result = await this.execute(args);
      this.logExecution(args, startTime);
      return result;
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Tool metadata interface
export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  version: string;
  author?: string;
  tags?: string[];
}

// Tool execution context
export interface ToolContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
export interface MCPConfig {
  claude: {
    apiKey?: string;
  };
  jules: {
    endpoint?: string;
  };
  ollama: {
    endpoint: string;
  };
  rag: {
    chromaEndpoint?: string;
  };
  browserHistory: {
    enabled: boolean;
  };
  knowledgeGraph: {
    endpoint?: string;
  };
  aiBridge: {
    enabled: boolean;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

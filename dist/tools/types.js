// Tool interface types
export class Tool {
  constructor() {
    this.name = 'base_tool';
    this.description = 'Base tool interface';
  }
  
  async execute(params) {
    throw new Error('execute method must be implemented');
  }
}

export class BrowserHistoryInterface {
  constructor() {
    this.name = 'browser_history';
  }
  
  async getRecentHistory(count = 50) {
    throw new Error('getRecentHistory method must be implemented');
  }
  
  destroy() {
    // Cleanup resources
  }
}
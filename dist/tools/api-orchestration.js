// API Orchestration Tool
import axios from 'axios';

export class APIOrchestrator {
  constructor() {
    this.name = 'api_orchestrator';
    this.description = 'Orchestrates multiple API calls and manages responses';
    this.endpoints = new Map();
  }

  registerEndpoint(name, config) {
    this.endpoints.set(name, config);
  }

  async callAPI(endpointName, params = {}) {
    const config = this.endpoints.get(endpointName);
    if (!config) {
      throw new Error(`Endpoint ${endpointName} not registered`);
    }

    try {
      const response = await axios({
        ...config,
        params: { ...config.params, ...params }
      });
      return response.data;
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  async orchestrate(calls) {
    const results = {};
    
    for (const [key, { endpoint, params }] of Object.entries(calls)) {
      try {
        results[key] = await this.callAPI(endpoint, params);
      } catch (error) {
        results[key] = { error: error.message };
      }
    }
    
    return results;
  }
}

export default APIOrchestrator;
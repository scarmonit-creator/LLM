import axios from 'axios';

const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';

/**
 * Jules API Client (ESM version)
 * Provides methods to interact with Google Jules API
 * Documentation: https://developers.google.com/jules/api
 */
export class JulesClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.JULES_API_KEY;
    this.baseURL = JULES_API_BASE;

    if (!this.apiKey) {
      console.warn('JULES_API_KEY not set in environment variables');
    }
  }

  /**
   * Get axios instance with auth headers
   */
  getAxiosInstance() {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all available sources
   * @returns {Promise<Object>} List of sources
   */
  async listSources() {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get('/sources');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, 'listSources');
    }
  }

  /**
   * Create a new Jules session
   * @param {Object} params - Session parameters
   * @param {string} params.prompt - The task prompt for Jules
   * @param {string} params.sourceId - Source ID (e.g., GitHub repo)
   * @param {string} params.title - Session title
   * @returns {Promise<Object>} Created session
   */
  async createSession({ prompt, sourceId, title }) {
    if (!prompt) {
      return {
        success: false,
        error: 'Prompt is required',
      };
    }

    try {
      const client = this.getAxiosInstance();
      const payload = {
        prompt,
        title: title || 'LLM Application Session',
      };

      if (sourceId) {
        payload.sourceContext = {
          source: sourceId,
        };
      }

      const response = await client.post('/sessions', payload);
      return {
        success: true,
        data: response.data,
        sessionId: response.data.name,
      };
    } catch (error) {
      return this.handleError(error, 'createSession');
    }
  }

  /**
   * List all sessions
   * @param {Object} params - Query parameters
   * @param {number} params.pageSize - Number of sessions per page
   * @param {string} params.pageToken - Token for pagination
   * @returns {Promise<Object>} List of sessions
   */
  async listSessions({ pageSize = 10, pageToken = null } = {}) {
    try {
      const client = this.getAxiosInstance();
      const params = { pageSize };
      if (pageToken) {
        params.pageToken = pageToken;
      }

      const response = await client.get('/sessions', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, 'listSessions');
    }
  }

  /**
   * Get a specific session
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object>} Session details
   */
  async getSession(sessionId) {
    if (!sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    try {
      const client = this.getAxiosInstance();
      const response = await client.get(`/sessions/${sessionId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, 'getSession');
    }
  }

  /**
   * Approve a plan in a session
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object>} Approval result
   */
  async approvePlan(sessionId) {
    if (!sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    try {
      const client = this.getAxiosInstance();
      const response = await client.post(`/sessions/${sessionId}:approvePlan`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, 'approvePlan');
    }
  }

  /**
   * Send a message in a session
   * @param {string} sessionId - The session ID
   * @param {string} message - The message content
   * @returns {Promise<Object>} Message result
   */
  async sendMessage(sessionId, message) {
    if (!sessionId || !message) {
      return {
        success: false,
        error: 'Session ID and message are required',
      };
    }

    try {
      const client = this.getAxiosInstance();
      const response = await client.post(`/sessions/${sessionId}:sendMessage`, {
        message,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, 'sendMessage');
    }
  }

  /**
   * Handle API errors
   * @private
   */
  handleError(error, operation) {
    const errorResponse = {
      success: false,
      operation,
      error: error.message,
    };

    if (error.response) {
      errorResponse.statusCode = error.response.status;
      errorResponse.details = error.response.data;
    }

    console.error(`Jules API Error [${operation}]:`, errorResponse);
    return errorResponse;
  }
}

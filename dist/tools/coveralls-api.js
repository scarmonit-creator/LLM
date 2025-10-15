// Coveralls API integration tool
import axios from 'axios';

class CoverallsAPI {
  constructor(repoToken) {
    this.repoToken = repoToken;
    this.baseURL = 'https://coveralls.io/api/v1';
  }

  async getCoverage() {
    try {
      const response = await axios.get(`${this.baseURL}/repos/${this.repoToken}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching coverage:', error);
      return null;
    }
  }

  async submitCoverage(coverage) {
    try {
      const response = await axios.post(`${this.baseURL}/jobs`, coverage, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting coverage:', error);
      return null;
    }
  }
}

export default CoverallsAPI;
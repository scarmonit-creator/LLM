// Hallucination Detection Module - Implements SelfCheckGPT and Semantic Entropy
// Addresses Issue #16: Add automated hallucination detection

class HallucinationDetector {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.entropyThreshold = 0.5;
    this.consistencyThreshold = 0.7;
  }

  // SelfCheckGPT: Sample multiple responses and check consistency
  async selfCheckGPT(prompt, numSamples = 5) {
    try {
      const responses = [];

      // Generate multiple responses
      for (let i = 0; i < numSamples; i++) {
        const response = await this.llmClient.generate(prompt, {
          temperature: 0.8,
          max_tokens: 500,
        });
        responses.push(response);
      }

      // Calculate consistency score
      const consistencyScore = this.calculateConsistencyScore(responses);

      return {
        responses,
        consistencyScore,
        isHallucinating: consistencyScore < this.consistencyThreshold,
        method: 'SelfCheckGPT',
      };
    } catch (error) {
      console.error('SelfCheckGPT error:', error);
      throw error;
    }
  }

  // Calculate semantic similarity between responses
  calculateConsistencyScore(responses) {
    if (responses.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateSemanticSimilarity(responses[i], responses[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  // Simple semantic similarity using token overlap (can be enhanced with embeddings)
  calculateSemanticSimilarity(text1, text2) {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // Semantic Entropy: Measure uncertainty in semantic space
  async calculateSemanticEntropy(prompt, responses = null) {
    try {
      if (!responses) {
        responses = await this.selfCheckGPT(prompt);
        responses = responses.responses;
      }

      // Group semantically similar responses
      const clusters = this.clusterResponses(responses);

      // Calculate entropy over clusters
      const probabilities = clusters.map((c) => c.length / responses.length);
      const entropy = this.calculateEntropy(probabilities);

      return {
        entropy,
        clusters: clusters.length,
        isHallucinating: entropy > this.entropyThreshold,
        method: 'SemanticEntropy',
      };
    } catch (error) {
      console.error('Semantic entropy calculation error:', error);
      throw error;
    }
  }

  // Simple clustering based on semantic similarity
  clusterResponses(responses, similarityThreshold = 0.6) {
    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < responses.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = [responses[i]];
      assigned.add(i);

      for (let j = i + 1; j < responses.length; j++) {
        if (assigned.has(j)) continue;

        const similarity = this.calculateSemanticSimilarity(responses[i], responses[j]);

        if (similarity >= similarityThreshold) {
          cluster.push(responses[j]);
          assigned.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  // Calculate Shannon entropy
  calculateEntropy(probabilities) {
    return -probabilities.reduce((sum, p) => {
      return sum + (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
  }

  // Combined detection method
  async detectHallucination(prompt, method = 'both') {
    const results = {};

    if (method === 'selfcheck' || method === 'both') {
      results.selfcheck = await this.selfCheckGPT(prompt);
    }

    if (method === 'entropy' || method === 'both') {
      const responses = results.selfcheck ? results.selfcheck.responses : null;
      results.entropy = await this.calculateSemanticEntropy(prompt, responses);
    }

    // Combine results
    const isHallucinating =
      results.selfcheck?.isHallucinating || false || results.entropy?.isHallucinating || false;

    return {
      ...results,
      finalVerdict: isHallucinating,
      confidence: this.calculateConfidence(results),
    };
  }

  calculateConfidence(results) {
    const scores = [];

    if (results.selfcheck) {
      scores.push(results.selfcheck.consistencyScore);
    }

    if (results.entropy) {
      // Normalize entropy to 0-1 range (inverse)
      scores.push(1 - Math.min(results.entropy.entropy, 1));
    }

    return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
  }
}

module.exports = HallucinationDetector;

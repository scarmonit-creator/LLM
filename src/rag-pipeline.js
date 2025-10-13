/**
 * RAG Pipeline for Hallucination Mitigation
 * Implements Retrieval-Augmented Generation with:
 * - Vector database integration for document indexing
 * - Retrieval layer before generation
 * - Strict citation enforcement
 * - RAGAS-based faithfulness and relevancy metrics
 * - Confidence-based abstention
 *
 * Addresses Issue #15: RAG implementation for hallucination mitigation
 */

const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');
const { encode } = require('gpt-tokenizer');

class RAGPipeline {
  constructor(config = {}) {
    this.config = {
      vectorDBPath: config.vectorDBPath || './chroma_db',
      collectionName: config.collectionName || 'documents',
      embeddingModel: config.embeddingModel || 'text-embedding-ada-002',
      topK: config.topK || 5,
      minConfidence: config.minConfidence || 0.7,
      maxTokens: config.maxTokens || 4000,
      citationRequired: config.citationRequired !== false,
      ...config,
    };

    this.client = null;
    this.collection = null;
    this.embeddingFunction = null;
  }

  /**
   * Initialize the vector database and embedding function
   */
  async initialize() {
    try {
      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: this.config.vectorDBPath,
      });

      // Initialize OpenAI embedding function
      this.embeddingFunction = new OpenAIEmbeddingFunction({
        model: this.config.embeddingModel,
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collectionName,
          embeddingFunction: this.embeddingFunction,
        });
      } catch (error) {
        this.collection = await this.client.createCollection({
          name: this.config.collectionName,
          embeddingFunction: this.embeddingFunction,
          metadata: { description: 'RAG document store' },
        });
      }

      console.log('RAG Pipeline initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize RAG pipeline:', error);
      throw error;
    }
  }

  /**
   * Index documents into the vector database
   * @param {Array} documents - Array of {id, text, metadata} objects
   */
  async indexDocuments(documents) {
    if (!this.collection) {
      throw new Error('RAG pipeline not initialized');
    }

    try {
      const ids = documents.map((doc) => doc.id || `doc_${Date.now()}_${Math.random()}`);
      const texts = documents.map((doc) => doc.text);
      const metadatas = documents.map((doc) => doc.metadata || {});

      await this.collection.add({
        ids,
        documents: texts,
        metadatas,
      });

      console.log(`Indexed ${documents.length} documents`);
      return { success: true, count: documents.length };
    } catch (error) {
      console.error('Failed to index documents:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant documents for a query
   * @param {string} query - User query
   * @param {number} topK - Number of results to return
   * @returns {Object} Retrieved documents with scores
   */
  async retrieve(query, topK = null) {
    if (!this.collection) {
      throw new Error('RAG pipeline not initialized');
    }

    try {
      const k = topK || this.config.topK;
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: k,
      });

      // Format results
      const documents = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          documents.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            metadata: results.metadatas[0][i],
            distance: results.distances[0][i],
            relevanceScore: 1 - (results.distances[0][i] || 0),
          });
        }
      }

      return {
        query,
        documents,
        count: documents.length,
      };
    } catch (error) {
      console.error('Failed to retrieve documents:', error);
      throw error;
    }
  }

  /**
   * Build augmented prompt with retrieved context
   * @param {string} query - User query
   * @param {Array} documents - Retrieved documents
   * @returns {string} Augmented prompt with citations
   */
  buildAugmentedPrompt(query, documents) {
    let context = '';

    if (documents && documents.length > 0) {
      context = '\n\nRelevant Context (cite these sources in your response):\n';
      documents.forEach((doc, idx) => {
        const citation = `[${idx + 1}]`;
        context += `\n${citation} ${doc.text}`;
        if (doc.metadata && doc.metadata.source) {
          context += ` (Source: ${doc.metadata.source})`;
        }
      });
      context += '\n';
    }

    const prompt = `${context}\n\nUser Query: ${query}\n\nInstructions:
- Answer ONLY using information from the provided context
- Cite sources using [1], [2], etc. for each claim
- If the context does not contain sufficient information, respond with "I don't have enough information to answer this question confidently."
- Do NOT generate information beyond what is explicitly stated in the context
- Format your answer clearly with citations inline
\nAnswer:`;

    return prompt;
  }

  /**
   * Calculate faithfulness score (RAGAS metric)
   * Measures if the answer is grounded in retrieved context
   * @param {string} answer - Generated answer
   * @param {Array} documents - Retrieved documents
   * @returns {number} Faithfulness score (0-1)
   */
  calculateFaithfulness(answer, documents) {
    if (!answer || !documents || documents.length === 0) {
      return 0;
    }

    // Extract claims from answer (simplified: split by sentences)
    const claims = answer.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (claims.length === 0) return 0;

    // Count how many claims have citation markers
    const citedClaims = claims.filter((claim) => /\[\d+\]/.test(claim));

    // Check if claims can be verified in context
    const contextText = documents
      .map((d) => d.text)
      .join(' ')
      .toLowerCase();
    let supportedClaims = 0;

    claims.forEach((claim) => {
      const cleanClaim = claim
        .toLowerCase()
        .replace(/\[\d+\]/g, '')
        .trim();
      // Simple keyword overlap check (in production, use semantic similarity)
      const keywords = cleanClaim.split(/\s+/).filter((w) => w.length > 4);
      const matchedKeywords = keywords.filter((kw) => contextText.includes(kw));

      if (matchedKeywords.length >= keywords.length * 0.5) {
        supportedClaims++;
      }
    });

    const faithfulnessScore = supportedClaims / claims.length;
    return faithfulnessScore;
  }

  /**
   * Calculate relevancy score (RAGAS metric)
   * Measures if the answer addresses the query
   * @param {string} query - User query
   * @param {string} answer - Generated answer
   * @returns {number} Relevancy score (0-1)
   */
  calculateRelevancy(query, answer) {
    if (!query || !answer) return 0;

    const queryTokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const answerTokens = answer.toLowerCase().split(/\s+/);

    let matchedTokens = 0;
    queryTokens.forEach((qt) => {
      if (answerTokens.some((at) => at.includes(qt) || qt.includes(at))) {
        matchedTokens++;
      }
    });

    const relevancyScore = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;
    return relevancyScore;
  }

  /**
   * Calculate semantic entropy (confidence measure)
   * @param {Array} samples - Multiple generated samples for the same query
   * @returns {number} Entropy score (higher = more uncertain)
   */
  calculateSemanticEntropy(samples) {
    if (!samples || samples.length < 2) return 0;

    // Count unique semantic clusters (simplified: exact match)
    const uniqueAnswers = new Set(samples.map((s) => s.trim().toLowerCase()));
    const probabilities = [];

    uniqueAnswers.forEach((answer) => {
      const count = samples.filter((s) => s.trim().toLowerCase() === answer).length;
      probabilities.push(count / samples.length);
    });

    // Calculate Shannon entropy
    const entropy = probabilities.reduce((sum, p) => {
      return sum - p * Math.log2(p);
    }, 0);

    return entropy;
  }

  /**
   * Main RAG pipeline: retrieve, augment, and evaluate
   * @param {string} query - User query
   * @param {Function} generateFn - LLM generation function
   * @param {Object} options - Pipeline options
   * @returns {Object} Response with answer, metrics, and confidence
   */
  async process(query, generateFn, options = {}) {
    if (!this.collection) {
      throw new Error('RAG pipeline not initialized');
    }

    try {
      // 1. Retrieve relevant documents
      const retrieval = await this.retrieve(query, options.topK);

      // 2. Build augmented prompt
      const augmentedPrompt = this.buildAugmentedPrompt(query, retrieval.documents);

      // 3. Generate response(s)
      const numSamples = options.numSamples || 1;
      const samples = [];

      for (let i = 0; i < numSamples; i++) {
        const response = await generateFn(augmentedPrompt, {
          temperature: options.temperature || 0.7,
          maxTokens: options.maxTokens || 500,
        });
        samples.push(response);
      }

      const answer = samples[0];

      // 4. Calculate metrics
      const faithfulness = this.calculateFaithfulness(answer, retrieval.documents);
      const relevancy = this.calculateRelevancy(query, answer);
      const semanticEntropy = numSamples > 1 ? this.calculateSemanticEntropy(samples) : 0;

      // 5. Determine confidence and abstention
      const confidence = (faithfulness + relevancy) / 2;
      const shouldAbstain =
        confidence < this.config.minConfidence || (numSamples > 1 && semanticEntropy > 1.5);

      // 6. Return result
      return {
        query,
        answer: shouldAbstain
          ? "I don't have enough information to answer this question confidently. The available context may be insufficient or unclear."
          : answer,
        retrievedDocuments: retrieval.documents,
        metrics: {
          faithfulness: faithfulness.toFixed(3),
          relevancy: relevancy.toFixed(3),
          semanticEntropy: semanticEntropy.toFixed(3),
          confidence: confidence.toFixed(3),
        },
        abstained: shouldAbstain,
        metadata: {
          numRetrieved: retrieval.count,
          numSamples,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('RAG pipeline processing error:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // ChromaDB cleanup if needed
    console.log('RAG Pipeline cleaned up');
  }
}

module.exports = { RAGPipeline };

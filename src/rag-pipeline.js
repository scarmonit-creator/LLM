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
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { encode } from 'gpt-tokenizer';

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
      this.client = new ChromaClient({ path: this.config.vectorDBPath });

      this.embeddingFunction = new OpenAIEmbeddingFunction({
        model: this.config.embeddingModel,
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        embeddingFunction: this.embeddingFunction,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Index documents into the vector database
   * @param {Array} documents - Array of {id, text, metadata} objects
   */
  async indexDocuments(documents) {
    if (!this.collection) {
      throw new Error('Pipeline not initialized. Call initialize() first.');
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

      return { success: true, indexed: documents.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve relevant documents for a query
   * @param {string} query - The search query
   * @param {number} topK - Number of results to return
   */
  async retrieve(query, topK = null) {
    if (!this.collection) {
      throw new Error('Pipeline not initialized. Call initialize() first.');
    }

    const k = topK || this.config.topK;

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: k,
      });

      // Format results with metadata
      const documents = results.documents[0] || [];
      const metadatas = results.metadatas[0] || [];
      const distances = results.distances[0] || [];

      return documents.map((doc, idx) => ({
        text: doc,
        metadata: metadatas[idx],
        score: 1 - distances[idx], // Convert distance to similarity
        citation: metadatas[idx]?.source || `Document ${idx + 1}`,
      }));
    } catch (error) {
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  /**
   * Generate a response with RAG
   * @param {string} query - User query
   * @param {Function} llmFunction - Function that takes (prompt, context) and returns response
   */
  async generate(query, llmFunction) {
    if (!this.collection) {
      throw new Error('Pipeline not initialized. Call initialize() first.');
    }

    try {
      // Retrieve relevant documents
      const retrievedDocs = await this.retrieve(query);

      // Check if sufficient evidence exists
      const maxScore = Math.max(...retrievedDocs.map((d) => d.score));
      if (maxScore < this.config.minConfidence) {
        return {
          response: "I don't have sufficient information to answer this question with confidence.",
          abstained: true,
          confidence: maxScore,
          citations: [],
        };
      }

      // Build context from retrieved documents
      const context = retrievedDocs
        .map((doc, idx) => `[${idx + 1}] ${doc.text}\nSource: ${doc.citation}`)
        .join('\n\n');

      // Create prompt with strict citation requirement
      const prompt = this.config.citationRequired
        ? `Answer the following question using ONLY the provided context. You MUST cite sources using [number] notation.\n\nContext:\n${context}\n\nQuestion: ${query}\n\nAnswer (with citations):`
        : `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`;

      // Check token limit
      const tokens = encode(prompt);
      if (tokens.length > this.config.maxTokens) {
        // Trim context to fit
        const availableTokens =
          this.config.maxTokens - encode(`Question: ${query}\n\nAnswer:`).length;
        const trimmedDocs = this._trimContext(retrievedDocs, availableTokens);
        const trimmedContext = trimmedDocs
          .map((doc, idx) => `[${idx + 1}] ${doc.text}\nSource: ${doc.citation}`)
          .join('\n\n');
        const trimmedPrompt = `Answer the following question using ONLY the provided context. You MUST cite sources using [number] notation.\n\nContext:\n${trimmedContext}\n\nQuestion: ${query}\n\nAnswer (with citations):`;

        const response = await llmFunction(trimmedPrompt, trimmedContext);

        return {
          response,
          abstained: false,
          confidence: maxScore,
          citations: trimmedDocs.map((d) => d.citation),
          retrievedDocs: trimmedDocs,
        };
      }

      // Generate response
      const response = await llmFunction(prompt, context);

      return {
        response,
        abstained: false,
        confidence: maxScore,
        citations: retrievedDocs.map((d) => d.citation),
        retrievedDocs,
      };
    } catch (error) {
      throw new Error(`Generation failed: ${error.message}`);
    }
  }

  /**
   * Trim context to fit token limit
   */
  _trimContext(docs, maxTokens) {
    const trimmed = [];
    let currentTokens = 0;

    for (const doc of docs) {
      const docTokens = encode(doc.text).length;
      if (currentTokens + docTokens <= maxTokens) {
        trimmed.push(doc);
        currentTokens += docTokens;
      } else {
        break;
      }
    }

    return trimmed;
  }

  /**
   * Evaluate faithfulness and relevancy (simplified RAGAS metrics)
   * @param {string} query - Original query
   * @param {string} response - Generated response
   * @param {Array} retrievedDocs - Retrieved documents
   */
  async evaluate(query, response, retrievedDocs) {
    try {
      // Faithfulness: Check if response is grounded in retrieved docs
      const faithfulness = this._calculateFaithfulness(response, retrievedDocs);

      // Relevancy: Check if retrieved docs are relevant to query
      const relevancy = this._calculateRelevancy(query, retrievedDocs);

      return {
        faithfulness,
        relevancy,
        overall: (faithfulness + relevancy) / 2,
      };
    } catch (error) {
      throw new Error(`Evaluation failed: ${error.message}`);
    }
  }

  /**
   * Calculate faithfulness score (simplified)
   */
  _calculateFaithfulness(response, retrievedDocs) {
    // Simple keyword overlap check
    const responseWords = new Set(response.toLowerCase().split(/\W+/));
    const docWords = new Set(retrievedDocs.flatMap((d) => d.text.toLowerCase().split(/\W+/)));

    const overlap = [...responseWords].filter((w) => docWords.has(w)).length;
    return Math.min(overlap / responseWords.size, 1.0);
  }

  /**
   * Calculate relevancy score (simplified)
   */
  _calculateRelevancy(query, retrievedDocs) {
    // Use average retrieval score as relevancy proxy
    const avgScore = retrievedDocs.reduce((sum, doc) => sum + doc.score, 0) / retrievedDocs.length;
    return avgScore;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.collection = null;
    this.client = null;
    this.embeddingFunction = null;
  }
}

export default RAGPipeline;
export { RAGPipeline };

/**
 * RAG Integration Module
 * Demonstrates how to integrate the RAG pipeline with existing LLM systems
 * Part of Issue #15 implementation
 */
import RAGPipeline from './rag-pipeline.js';

/**
 * Example integration with Claude client
 */
class RAGEnabledLLM {
  constructor(llmClient, ragConfig = {}) {
    this.llmClient = llmClient;
    this.ragPipeline = new RAGPipeline(ragConfig);
    this.initialized = false;
  }

  async initialize() {
    await this.ragPipeline.initialize();
    this.initialized = true;
    console.log('RAG-enabled LLM initialized');
  }

  /**
   * Add documents to the knowledge base
   */
  async addKnowledge(documents) {
    if (!this.initialized) {
      throw new Error('RAG pipeline not initialized. Call initialize() first.');
    }
    return await this.ragPipeline.indexDocuments(documents);
  }

  /**
   * Generate response with RAG
   * @param {string} query - User query
   * @param {object} options - Additional options for LLM
   */
  async generateWithRAG(query, options = {}) {
    if (!this.initialized) {
      throw new Error('RAG pipeline not initialized. Call initialize() first.');
    }

    // Define LLM function wrapper
    const llmFunction = async (prompt, context) => {
      // Call the underlying LLM client
      const response = await this.llmClient.sendMessage(prompt, {
        ...options,
        context,
      });
      return response.content || response;
    };

    // Use RAG pipeline to generate response
    const result = await this.ragPipeline.generate(query, llmFunction);

    return result;
  }

  /**
   * Standard query without RAG (direct LLM call)
   */
  async generateWithoutRAG(query, options = {}) {
    const response = await this.llmClient.sendMessage(query, options);
    return response.content || response;
  }

  /**
   * Evaluate the quality of a RAG response
   */
  async evaluateResponse(query, response, retrievedDocs) {
    return await this.ragPipeline.evaluate(query, response, retrievedDocs);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.ragPipeline.cleanup();
    this.initialized = false;
  }
}

/**
 * Helper function to create a RAG-enabled LLM with default config
 */
export function createRAGEnabledLLM(llmClient, config = {}) {
  return new RAGEnabledLLM(llmClient, config);
}

/**
 * Helper function to initialize and add documents in one step
 */
export async function setupRAGWithDocs(llmClient, documents, config = {}) {
  const ragLLM = new RAGEnabledLLM(llmClient, config);
  await ragLLM.initialize();
  await ragLLM.addKnowledge(documents);
  return ragLLM;
}

export default RAGEnabledLLM;
export { RAGEnabledLLM };

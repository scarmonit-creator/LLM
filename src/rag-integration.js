/**
 * RAG Integration Module
 * Demonstrates how to integrate the RAG pipeline with existing LLM systems
 * Part of Issue #15 implementation
 */

const { RAGPipeline } = require('./rag-pipeline');

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
   */
  async generate(query, options = {}) {
    if (!this.initialized) {
      throw new Error('RAG pipeline not initialized. Call initialize() first.');
    }

    // Create generation function wrapper for the LLM client
    const generateFn = async (prompt, genOptions) => {
      if (this.llmClient.sendMessage) {
        // Compatible with claude-client.js
        const response = await this.llmClient.sendMessage(prompt, {
          temperature: genOptions.temperature,
          max_tokens: genOptions.maxTokens
        });
        return response.content || response;
      } else if (this.llmClient.chat) {
        // Compatible with OpenAI-style clients
        const response = await this.llmClient.chat.completions.create({
          model: options.model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: genOptions.temperature,
          max_tokens: genOptions.maxTokens
        });
        return response.choices[0].message.content;
      } else {
        throw new Error('Unsupported LLM client interface');
      }
    };

    // Process query through RAG pipeline
    return await this.ragPipeline.process(query, generateFn, options);
  }

  async cleanup() {
    await this.ragPipeline.cleanup();
  }
}

/**
 * Usage Example 1: With Claude client
 */
async function exampleClaudeIntegration() {
  const claudeClient = require('./claude-client');
  
  // Initialize RAG-enabled LLM
  const ragLLM = new RAGEnabledLLM(claudeClient, {
    vectorDBPath: './data/chroma_db',
    collectionName: 'knowledge_base',
    topK: 5,
    minConfidence: 0.7
  });
  
  await ragLLM.initialize();
  
  // Add knowledge documents
  const documents = [
    {
      id: 'doc1',
      text: 'Retrieval-Augmented Generation (RAG) combines retrieval with generation to reduce hallucinations.',
      metadata: { source: 'RAG Paper', date: '2020' }
    },
    {
      id: 'doc2',
      text: 'Semantic entropy measures uncertainty by analyzing diversity in generated responses.',
      metadata: { source: 'Semantic Entropy Paper', date: '2023' }
    },
    {
      id: 'doc3',
      text: 'RAGAS framework provides faithfulness and relevancy metrics for RAG evaluation.',
      metadata: { source: 'RAGAS Documentation', date: '2024' }
    }
  ];
  
  await ragLLM.addKnowledge(documents);
  
  // Generate with RAG
  const result = await ragLLM.generate(
    'What is RAG and how does it reduce hallucinations?',
    {
      topK: 3,
      numSamples: 3, // Generate multiple samples for semantic entropy
      temperature: 0.7
    }
  );
  
  console.log('Query:', result.query);
  console.log('Answer:', result.answer);
  console.log('Metrics:', result.metrics);
  console.log('Abstained:', result.abstained);
  console.log('Retrieved Documents:', result.retrievedDocuments.length);
  
  await ragLLM.cleanup();
}

/**
 * Usage Example 2: Batch processing with confidence filtering
 */
async function exampleBatchProcessing(ragLLM, queries) {
  const results = [];
  const lowConfidenceQueries = [];
  
  for (const query of queries) {
    const result = await ragLLM.generate(query, {
      topK: 5,
      numSamples: 3,
      temperature: 0.7
    });
    
    results.push(result);
    
    // Flag low-confidence responses for human review
    if (result.abstained || parseFloat(result.metrics.confidence) < 0.75) {
      lowConfidenceQueries.push({
        query,
        result,
        reason: result.abstained ? 'abstained' : 'low_confidence'
      });
    }
  }
  
  return { results, lowConfidenceQueries };
}

/**
 * Usage Example 3: Progressive knowledge base building
 */
async function exampleProgressiveKnowledge(ragLLM) {
  // Start with initial documents
  const initialDocs = [
    { id: 'base1', text: 'LLMs can generate plausible but false information, known as hallucinations.' },
    { id: 'base2', text: 'Vector databases enable semantic search over document collections.' }
  ];
  
  await ragLLM.addKnowledge(initialDocs);
  
  // Add more documents as they become available
  const additionalDocs = [
    { id: 'ext1', text: 'ChromaDB is an open-source embedding database for AI applications.' },
    { id: 'ext2', text: 'Faithfulness measures if generated claims are supported by retrieved context.' }
  ];
  
  await ragLLM.addKnowledge(additionalDocs);
  
  console.log('Knowledge base expanded progressively');
}

/**
 * Configuration for different use cases
 */
const RAGConfigs = {
  // High precision: Strict citation, high confidence threshold
  highPrecision: {
    topK: 3,
    minConfidence: 0.85,
    citationRequired: true,
    numSamples: 5
  },
  
  // Balanced: Good for general Q&A
  balanced: {
    topK: 5,
    minConfidence: 0.7,
    citationRequired: true,
    numSamples: 3
  },
  
  // High recall: For exploratory queries
  highRecall: {
    topK: 10,
    minConfidence: 0.6,
    citationRequired: false,
    numSamples: 1
  }
};

/**
 * Monitoring and logging helper
 */
class RAGMonitor {
  constructor() {
    this.metrics = [];
  }
  
  logQuery(result) {
    this.metrics.push({
      timestamp: result.metadata.timestamp,
      query: result.query,
      faithfulness: parseFloat(result.metrics.faithfulness),
      relevancy: parseFloat(result.metrics.relevancy),
      confidence: parseFloat(result.metrics.confidence),
      abstained: result.abstained,
      numRetrieved: result.metadata.numRetrieved
    });
  }
  
  getStats() {
    if (this.metrics.length === 0) return null;
    
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => sum(arr) / arr.length;
    
    return {
      totalQueries: this.metrics.length,
      avgFaithfulness: avg(this.metrics.map(m => m.faithfulness)),
      avgRelevancy: avg(this.metrics.map(m => m.relevancy)),
      avgConfidence: avg(this.metrics.map(m => m.confidence)),
      abstentionRate: this.metrics.filter(m => m.abstained).length / this.metrics.length,
      avgDocsRetrieved: avg(this.metrics.map(m => m.numRetrieved))
    };
  }
}

module.exports = {
  RAGEnabledLLM,
  RAGConfigs,
  RAGMonitor,
  exampleClaudeIntegration,
  exampleBatchProcessing,
  exampleProgressiveKnowledge
};

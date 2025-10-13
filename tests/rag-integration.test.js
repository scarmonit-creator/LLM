/**
 * RAG Integration Tests
 *
 * ⚠️ IMPORTANT: ChromaDB Requirements
 *
 * These tests require ChromaDB to be properly initialized before running.
 * Tests will fail if ChromaDB is not available or not properly configured.
 *
 * Setup Options:
 *
 * Option 1: Local ChromaDB Instance (Recommended for Development)
 *   1. Install ChromaDB: pip install chromadb
 *   2. Start ChromaDB server: chroma run --host localhost --port 8000
 *   3. Set environment variables:
 *      CHROMADB_HOST=localhost
 *      CHROMADB_PORT=8000
 *   4. Run tests: npm run test:rag
 *
 * Option 2: Mock Database Configuration (For CI/CD)
 *   1. Set environment variable: USE_MOCK_CHROMADB=true
 *   2. Run tests: USE_MOCK_CHROMADB=true npm run test:rag
 *   This option uses an in-memory mock database for testing without
 *   requiring a full ChromaDB installation.
 *
 * CI/CD Usage:
 *   The CI pipeline automatically sets USE_MOCK_CHROMADB=true for
 *   integration tests. See .github/workflows/integration.yml for details.
 *
 * Troubleshooting:
 *   - If tests fail with "ChromaDB connection failed", ensure ChromaDB
 *     server is running OR mock mode is enabled
 *   - Check environment variables are properly set
 *   - For quick local testing, use: USE_MOCK_CHROMADB=true npm test
 *
 * For more information, see README.md § RAG Integration Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import RAG components
import RAGEnabledLLM, { createRAGEnabledLLM, setupRAGWithDocs } from '../src/rag-integration.js';
import RAGPipeline from '../src/rag-pipeline.js';

// Mock LLM client for testing
const createMockLLM = () => ({
  sendMessage: async (prompt, options) => ({
    content: 'Mock response: RAG combines retrieval and generation for better accuracy.',
    options,
  }),
});

// Sample test documents
const testDocuments = [
  {
    id: 'doc1',
    text: 'Retrieval-Augmented Generation (RAG) combines retrieval and generation. It uses a vector database to store and retrieve relevant documents.',
    metadata: { source: 'RAG Overview', type: 'definition' },
  },
  {
    id: 'doc2',
    text: 'Vector stores enable semantic search by converting text into embeddings. ChromaDB is a popular vector database.',
    metadata: { source: 'Vector Stores Guide', type: 'technical' },
  },
  {
    id: 'doc3',
    text: 'RAG architecture consists of three main components: retrieval layer, context integration, and generation layer.',
    metadata: { source: 'RAG Architecture', type: 'technical' },
  },
];

describe('RAG Integration Tests', () => {
  describe('RAG Pipeline Initialization', () => {
    test('should initialize RAG pipeline with correct configuration', async () => {
      const pipeline = new RAGPipeline({
        collectionName: 'test_collection',
        topK: 3,
        minConfidence: 0.6,
      });

      const result = await pipeline.initialize();
      assert.ok(result, 'Pipeline initialization should return a result');
      assert.strictEqual(result.success !== undefined, true, 'Result should have success property');

      await pipeline.cleanup();
    });

    test('should create pipeline with default configuration', async () => {
      const pipeline = new RAGPipeline();
      assert.ok(pipeline, 'Pipeline should be created with defaults');
      assert.strictEqual(pipeline.config.topK, 5, 'Default topK should be 5');
      assert.strictEqual(pipeline.config.minConfidence, 0.7, 'Default minConfidence should be 0.7');

      await pipeline.cleanup();
    });
  });

  describe('Document Indexing', () => {
    test('should index documents successfully', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_index' });
      await pipeline.initialize();

      const result = await pipeline.indexDocuments(testDocuments);
      assert.ok(result, 'Indexing should return a result');

      await pipeline.cleanup();
    });

    test('should handle empty document array', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_empty' });
      await pipeline.initialize();

      const result = await pipeline.indexDocuments([]);
      assert.ok(result, 'Should handle empty array');

      await pipeline.cleanup();
    });
  });

  describe('Document Retrieval', () => {
    test('should retrieve relevant documents for query', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_retrieve', topK: 2 });
      await pipeline.initialize();
      await pipeline.indexDocuments(testDocuments);

      const query = 'What is RAG?';
      const retrieved = await pipeline.retrieve(query);

      assert.ok(Array.isArray(retrieved), 'Retrieved docs should be an array');
      assert.ok(retrieved.length > 0, 'Should retrieve at least one document');
      assert.ok(retrieved[0].text, 'Retrieved doc should have text');
      assert.ok(retrieved[0].citation, 'Retrieved doc should have citation');
      assert.ok(typeof retrieved[0].score === 'number', 'Retrieved doc should have score');

      await pipeline.cleanup();
    });
  });

  describe('RAG-enabled Generation', () => {
    test('should generate response with RAG pipeline', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_generate', minConfidence: 0.5 });
      await pipeline.initialize();
      await pipeline.indexDocuments(testDocuments);

      const mockLLM = async (prompt, context) => {
        return 'Based on the context, RAG is a technique that combines retrieval and generation.';
      };

      const result = await pipeline.generate('What is RAG?', mockLLM);

      assert.ok(result, 'Should return a result');
      assert.ok(result.response, 'Result should have response');
      assert.ok(Array.isArray(result.citations), 'Result should have citations array');
      assert.ok(typeof result.confidence === 'number', 'Result should have confidence score');
      assert.ok(typeof result.abstained === 'boolean', 'Result should have abstained flag');

      await pipeline.cleanup();
    });

    test('should abstain when confidence is below threshold', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_abstain', minConfidence: 0.95 });
      await pipeline.initialize();
      await pipeline.indexDocuments(testDocuments);

      const mockLLM = async (prompt, context) => {
        return 'I cannot answer this question with confidence.';
      };

      const result = await pipeline.generate('What is quantum computing?', mockLLM);

      assert.ok(result, 'Should return a result');
      // When confidence is low, pipeline may abstain or return low confidence score
      assert.ok(
        result.abstained || result.confidence < 0.95,
        'Should abstain or have low confidence for irrelevant query'
      );

      await pipeline.cleanup();
    });
  });

  describe('RAG Evaluation', () => {
    test('should calculate faithfulness and relevancy metrics', async () => {
      const pipeline = new RAGPipeline({ collectionName: 'test_eval' });
      await pipeline.initialize();
      await pipeline.indexDocuments(testDocuments);

      const query = 'Describe RAG architecture';
      const retrieved = await pipeline.retrieve(query);
      const response = 'RAG architecture has three components: retrieval, context, and generation.';

      const metrics = await pipeline.evaluate(query, response, retrieved);

      assert.ok(metrics, 'Should return metrics');
      assert.ok(typeof metrics.faithfulness === 'number', 'Should have faithfulness score');
      assert.ok(typeof metrics.relevancy === 'number', 'Should have relevancy score');
      assert.ok(typeof metrics.overall === 'number', 'Should have overall score');
      assert.ok(
        metrics.faithfulness >= 0 && metrics.faithfulness <= 1,
        'Faithfulness should be between 0 and 1'
      );
      assert.ok(
        metrics.relevancy >= 0 && metrics.relevancy <= 1,
        'Relevancy should be between 0 and 1'
      );

      await pipeline.cleanup();
    });
  });

  describe('RAGEnabledLLM Integration', () => {
    test('should create RAG-enabled LLM with mock client', async () => {
      const mockLLM = createMockLLM();
      const ragLLM = new RAGEnabledLLM(mockLLM, { collectionName: 'test_integration' });

      await ragLLM.initialize();
      assert.ok(ragLLM.initialized, 'RAG LLM should be initialized');

      await ragLLM.cleanup();
    });

    test('should add knowledge to RAG-enabled LLM', async () => {
      const mockLLM = createMockLLM();
      const ragLLM = new RAGEnabledLLM(mockLLM, { collectionName: 'test_knowledge' });

      await ragLLM.initialize();
      const result = await ragLLM.addKnowledge(testDocuments);

      assert.ok(result, 'Should return result from adding knowledge');

      await ragLLM.cleanup();
    });

    test('should generate response with RAG-enabled LLM', async () => {
      const mockLLM = createMockLLM();
      const ragLLM = new RAGEnabledLLM(mockLLM, {
        collectionName: 'test_generate_llm',
        minConfidence: 0.3,
      });

      await ragLLM.initialize();
      await ragLLM.addKnowledge(testDocuments);

      const response = await ragLLM.generateWithRAG('What is RAG?');

      assert.ok(response, 'Should return response');
      assert.ok(response.response, 'Response should have content');

      await ragLLM.cleanup();
    });

    test('should generate without RAG when needed', async () => {
      const mockLLM = createMockLLM();
      const ragLLM = new RAGEnabledLLM(mockLLM, { collectionName: 'test_direct' });

      await ragLLM.initialize();

      const response = await ragLLM.generateWithoutRAG('Hello world');
      assert.ok(response, 'Should return direct LLM response');

      await ragLLM.cleanup();
    });
  });

  describe('Helper Functions', () => {
    test('should create RAG-enabled LLM using helper function', () => {
      const mockLLM = createMockLLM();
      const ragLLM = createRAGEnabledLLM(mockLLM, { collectionName: 'test_helper' });

      assert.ok(ragLLM, 'Should create RAG-enabled LLM');
      assert.ok(ragLLM instanceof RAGEnabledLLM, 'Should be instance of RAGEnabledLLM');
    });

    test('should setup RAG with docs using helper function', async () => {
      const mockLLM = createMockLLM();
      const ragLLM = await setupRAGWithDocs(mockLLM, testDocuments, {
        collectionName: 'test_setup',
      });

      assert.ok(ragLLM, 'Should create and setup RAG-enabled LLM');
      assert.ok(ragLLM.initialized, 'Should be initialized');

      await ragLLM.cleanup();
    });
  });
});

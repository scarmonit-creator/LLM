/**
 * RAG Integration Tests
 *
 * ⚠️ IMPORTANT: Vector Store Configuration
 *
 * These tests support both ChromaDB and in-memory vector stores.
 * The vector store is automatically selected based on the environment.
 *
 * Vector Store Options:
 *
 * Option 1: In-Memory Store (Default for CI/CD)
 *   - Automatically used when LLM_VECTOR_STORE=memory is set
 *   - No external dependencies required
 *   - Fast and reliable for testing
 *   - Set in CI: LLM_VECTOR_STORE=memory npm run test
 *
 * Option 2: ChromaDB (Recommended for Development)
 *   - Requires ChromaDB to be installed and running
 *   - Install ChromaDB: pip install chromadb
 *   - Start ChromaDB server: chroma run --host localhost --port 8000
 *   - Set environment variables:
 *     CHROMADB_HOST=localhost
 *     CHROMADB_PORT=8000
 *   - Or simply leave LLM_VECTOR_STORE unset to auto-detect
 *
 * Option 3: Automatic Fallback
 *   - If LLM_VECTOR_STORE is not set, the pipeline will attempt to use ChromaDB
 *   - If ChromaDB is unavailable, it automatically falls back to in-memory store
 *   - This provides the best developer experience
 *
 * CI/CD Usage:
 *   The CI pipeline automatically sets LLM_VECTOR_STORE=memory to ensure
 *   tests run without external dependencies. See .github/workflows/node.js.yml
 *
 * Troubleshooting:
 *   - Tests should never fail due to missing ChromaDB in CI
 *   - For local development, install ChromaDB for better performance
 *   - Use LLM_VECTOR_STORE=memory for quick local testing without ChromaDB
 *
 * For more information, see README.md § RAG Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RAGPipeline from '../src/rag-pipeline.js';
import { InMemoryVectorStore } from '../src/vector-store.js';

describe('RAG Pipeline Integration Tests', () => {
  let pipeline;
  let vectorStore;

  beforeEach(async () => {
    // Always use in-memory store for tests to ensure reliability
    vectorStore = new InMemoryVectorStore();
    pipeline = new RAGPipeline({
      collectionName: 'test_documents',
      topK: 3,
      minConfidence: 0.5,
    });
    await pipeline.initialize(vectorStore);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.cleanup();
    }
  });

  describe('Document Indexing', () => {
    it('should index documents successfully', async () => {
      const documents = [
        'The sky is blue.',
        'Grass is green.',
        'The sun is yellow.',
      ];

      const result = await pipeline.indexDocuments(documents);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    it('should index documents with metadata', async () => {
      const documents = [
        {
          content: 'Paris is the capital of France.',
          metadata: { category: 'geography', verified: true },
        },
        {
          content: 'London is the capital of England.',
          metadata: { category: 'geography', verified: true },
        },
      ];

      const result = await pipeline.indexDocuments(documents);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should fail when pipeline not initialized', async () => {
      const uninitializedPipeline = new RAGPipeline();

      await expect(
        uninitializedPipeline.indexDocuments(['test'])
      ).rejects.toThrow('Pipeline not initialized');
    });
  });

  describe('Document Retrieval', () => {
    beforeEach(async () => {
      // Index some test documents
      await pipeline.indexDocuments([
        'Machine learning is a subset of artificial intelligence.',
        'Deep learning uses neural networks with multiple layers.',
        'Natural language processing helps computers understand human language.',
      ]);
    });

    it('should retrieve relevant documents', async () => {
      const results = await pipeline.retrieve('What is machine learning?');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should respect topK parameter', async () => {
      const results = await pipeline.retrieve('neural networks', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return documents with scores', async () => {
      const results = await pipeline.retrieve('artificial intelligence');

      results.forEach((doc) => {
        expect(doc).toHaveProperty('content');
        expect(doc).toHaveProperty('score');
        expect(doc).toHaveProperty('metadata');
        expect(typeof doc.score).toBe('number');
        expect(doc.score).toBeGreaterThanOrEqual(0);
        expect(doc.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('RAG Generation', () => {
    beforeEach(async () => {
      await pipeline.indexDocuments([
        'The Earth orbits around the Sun.',
        'Mars is the fourth planet from the Sun.',
        'Jupiter is the largest planet in our solar system.',
      ]);
    });

    it('should generate response with sources', async () => {
      const result = await pipeline.generate('Tell me about planets');

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('abstained');
      expect(Array.isArray(result.sources)).toBe(true);
    });

    it('should abstain when confidence is too low', async () => {
      // Create pipeline with very high confidence threshold
      const strictPipeline = new RAGPipeline({
        collectionName: 'strict_test',
        minConfidence: 0.95,
        citationRequired: true,
      });
      await strictPipeline.initialize(vectorStore);
      await strictPipeline.indexDocuments(['Unrelated content about weather.']);

      const result = await strictPipeline.generate('quantum physics');

      expect(result.abstained).toBe(true);
      expect(result.confidence).toBeLessThan(0.95);

      await strictPipeline.cleanup();
    });

    it('should include confidence scores', async () => {
      const result = await pipeline.generate('What is Jupiter?');

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle retrieval on uninitialized pipeline', async () => {
      const uninitializedPipeline = new RAGPipeline();

      await expect(uninitializedPipeline.retrieve('test')).rejects.toThrow(
        'Pipeline not initialized'
      );
    });

    it('should handle generation on uninitialized pipeline', async () => {
      const uninitializedPipeline = new RAGPipeline();

      await expect(uninitializedPipeline.generate('test')).rejects.toThrow(
        'Pipeline not initialized'
      );
    });
  });
});

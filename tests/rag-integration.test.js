import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';

// Import RAG components
import * as ragIntegration from '../src/rag-integration.js';
import * as ragPipeline from '../src/rag-pipeline.js';

describe('RAG Integration Tests', () => {
  describe('RAG Pipeline Initialization', () => {
    test('should initialize RAG pipeline with correct configuration', async () => {
      const pipeline = await ragPipeline.initialize();
      assert.ok(pipeline, 'Pipeline should be initialized');
      assert.ok(pipeline.retriever, 'Pipeline should have retriever');
      assert.ok(pipeline.generator, 'Pipeline should have generator');
    });

    test('should load vector store successfully', async () => {
      const pipeline = await ragPipeline.initialize();
      const vectorStore = pipeline.getVectorStore();
      assert.ok(vectorStore, 'Vector store should be loaded');
    });
  });

  describe('Hallucination Mitigation', () => {
    test('should retrieve relevant context for query', async () => {
      const query = 'What is retrieval-augmented generation?';
      const context = await ragIntegration.retrieveContext(query);
      assert.ok(context, 'Context should be retrieved');
      assert.ok(Array.isArray(context), 'Context should be an array');
      assert.ok(context.length > 0, 'Context should contain documents');
    });

    test('should generate grounded responses using RAG', async () => {
      const query = 'Explain RAG architecture';
      const response = await ragIntegration.generateWithRAG(query);
      assert.ok(response, 'Response should be generated');
      assert.ok(response.text, 'Response should have text');
      assert.ok(response.citations, 'Response should have citations');
    });

    test('should detect and prevent hallucinations', async () => {
      const query = 'What is the capital of the moon?';
      const response = await ragIntegration.generateWithRAG(query);
      
      // RAG should abstain or indicate insufficient information
      assert.ok(
        response.abstained || response.text.includes('insufficient information'),
        'Should handle queries with no relevant context'
      );
    });
  });

  describe('Citation and Faithfulness', () => {
    test('should enforce strict citation requirements', async () => {
      const query = 'What are the main components of RAG?';
      const response = await ragIntegration.generateWithRAG(query, {
        citationRequired: true
      });
      
      assert.ok(response.citations, 'Response should include citations');
      assert.ok(response.citations.length > 0, 'Citations array should not be empty');
    });

    test('should calculate faithfulness scores', async () => {
      const query = 'Describe retrieval mechanisms';
      const response = await ragIntegration.generateWithRAG(query);
      const metrics = await ragIntegration.evaluateResponse(
        query,
        response.text,
        response.retrievedDocs
      );
      
      assert.ok(metrics.faithfulness !== undefined, 'Should have faithfulness score');
      assert.ok(metrics.relevancy !== undefined, 'Should have relevancy score');
      assert.ok(
        metrics.faithfulness >= 0 && metrics.faithfulness <= 1,
        'Faithfulness should be between 0 and 1'
      );
    });
  });

  describe('Confidence-based Abstention', () => {
    test('should abstain when confidence is below threshold', async () => {
      const query = 'Random nonsense query xyz123';
      const response = await ragIntegration.generateWithRAG(query, {
        minConfidence: 0.7
      });
      
      assert.ok(
        response.abstained || response.confidence < 0.7,
        'Should abstain or have low confidence for irrelevant queries'
      );
    });

    test('should include confidence scores in responses', async () => {
      const query = 'What is RAG?';
      const response = await ragIntegration.generateWithRAG(query);
      
      assert.ok(
        response.confidence !== undefined,
        'Response should include confidence score'
      );
      assert.ok(
        response.confidence >= 0 && response.confidence <= 1,
        'Confidence should be between 0 and 1'
      );
    });
  });

  describe('Document Indexing', () => {
    test('should index documents successfully', async () => {
      const documents = [
        {
          id: 'doc1',
          text: 'RAG combines retrieval and generation.',
          metadata: { source: 'test' }
        },
        {
          id: 'doc2',
          text: 'Vector stores enable semantic search.',
          metadata: { source: 'test' }
        }
      ];
      
      const result = await ragIntegration.indexDocuments(documents);
      assert.ok(result.success, 'Documents should be indexed successfully');
      assert.strictEqual(result.indexed, 2, 'Should index 2 documents');
    });
  });

  describe('Integration with LLM Clients', () => {
    test('should integrate with mock LLM client', async () => {
      // Mock LLM client
      const mockLLM = {
        sendMessage: async (prompt, options) => ({
          content: 'Mock response based on context',
          options
        })
      };
      
      const ragLLM = ragIntegration.createRAGEnabledLLM(mockLLM);
      await ragLLM.initialize();
      
      const response = await ragLLM.generateWithRAG(
        'Test query',
        { temperature: 0.7 }
      );
      
      assert.ok(response, 'Should generate response with mock LLM');
      await ragLLM.cleanup();
    });
  });
});

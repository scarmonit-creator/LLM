const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Import RAG components
const ragIntegration = require('../src/rag-integration.js');
const ragPipeline = require('../src/rag-pipeline.js');

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
      const response = await ragIntegration.generateResponse(query);

      assert.ok(response, 'Response should be generated');
      assert.ok(response.answer, 'Response should contain answer');
      assert.ok(response.sources, 'Response should contain sources');
      assert.ok(response.sources.length > 0, 'Response should cite sources');
    });

    test('should calculate faithfulness score', async () => {
      const query = 'What are the benefits of RAG?';
      const response = await ragIntegration.generateResponse(query);

      assert.ok(response.metrics, 'Response should include metrics');
      assert.ok(
        typeof response.metrics.faithfulness === 'number',
        'Faithfulness should be numeric'
      );
      assert.ok(
        response.metrics.faithfulness >= 0 && response.metrics.faithfulness <= 1,
        'Faithfulness score should be between 0 and 1'
      );
    });

    test('should verify answer relevancy metric', async () => {
      const query = 'How does RAG reduce hallucinations?';
      const response = await ragIntegration.generateResponse(query);

      assert.ok(response.metrics.relevancy, 'Response should include relevancy metric');
      assert.ok(typeof response.metrics.relevancy === 'number', 'Relevancy should be numeric');
      assert.ok(
        response.metrics.relevancy >= 0 && response.metrics.relevancy <= 1,
        'Relevancy score should be between 0 and 1'
      );
    });
  });

  describe('Source Citation and Grounding', () => {
    test('should include source citations in responses', async () => {
      const query = 'What is semantic entropy?';
      const response = await ragIntegration.generateResponse(query);

      assert.ok(response.sources, 'Response should have sources');
      response.sources.forEach((source) => {
        assert.ok(source.content, 'Each source should have content');
        assert.ok(source.metadata, 'Each source should have metadata');
      });
    });

    test('should verify all claims are grounded in retrieved context', async () => {
      const query = 'Describe chain-of-thought reasoning';
      const response = await ragIntegration.generateResponse(query);
      const groundingCheck = await ragIntegration.verifyGrounding(
        response.answer,
        response.sources
      );

      assert.ok(groundingCheck, 'Grounding verification should complete');
      assert.ok(groundingCheck.isGrounded, 'Answer should be grounded in sources');
      assert.ok(groundingCheck.score >= 0.7, 'Grounding score should be >= 0.7');
    });
  });

  describe('Hallucination Detection', () => {
    test('should detect potential hallucinations using semantic entropy', async () => {
      const query = 'Test query for hallucination detection';
      const response = await ragIntegration.generateResponse(query);

      assert.ok(
        response.metrics.semanticEntropy !== undefined,
        'Response should include semantic entropy'
      );
      assert.ok(
        typeof response.metrics.semanticEntropy === 'number',
        'Semantic entropy should be numeric'
      );
    });

    test('should flag low-confidence responses', async () => {
      const query = 'What is the capital of the fictional country Zyx?';
      const response = await ragIntegration.generateResponse(query, { enforceGrounding: true });

      assert.ok(response.confidence !== undefined, 'Response should include confidence score');
      if (response.confidence < 0.5) {
        assert.ok(response.warning, 'Low confidence responses should include warning');
      }
    });

    test('should abstain when evidence is insufficient', async () => {
      const query = 'Provide information about completely unknown topic xyz123';
      const response = await ragIntegration.generateResponse(query, {
        enforceGrounding: true,
        abstainThreshold: 0.7,
      });

      if (response.metrics.faithfulness < 0.7) {
        assert.ok(
          response.abstained || response.warning,
          'System should abstain or warn for unverifiable content'
        );
      }
    });
  });

  describe('RAG Pipeline Integration', () => {
    test('should process end-to-end RAG workflow', async () => {
      const query = 'What are the key components of RAG systems?';
      const result = await ragPipeline.process(query);

      assert.ok(result, 'Pipeline should return result');
      assert.ok(result.query === query, 'Result should include original query');
      assert.ok(result.retrievedDocs, 'Result should include retrieved documents');
      assert.ok(result.response, 'Result should include generated response');
      assert.ok(result.metrics, 'Result should include evaluation metrics');
    });

    test('should handle multiple queries in sequence', async () => {
      const queries = [
        'What is RAG?',
        'How does it reduce hallucinations?',
        'What metrics measure faithfulness?',
      ];

      for (const query of queries) {
        const result = await ragPipeline.process(query);
        assert.ok(result.response, `Should generate response for: ${query}`);
        assert.ok(
          result.metrics.faithfulness >= 0,
          `Should have faithfulness metric for: ${query}`
        );
      }
    });
  });

  describe('Performance and Quality Metrics', () => {
    test('should measure retrieval latency', async () => {
      const query = 'Explain RAG architecture';
      const startTime = Date.now();
      const context = await ragIntegration.retrieveContext(query);
      const latency = Date.now() - startTime;

      assert.ok(context, 'Context should be retrieved');
      assert.ok(latency < 5000, 'Retrieval should complete within 5 seconds');
    });

    test('should maintain faithfulness score above threshold', async () => {
      const query = 'What are best practices for RAG implementation?';
      const response = await ragIntegration.generateResponse(query);

      const faithfulnessThreshold = 0.75;
      assert.ok(
        response.metrics.faithfulness >= faithfulnessThreshold,
        `Faithfulness score ${response.metrics.faithfulness} should be >= ${faithfulnessThreshold}`
      );
    });

    test('should verify context relevancy', async () => {
      const query = 'How to evaluate RAG systems?';
      const response = await ragIntegration.generateResponse(query);

      assert.ok(response.metrics.contextRelevancy, 'Should include context relevancy metric');
      assert.ok(response.metrics.contextRelevancy >= 0.6, 'Context relevancy should be >= 0.6');
    });
  });
});

console.log('RAG Integration Test Suite Loaded Successfully');

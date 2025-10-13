import test from 'node:test';
import assert from 'node:assert/strict';
import RAGPipeline from '../src/rag-pipeline.js';

test('RAG pipeline operates with in-memory vector store fallback', async () => {
  const previous = process.env.LLM_VECTOR_STORE;
  process.env.LLM_VECTOR_STORE = 'memory';

  const pipeline = new RAGPipeline({
    collectionName: 'rag_test_collection',
    citationRequired: false,
  });
  await pipeline.initialize();
  await pipeline.addDocuments([
    { text: 'Paris is the capital of France.', metadata: { source: 'geo' } },
    { text: 'Water boils at 100 degrees Celsius.', metadata: { source: 'science' } },
  ]);

  const citations = await pipeline.retrieve('capital of France');
  assert.ok(Array.isArray(citations));

  const result = await pipeline.generateWithRAG(
    'What is the capital of France?',
    async () => 'The capital of France is Paris.'
  );
  assert.ok(result);
  assert.equal(result.abstained, false);
  assert.ok(typeof result.response === 'string');

  process.env.LLM_VECTOR_STORE = previous;
});

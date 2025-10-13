/**
 * Vector Store Abstraction with In-Memory Fallback
 * Provides a unified interface for vector storage that can use ChromaDB
 * or fall back to an in-memory store for CI/testing environments.
 */

import { ChromaClient } from 'chromadb';

/**
 * In-memory vector store implementation
 * Simple JavaScript-only fallback that doesn't require external dependencies
 */
class InMemoryVectorStore {
  constructor() {
    this.collections = new Map();
  }

  async createCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, {
        name,
        documents: [],
        embeddings: [],
        metadatas: [],
        ids: []
      });
    }
    return this.collections.get(name);
  }

  async getCollection(name) {
    return this.collections.get(name) || null;
  }

  async deleteCollection(name) {
    this.collections.delete(name);
  }

  async add(collectionName, { ids, documents, embeddings, metadatas }) {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    collection.ids.push(...ids);
    collection.documents.push(...documents);
    collection.embeddings.push(...embeddings);
    collection.metadatas.push(...metadatas);
  }

  async query(collectionName, { queryEmbeddings, nResults = 10 }) {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // Simple cosine similarity search
    const results = [];
    const queryEmbedding = queryEmbeddings[0];

    for (let i = 0; i < collection.embeddings.length; i++) {
      const docEmbedding = collection.embeddings[i];
      const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
      results.push({
        id: collection.ids[i],
        document: collection.documents[i],
        metadata: collection.metadatas[i],
        distance: 1 - similarity
      });
    }

    // Sort by similarity (lowest distance = highest similarity)
    results.sort((a, b) => a.distance - b.distance);

    return {
      ids: [results.slice(0, nResults).map(r => r.id)],
      documents: [results.slice(0, nResults).map(r => r.document)],
      metadatas: [results.slice(0, nResults).map(r => r.metadata)],
      distances: [results.slice(0, nResults).map(r => r.distance)]
    };
  }

  cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

/**
 * ChromaDB wrapper to match our interface
 */
class ChromaVectorStore {
  constructor(chromaClient) {
    this.client = chromaClient;
    this.collections = new Map();
  }

  async createCollection(name) {
    const collection = await this.client.createCollection({ name });
    this.collections.set(name, collection);
    return collection;
  }

  async getCollection(name) {
    if (this.collections.has(name)) {
      return this.collections.get(name);
    }
    try {
      const collection = await this.client.getCollection({ name });
      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      return null;
    }
  }

  async deleteCollection(name) {
    await this.client.deleteCollection({ name });
    this.collections.delete(name);
  }

  async add(collectionName, data) {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    await collection.add(data);
  }

  async query(collectionName, queryParams) {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    return await collection.query(queryParams);
  }
}

/**
 * Factory function to create the appropriate vector store
 * based on environment configuration
 */
export async function createVectorStore() {
  const storeType = process.env.LLM_VECTOR_STORE || 'chromadb';

  if (storeType === 'memory') {
    console.log('Using in-memory vector store');
    return new InMemoryVectorStore();
  }

  // Try to use ChromaDB, fall back to in-memory if it fails
  try {
    const chromaClient = new ChromaClient();
    await chromaClient.heartbeat(); // Test connection
    console.log('Using ChromaDB vector store');
    return new ChromaVectorStore(chromaClient);
  } catch (error) {
    console.warn('ChromaDB not available, falling back to in-memory store:', error.message);
    return new InMemoryVectorStore();
  }
}

export { InMemoryVectorStore, ChromaVectorStore };

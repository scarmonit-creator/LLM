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
        ids: [],
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

  async add(collectionName, data) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    
    // Add documents to the collection
    if (data.documents) {
      collection.documents.push(...data.documents);
    }
    if (data.embeddings) {
      collection.embeddings.push(...data.embeddings);
    }
    if (data.metadatas) {
      collection.metadatas.push(...data.metadatas);
    }
    if (data.ids) {
      collection.ids.push(...data.ids);
    }
  }

  async query(collectionName, _queryParams) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }
    
    // Simple mock implementation - return empty results
    return {
      ids: [[]],
      distances: [[]],
      documents: [[]],
      metadatas: [[]]
    };
  }
}

/**
 * ChromaDB vector store implementation
 */
class ChromaVectorStore {
  constructor(client) {
    this.client = client;
    this.collections = new Map();
  }

  async createCollection(name) {
    if (this.collections.has(name)) {
      return this.collections.get(name);
    }
    
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
    } catch (_error) {
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

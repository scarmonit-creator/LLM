/**
 * Working Memory System for LLM
 * Provides short-term, long-term, and episodic memory with vector storage,
 * retrieval mechanisms, and automatic memory consolidation.
 */

import { createVectorStore } from './vector-store.js';
import crypto from 'crypto';

/**
 * Memory Types
 */
const MemoryType = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term',
  EPISODIC: 'episodic',
  SEMANTIC: 'semantic',
};

/**
 * Working Memory Manager
 * Manages different types of memory with automatic consolidation
 */
export class WorkingMemory {
  constructor(options = {}) {
    this.shortTermCapacity = options.shortTermCapacity || 20;
    this.consolidationThreshold = options.consolidationThreshold || 15;
    this.vectorStore = null;
    this.shortTermMemory = [];
    this.conversationContext = [];
    this.initialized = false;
  }

  /**
   * Initialize the working memory system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.vectorStore = await createVectorStore();

      // Create collections for different memory types
      await this.vectorStore.createCollection('short_term_memory');
      await this.vectorStore.createCollection('long_term_memory');
      await this.vectorStore.createCollection('episodic_memory');
      await this.vectorStore.createCollection('semantic_memory');

      this.initialized = true;
      console.log('✅ Working Memory System initialized');
    } catch (error) {
      console.error('Failed to initialize working memory:', error);
      throw error;
    }
  }

  /**
   * Add a memory entry
   */
  async addMemory(content, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const memoryEntry = {
      id: this.generateId(),
      content,
      timestamp: Date.now(),
      accessCount: 0,
      importance: metadata.importance || 0.5,
      type: metadata.type || MemoryType.SHORT_TERM,
      metadata: metadata,
    };

    // Add to short-term memory
    this.shortTermMemory.push(memoryEntry);

    // Store in vector database
    await this.storeInVector(memoryEntry);

    // Check if consolidation is needed
    if (this.shortTermMemory.length >= this.consolidationThreshold) {
      await this.consolidateMemories();
    }

    return memoryEntry;
  }

  /**
   * Store memory in vector database
   */
  async storeInVector(memoryEntry) {
    try {
      const collectionName = this.getCollectionName(memoryEntry.type);
      const embedding = await this.generateEmbedding(memoryEntry.content);

      await this.vectorStore.add(collectionName, {
        ids: [memoryEntry.id],
        documents: [memoryEntry.content],
        embeddings: [embedding],
        metadatas: [
          {
            timestamp: memoryEntry.timestamp,
            importance: memoryEntry.importance,
            type: memoryEntry.type,
            accessCount: memoryEntry.accessCount,
            ...memoryEntry.metadata,
          },
        ],
      });
    } catch (error) {
      console.error('Error storing memory in vector database:', error);
    }
  }

  /**
   * Retrieve relevant memories
   */
  async retrieve(query, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { type = null, limit = 5, minImportance = 0.0 } = options;

    const collections = type
      ? [this.getCollectionName(type)]
      : ['short_term_memory', 'long_term_memory', 'episodic_memory', 'semantic_memory'];

    const results = [];

    for (const collectionName of collections) {
      try {
        const embedding = await this.generateEmbedding(query);

        const queryResults = await this.vectorStore.query(collectionName, {
          queryEmbeddings: [embedding],
          nResults: limit,
        });

        if (queryResults.documents && queryResults.documents[0]) {
          for (let i = 0; i < queryResults.documents[0].length; i++) {
            const metadata = queryResults.metadatas?.[0]?.[i] || {};

            if (metadata.importance >= minImportance) {
              results.push({
                content: queryResults.documents[0][i],
                distance: queryResults.distances?.[0]?.[i] || 0,
                metadata,
                id: queryResults.ids?.[0]?.[i],
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
      }
    }

    // Sort by distance (lower is better) and limit results
    return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  /**
   * Consolidate memories from short-term to long-term
   */
  async consolidateMemories() {
    console.log('🧠 Consolidating memories...');

    // Sort by importance and access count
    const sortedMemories = this.shortTermMemory.sort((a, b) => {
      const scoreA = a.importance + a.accessCount * 0.1;
      const scoreB = b.importance + b.accessCount * 0.1;
      return scoreB - scoreA;
    });

    // Promote important memories to long-term
    const toPromote = sortedMemories.slice(0, Math.floor(sortedMemories.length * 0.3));

    for (const memory of toPromote) {
      memory.type = MemoryType.LONG_TERM;
      await this.storeInVector(memory);
    }

    // Keep only recent short-term memories
    this.shortTermMemory = sortedMemories.slice(0, this.shortTermCapacity);

    console.log(`✅ Consolidated: ${toPromote.length} memories promoted to long-term`);
  }

  /**
   * Add to conversation context
   */
  addToContext(role, content) {
    this.conversationContext.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // Keep context window manageable
    if (this.conversationContext.length > 10) {
      this.conversationContext.shift();
    }
  }

  /**
   * Get conversation context
   */
  getContext(limit = 5) {
    return this.conversationContext.slice(-limit);
  }

  /**
   * Build augmented context with retrieved memories
   */
  async buildAugmentedContext(query, options = {}) {
    const relevantMemories = await this.retrieve(query, options);

    const context = {
      conversation: this.getContext(),
      memories: relevantMemories.map((m) => ({
        content: m.content,
        importance: m.metadata.importance,
        timestamp: m.metadata.timestamp,
      })),
    };

    return context;
  }

  /**
   * Clear specific memory type
   */
  async clearMemoryType(type) {
    const collectionName = this.getCollectionName(type);

    try {
      await this.vectorStore.deleteCollection(collectionName);
      await this.vectorStore.createCollection(collectionName);

      if (type === MemoryType.SHORT_TERM) {
        this.shortTermMemory = [];
      }

      console.log(`✅ Cleared ${type} memory`);
    } catch (error) {
      console.error(`Error clearing ${type} memory:`, error);
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      shortTermCount: this.shortTermMemory.length,
      conversationLength: this.conversationContext.length,
      initialized: this.initialized,
    };
  }

  /**
   * Generate embedding for text
   * Simple hash-based embedding for in-memory store
   * For production, use proper embedding models
   */
  async generateEmbedding(text) {
    // Simple deterministic embedding based on text content
    // In production, replace with proper embedding model (OpenAI, Cohere, etc.)
    const hash = crypto.createHash('sha256').update(text).digest();

    // Convert to 384-dimensional vector (common embedding size)
    const embedding = new Array(384);
    for (let i = 0; i < 384; i++) {
      embedding[i] = (hash[i % hash.length] / 255) * 2 - 1;
    }

    return embedding;
  }

  /**
   * Get collection name for memory type
   */
  getCollectionName(type) {
    const collectionMap = {
      [MemoryType.SHORT_TERM]: 'short_term_memory',
      [MemoryType.LONG_TERM]: 'long_term_memory',
      [MemoryType.EPISODIC]: 'episodic_memory',
      [MemoryType.SEMANTIC]: 'semantic_memory',
    };

    return collectionMap[type] || 'short_term_memory';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Memory-Enhanced LLM Client
 * Wraps any LLM client with working memory capabilities
 */
export class MemoryEnhancedLLM {
  constructor(llmClient, memoryOptions = {}) {
    this.llm = llmClient;
    this.memory = new WorkingMemory(memoryOptions);
  }

  /**
   * Initialize memory system
   */
  async initialize() {
    await this.memory.initialize();
  }

  /**
   * Send message with memory augmentation
   */
  async sendMessage(message, systemPrompt = null, options = {}) {
    // Retrieve relevant memories
    const context = await this.memory.buildAugmentedContext(message, {
      limit: options.memoryLimit || 5,
      minImportance: options.minImportance || 0.0,
    });

    // Build augmented prompt
    let augmentedPrompt = systemPrompt || '';

    if (context.memories.length > 0) {
      augmentedPrompt += '\n\nRelevant Context from Memory:\n';
      context.memories.forEach((mem, idx) => {
        augmentedPrompt += `${idx + 1}. ${mem.content}\n`;
      });
    }

    // Add conversation history
    if (context.conversation.length > 0) {
      augmentedPrompt += '\n\nRecent Conversation:\n';
      context.conversation.forEach((msg) => {
        augmentedPrompt += `${msg.role}: ${msg.content}\n`;
      });
    }

    // Send to LLM
    const response = await this.llm.sendMessage(message, augmentedPrompt);

    // Store in memory
    await this.memory.addMemory(message, {
      type: MemoryType.SHORT_TERM,
      importance: 0.6,
      role: 'user',
    });

    await this.memory.addMemory(response, {
      type: MemoryType.SHORT_TERM,
      importance: 0.6,
      role: 'assistant',
    });

    // Add to conversation context
    this.memory.addToContext('user', message);
    this.memory.addToContext('assistant', response);

    return response;
  }

  /**
   * Store important information in long-term memory
   */
  async rememberImportant(content, metadata = {}) {
    return await this.memory.addMemory(content, {
      ...metadata,
      type: MemoryType.LONG_TERM,
      importance: metadata.importance || 0.9,
    });
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return this.memory.getStats();
  }
}

export { MemoryType };

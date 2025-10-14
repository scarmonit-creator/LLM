# Working Memory System for LLM

## Overview

The Working Memory System is a comprehensive memory management solution for Large Language Models (LLMs) that provides persistent, context-aware memory capabilities. It enables LLMs to maintain conversation context, remember important information across sessions, and retrieve relevant information based on semantic similarity.

## Features

### Memory Types

1. **Short-Term Memory**: Stores recent interactions and context
2. **Long-Term Memory**: Persists important information across sessions
3. **Episodic Memory**: Records specific events and conversations
4. **Semantic Memory**: Stores factual knowledge and concepts

### Core Capabilities

- **Vector Storage Integration**: Uses ChromaDB with in-memory fallback
- **Automatic Consolidation**: Intelligently promotes important short-term memories to long-term storage
- **Context-Aware Retrieval**: Semantic search for relevant memories
- **Conversation Management**: Maintains conversation history with sliding window
- **Importance Weighting**: Prioritizes memories based on importance scores
- **Memory Statistics**: Track memory usage and performance

## Installation

The working memory system is integrated into the LLM project. Ensure you have the required dependencies:

```bash
npm install chromadb crypto
```

## Quick Start

### Basic Working Memory

```javascript
import { WorkingMemory, MemoryType } from './working-memory.js';

// Initialize memory
const memory = new WorkingMemory({
  shortTermCapacity: 20,
  consolidationThreshold: 15
});

await memory.initialize();

// Add a memory
await memory.addMemory(
  'User prefers technical documentation',
  { importance: 0.8, type: MemoryType.SEMANTIC }
);

// Retrieve memories
const relevant = await memory.retrieve('user preferences', {
  limit: 5,
  minImportance: 0.5
});
```

### Memory-Enhanced LLM Client

```javascript
import { ClaudeClient } from './claude-client.js';
import { MemoryEnhancedLLM } from './working-memory.js';

// Create memory-enhanced client
const claude = new ClaudeClient();
const memoryLLM = new MemoryEnhancedLLM(claude, {
  shortTermCapacity: 15
});

await memoryLLM.initialize();

// Send message with automatic memory augmentation
const response = await memoryLLM.sendMessage(
  'How do I implement vector search?',
  'You are a helpful AI assistant.'
);

// Store important information
await memoryLLM.rememberImportant(
  'User is building a vector search engine',
  { importance: 0.9 }
);
```

## API Reference

### WorkingMemory Class

#### Constructor

```javascript
new WorkingMemory(options)
```

**Options:**
- `shortTermCapacity` (number, default: 20): Maximum short-term memory entries
- `consolidationThreshold` (number, default: 15): Trigger point for memory consolidation

#### Methods

##### `initialize()`
Initializes the memory system and vector store.

```javascript
await memory.initialize();
```

##### `addMemory(content, metadata)`
Adds a new memory entry.

```javascript
await memory.addMemory(
  'Memory content',
  {
    importance: 0.8,
    type: MemoryType.SEMANTIC,
    customField: 'value'
  }
);
```

**Parameters:**
- `content` (string): The memory content
- `metadata` (object): Memory metadata
  - `importance` (number, 0-1): Memory importance score
  - `type` (MemoryType): Memory type (SHORT_TERM, LONG_TERM, EPISODIC, SEMANTIC)
  - Custom fields as needed

##### `retrieve(query, options)`
Retrieves relevant memories based on semantic similarity.

```javascript
const memories = await memory.retrieve(
  'search query',
  {
    type: MemoryType.SEMANTIC,
    limit: 5,
    minImportance: 0.5
  }
);
```

**Parameters:**
- `query` (string): Search query
- `options` (object):
  - `type` (MemoryType): Filter by memory type
  - `limit` (number): Maximum results to return
  - `minImportance` (number): Minimum importance threshold

**Returns:** Array of memory objects with content, metadata, and relevance scores

##### `consolidateMemories()`
Manually triggers memory consolidation.

```javascript
await memory.consolidateMemories();
```

##### `addToContext(role, content)`
Adds a message to conversation context.

```javascript
memory.addToContext('user', 'Hello!');
memory.addToContext('assistant', 'Hi there!');
```

##### `getContext(limit)`
Retrieves recent conversation context.

```javascript
const context = memory.getContext(5); // Last 5 messages
```

##### `buildAugmentedContext(query, options)`
Builds enriched context with relevant memories.

```javascript
const context = await memory.buildAugmentedContext(
  'current query',
  { limit: 3 }
);
```

**Returns:**
```javascript
{
  conversation: [...], // Recent conversation history
  memories: [...]      // Relevant memories
}
```

##### `clearMemoryType(type)`
Clears all memories of a specific type.

```javascript
await memory.clearMemoryType(MemoryType.SHORT_TERM);
```

##### `getStats()`
Returns memory system statistics.

```javascript
const stats = memory.getStats();
// { shortTermCount, conversationLength, initialized }
```

### MemoryEnhancedLLM Class

#### Constructor

```javascript
new MemoryEnhancedLLM(llmClient, memoryOptions)
```

**Parameters:**
- `llmClient`: Base LLM client (e.g., ClaudeClient)
- `memoryOptions`: Options for WorkingMemory constructor

#### Methods

##### `initialize()`
Initializes the memory system.

```javascript
await memoryLLM.initialize();
```

##### `sendMessage(message, systemPrompt, options)`
Sends a message with automatic memory augmentation.

```javascript
const response = await memoryLLM.sendMessage(
  'User message',
  'System prompt',
  {
    memoryLimit: 5,
    minImportance: 0.5
  }
);
```

**Parameters:**
- `message` (string): User message
- `systemPrompt` (string): System prompt for the LLM
- `options` (object):
  - `memoryLimit` (number): Max memories to include
  - `minImportance` (number): Min importance for retrieved memories

##### `rememberImportant(content, metadata)`
Stores important information in long-term memory.

```javascript
await memoryLLM.rememberImportant(
  'Critical information',
  { importance: 0.95, category: 'user_preferences' }
);
```

##### `getMemoryStats()`
Returns memory statistics.

```javascript
const stats = memoryLLM.getMemoryStats();
```

## Memory Types

### MemoryType Enum

```javascript
import { MemoryType } from './working-memory.js';

MemoryType.SHORT_TERM  // Recent, temporary memories
MemoryType.LONG_TERM   // Important, persistent memories
MemoryType.EPISODIC    // Event-based memories
MemoryType.SEMANTIC    // Factual knowledge
```

### Usage Guidelines

- **SHORT_TERM**: Use for recent conversation context, temporary state
- **LONG_TERM**: Use for user preferences, learned patterns, important facts
- **EPISODIC**: Use for specific events, conversation history, timestamps
- **SEMANTIC**: Use for factual knowledge, definitions, general concepts

## Advanced Usage

### Custom Embedding Generation

The system includes a simple hash-based embedding generator. For production use, integrate a proper embedding model:

```javascript
// Override the generateEmbedding method
class CustomWorkingMemory extends WorkingMemory {
  async generateEmbedding(text) {
    // Use OpenAI, Cohere, or other embedding API
    const response = await embeddingAPI.create(text);
    return response.embedding;
  }
}
```

### Memory Consolidation Strategy

Memories are automatically consolidated based on:
1. **Importance Score**: Higher scores are prioritized
2. **Access Count**: Frequently accessed memories are retained
3. **Recency**: Recent memories are weighted higher

Consolidation formula:
```
score = importance + (accessCount * 0.1)
```

Top 30% of memories by score are promoted to long-term storage.

### Vector Store Configuration

The system uses ChromaDB by default with automatic fallback to in-memory storage.

To force in-memory mode:
```bash
export LLM_VECTOR_STORE=memory
```

To use ChromaDB (default):
```bash
export LLM_VECTOR_STORE=chromadb
```

## Examples

Comprehensive examples are available in `memory-demo.js`:

```bash
node src/memory-demo.js
```

### Example Scenarios

1. **Basic Memory Usage**: Adding and retrieving memories
2. **Memory-Enhanced LLM**: Integrating with Claude
3. **Conversation Context**: Managing dialogue history
4. **Memory Consolidation**: Automatic promotion to long-term storage
5. **Multi-Type Storage**: Using different memory types

## Architecture

### Memory Flow

```
User Input → Add to Short-Term Memory → Vector Store
     ↓
Consolidation Check
     ↓
Promotion to Long-Term (based on importance)
     ↓
Retrieval on Next Query → Augmented Context → LLM
```

### Vector Storage

```
ChromaDB Collections:
├── short_term_memory
├── long_term_memory
├── episodic_memory
└── semantic_memory
```

Each collection stores:
- Document content
- Embedding vectors (384-dimensional)
- Metadata (importance, timestamp, type, etc.)
- Unique IDs

## Performance Considerations

### Memory Capacity

- **Short-Term**: Limited to `shortTermCapacity` (default: 20)
- **Long-Term**: Unlimited (stored in vector database)
- **Conversation Context**: Limited to last 10 messages

### Consolidation Triggers

- Automatic: When short-term memory reaches `consolidationThreshold`
- Manual: Call `consolidateMemories()` directly

### Query Performance

- Retrieval time depends on vector database size
- Use `limit` parameter to control query cost
- Use `minImportance` to filter low-value results

## Best Practices

1. **Set Appropriate Importance Scores**
   - User preferences: 0.8-0.9
   - Critical facts: 0.9-1.0
   - General conversation: 0.5-0.7
   - Temporary state: 0.3-0.5

2. **Choose the Right Memory Type**
   - Use SEMANTIC for facts
   - Use EPISODIC for events
   - Use LONG_TERM for persistence
   - Use SHORT_TERM for temporary context

3. **Optimize Retrieval**
   - Start with smaller `limit` values (3-5)
   - Adjust `minImportance` based on precision needs
   - Use specific memory types to narrow search

4. **Monitor Memory Usage**
   - Regularly check `getStats()`
   - Clear old memories periodically
   - Adjust consolidation thresholds based on usage

5. **Production Embedding Models**
   - Replace hash-based embeddings with proper models
   - Consider: OpenAI Ada, Cohere, sentence-transformers
   - Ensure embedding dimensions match vector store config

## Troubleshooting

### ChromaDB Connection Issues

If ChromaDB fails to connect:
- System automatically falls back to in-memory storage
- Check ChromaDB service is running
- Verify network connectivity
- Set `LLM_VECTOR_STORE=memory` to force in-memory mode

### Memory Not Persisting

- Ensure `initialize()` is called before operations
- Check memory type is set to LONG_TERM for persistence
- Verify vector store is properly configured
- Check for errors in console logs

### Poor Retrieval Results

- Verify embeddings are being generated correctly
- Adjust `minImportance` threshold
- Increase `limit` to get more results
- Consider using more specific queries
- For production, use proper embedding models

## Future Enhancements

- [ ] Integration with professional embedding APIs (OpenAI, Cohere)
- [ ] Memory pruning based on age and relevance
- [ ] Multi-user memory isolation
- [ ] Memory export/import functionality
- [ ] Advanced consolidation strategies
- [ ] Memory visualization tools
- [ ] Performance monitoring and analytics
- [ ] Distributed memory storage

## Contributing

Contributions are welcome! Areas for improvement:
- Better embedding generation
- Advanced retrieval algorithms
- Memory compression techniques
- Performance optimizations
- Additional memory types
- Testing and benchmarks

## License

See the main project LICENSE file.

## Support

For issues and questions:
- Check the examples in `memory-demo.js`
- Review the API reference above
- Open an issue on GitHub

---

**Note**: This is a production-ready memory system with room for customization. For production deployments, consider implementing proper embedding models and monitoring memory usage patterns.

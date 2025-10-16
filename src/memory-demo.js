/**
 * Working Memory System Demo
 * Demonstrates the integration and usage of the working memory system
 */

import { ClaudeClient } from './claude-client.js';
import { WorkingMemory, MemoryEnhancedLLM, MemoryType } from './working-memory.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Example 1: Basic Working Memory Usage
 */
async function basicMemoryDemo() {
  console.log('\n=== Basic Working Memory Demo ===\n');
  
  const memory = new WorkingMemory({
    shortTermCapacity: 10,
    consolidationThreshold: 8
  });
  
  await memory.initialize();
  
  // Add some memories
  await memory.addMemory(
    'User prefers technical documentation with code examples',
    { importance: 0.8, type: MemoryType.SEMANTIC }
  );
  
  await memory.addMemory(
    'User is working on an LLM project in Node.js',
    { importance: 0.9, type: MemoryType.SEMANTIC }
  );
  
  await memory.addMemory(
    'Current conversation is about implementing working memory',
    { importance: 0.7, type: MemoryType.EPISODIC }
  );
  
  // Retrieve relevant memories
  const memories = await memory.retrieve('What is the user working on?', {
    limit: 3,
    minImportance: 0.5
  });
  
  console.log('Retrieved memories:');
  memories.forEach((mem, idx) => {
    console.log(`${idx + 1}. ${mem.content}`);
    console.log(`   Importance: ${mem.metadata.importance}`);
    console.log(`   Type: ${mem.metadata.type}\n`);
  });
  
  // Get memory stats
  console.log('Memory stats:', memory.getStats());
}

/**
 * Example 2: Memory-Enhanced LLM Client
 */
async function memoryEnhancedLLMDemo() {
  console.log('\n=== Memory-Enhanced LLM Demo ===\n');
  
  const claudeClient = new ClaudeClient();
  const memoryLLM = new MemoryEnhancedLLM(claudeClient, {
    shortTermCapacity: 15,
    consolidationThreshold: 10
  });
  
  await memoryLLM.initialize();
  
  // First conversation - establishing context
  console.log('User: Tell me about vector databases');
  const response1 = await memoryLLM.sendMessage(
    'Tell me about vector databases',
    'You are a helpful AI assistant with expertise in databases and AI.'
  );
  console.log('Assistant:', response1);
  
  // Store important information
  await memoryLLM.rememberImportant(
    'User is interested in vector databases for LLM applications',
    { topic: 'vector_databases', importance: 0.95 }
  );
  
  // Second conversation - memory should provide context
  console.log('\nUser: How would I implement that in my project?');
  const response2 = await memoryLLM.sendMessage(
    'How would I implement that in my project?',
    'You are a helpful AI assistant with expertise in databases and AI.'
  );
  console.log('Assistant:', response2);
  
  // Check memory stats
  console.log('\nMemory Stats:', memoryLLM.getMemoryStats());
}

/**
 * Example 3: Conversation Context Management
 */
async function conversationContextDemo() {
  console.log('\n=== Conversation Context Demo ===\n');
  
  const memory = new WorkingMemory();
  await memory.initialize();
  
  // Simulate a conversation
  const conversation = [
    { role: 'user', content: 'What is a neural network?' },
    { role: 'assistant', content: 'A neural network is a computational model inspired by biological neural networks...' },
    { role: 'user', content: 'Can you give me an example?' },
    { role: 'assistant', content: 'Sure! Here\'s a simple example of a neural network for image classification...' },
    { role: 'user', content: 'How do I train it?' }
  ];
  
  // Add to memory
  for (const msg of conversation) {
    memory.addToContext(msg.role, msg.content);
    await memory.addMemory(msg.content, {
      role: msg.role,
      importance: 0.6
    });
  }
  
  // Build augmented context for the next response
  const context = await memory.buildAugmentedContext(
    'How do I train it?',
    { limit: 3 }
  );
  
  console.log('Augmented Context:');
  console.log('\nConversation History:');
  context.conversation.forEach(msg => {
    console.log(`${msg.role}: ${msg.content.substring(0, 60)}...`);
  });
  
  console.log('\nRelevant Memories:');
  context.memories.forEach((mem, idx) => {
    console.log(`${idx + 1}. ${mem.content.substring(0, 60)}...`);
  });
}

/**
 * Example 4: Memory Consolidation
 */
async function memoryConsolidationDemo() {
  console.log('\n=== Memory Consolidation Demo ===\n');
  
  const memory = new WorkingMemory({
    shortTermCapacity: 5,
    consolidationThreshold: 4
  });
  
  await memory.initialize();
  
  // Add multiple memories to trigger consolidation
  const memoryItems = [
    { content: 'JavaScript is a programming language', importance: 0.9 },
    { content: 'Node.js runs JavaScript on the server', importance: 0.85 },
    { content: 'npm is the Node package manager', importance: 0.7 },
    { content: 'Express is a web framework', importance: 0.6 },
    { content: 'React is a UI library', importance: 0.8 },
    { content: 'TypeScript adds types to JavaScript', importance: 0.75 }
  ];
  
  console.log('Adding memories (will trigger consolidation)...\n');
  
  for (const item of memoryItems) {
    await memory.addMemory(item.content, {
      importance: item.importance,
      type: MemoryType.SHORT_TERM
    });
    console.log(`Added: ${item.content}`);
  }
  
  console.log('\nFinal memory stats:', memory.getStats());
}

/**
 * Example 5: Multi-Type Memory Storage
 */
async function multiTypeMemoryDemo() {
  console.log('\n=== Multi-Type Memory Demo ===\n');
  
  const memory = new WorkingMemory();
  await memory.initialize();
  
  // Store different types of memories
  await memory.addMemory(
    'User asked about machine learning on January 15, 2025',
    { type: MemoryType.EPISODIC, importance: 0.7 }
  );
  
  await memory.addMemory(
    'Machine learning is a subset of AI that enables systems to learn from data',
    { type: MemoryType.SEMANTIC, importance: 0.9 }
  );
  
  await memory.addMemory(
    'Currently discussing neural network architectures',
    { type: MemoryType.SHORT_TERM, importance: 0.6 }
  );
  
  await memory.addMemory(
    'Deep learning uses multiple layers of neural networks',
    { type: MemoryType.LONG_TERM, importance: 0.95 }
  );
  
  // Retrieve memories by type
  console.log('Semantic memories:');
  const semanticMemories = await memory.retrieve('machine learning', {
    type: MemoryType.SEMANTIC,
    limit: 5
  });
  semanticMemories.forEach(m => console.log(`  - ${m.content}`));
  
  console.log('\nEpisodic memories:');
  const episodicMemories = await memory.retrieve('when did user ask', {
    type: MemoryType.EPISODIC,
    limit: 5
  });
  episodicMemories.forEach(m => console.log(`  - ${m.content}`));
}

/**
 * Main function - runs all demos
 */
async function main() {
  try {
    console.log('\n🧠 Working Memory System Demonstration\n');
    console.log('=' .repeat(60));
    
    // Run all demos
    await basicMemoryDemo();
    
    // Only run LLM demo if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      await memoryEnhancedLLMDemo();
    } else {
      console.log('\n⚠️  Skipping Memory-Enhanced LLM Demo (no API key)');
    }
    
    await conversationContextDemo();
    await memoryConsolidationDemo();
    await multiTypeMemoryDemo();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All demos completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Error running demos:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  basicMemoryDemo,
  memoryEnhancedLLMDemo,
  conversationContextDemo,
  memoryConsolidationDemo,
  multiTypeMemoryDemo
};

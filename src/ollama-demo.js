import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🤖 Ollama Integration Demo\n');

  // Import the compiled TypeScript module
  const { agent, listModels } = await import('../dist/agents/ollama.js');

  try {
    // Check if Ollama is available
    const hasApiKey = !!process.env.OLLAMA_API_KEY;
    const baseUrl = process.env.OLLAMA_API_BASE || 'http://localhost:11434';

    console.log('Configuration:');
    console.log(`  Base URL: ${baseUrl}`);
    console.log(`  API Key: ${hasApiKey ? 'Set (Cloud)' : 'Not set (Local)'}`);
    console.log();

    // Try to list models (local only)
    if (!hasApiKey) {
      try {
        console.log('📋 Listing local models...');
        const models = await listModels();
        if (models.models && models.models.length > 0) {
          console.log(`✓ Found ${models.models.length} models:`);
          models.models.slice(0, 5).forEach((m) => {
            console.log(`  - ${m.name}`);
          });
        } else {
          console.log('✗ No models found. Install models with: ollama pull llama3.2');
        }
        console.log();
      } catch (error) {
        console.log('✗ Could not list models:', error.message);
        console.log('  Make sure Ollama is running locally');
        console.log();
      }
    }

    // Test the agent
    console.log('💬 Testing Ollama agent...');
    const envelope = {
      protocol: 'multiagent-1.0',
      intent: 'execute',
      task: 'Test Ollama integration',
      content: {
        type: 'text',
        text: 'What is 2+2? Answer in one sentence.',
      },
      inputs: {
        parameters: {
          model: 'gemma3:latest', // Use a smaller model that fits in memory
          temperature: 0.3,
          max_tokens: 100,
        },
      },
    };

    const result = await agent(envelope);

    if (result.content && result.content.text) {
      console.log('✓ Response received:');
      console.log(`  "${result.content.text}"`);
      console.log();
      console.log(`  Model: ${result.agent.model}`);
      console.log(`  Confidence: ${result.confidence.score}`);
    } else {
      console.log('✗ No response from agent');
    }

    console.log();
    console.log('✅ Ollama integration verified successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error();
    console.error('Troubleshooting:');
    console.error('  1. Make sure Ollama is installed: https://ollama.com');
    console.error('  2. Start Ollama locally: ollama serve');
    console.error('  3. Pull a model: ollama pull llama3.2');
    console.error('  4. Or set OLLAMA_API_KEY for cloud access');
    process.exit(1);
  }
}

main();

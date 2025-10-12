import { ClaudeClient } from './claude-client.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = new ClaudeClient();

  console.log('🤖 LLM Application Starting...\n');

  try {
    // Example: Simple conversation
    const response = await client.sendMessage(
      'Explain what large language models are in one sentence.'
    );
    console.log('Claude:', response);

    // Example: Conversation with system prompt
    const customResponse = await client.sendMessage(
      'What is 2 + 2?',
      'You are a helpful math tutor. Always show your work.'
    );
    console.log('\nClaude (Math Tutor):', customResponse);

    // Example: Streaming response
    console.log('\nClaude (Streaming):');
    await client.streamMessage('Count from 1 to 5.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

// Demo script for the LLM7 agent.  This script uses the chatCompletion
// helper to send a prompt to the LLM7.io API and prints the returned
// assistant message to stdout.  Run with `node llm7_demo.js`.

import { chatCompletion } from './agents/llm7.js';

async function main() {
  try {
    const res = await chatCompletion({
      model: 'mistral-small-3.1-24b-instruct-2503',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello! Can you tell me a fun fact?' },
      ],
      max_tokens: 80,
    });
    const message = res.choices?.[0]?.message?.content || '';
    console.log('Assistant:', message);
  } catch (err) {
    console.error('Error calling LLM7:', err);
  }
}

main();
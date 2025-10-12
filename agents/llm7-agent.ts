import { chatCompletion, ChatMessage } from './llm7.js';

/**
 * A simple agent wrapper around the LLM7 API.  It reads the user prompt
 * from the envelope, sends it to the model and returns a response
 * envelope.  The agent uses a fixed system prompt to instruct the
 * model to behave like a helpful assistant.  You can customise the
 * model and max_tokens by extending the envelope inputs if needed.
 */
export async function agent(env: any): Promise<any> {
  const userText = env?.content?.text || '';
  const model = env?.inputs?.parameters?.model || 'mistral-small-3.1-24b-instruct-2503';
  const maxTokens = env?.inputs?.parameters?.max_tokens || 256;
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userText },
  ];
  const result = await chatCompletion({ model, messages, max_tokens: maxTokens });
  const reply = result.choices?.[0]?.message?.content || '';
  return {
    role: 'agent',
    agent: { id: 'llm7.generic', name: 'LLM7', model },
    timestamp: new Date().toISOString(),
    intent: env.intent,
    task: env.task,
    content: { type: 'text', text: reply },
    outputs: {},
    confidence: { score: 0.7 },
  };
}
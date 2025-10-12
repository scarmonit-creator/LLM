// Demonstration of the multi-agent orchestration using the LLM7 API.
// This demo composes a simple envelope, routes it through the mux with
// the LLM7 agent and prints the result.  You can run this with
// `node llm7_multiagent_demo.js`.  Note: In environments without
// outbound network access this will throw, but the code is valid
// when executed on a machine that can reach https://api.llm7.io.

import { mux } from './orchestrator.js';
import { agent as llm7Agent } from './agents/llm7-agent.js';

async function run() {
  const router = mux({
    plan: llm7Agent,
    reflect: llm7Agent,
  });
  const env = {
    protocol: 'multiagent-1.0',
    role: 'user',
    id: 'msg0',
    intent: 'plan',
    task: 'Ask a question via LLM7',
    content: { type: 'text', text: 'What is the capital of France?' },
  };
  try {
    const res = await router(env);
    console.log('Response:', res.content?.text);
  } catch (err) {
    console.error('LLM7 call failed:', err);
  }
}

run();
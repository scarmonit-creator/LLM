import { strict as assert } from 'assert';
import { startAgentCoordinator } from '../src/agents/agent-coordinator.js';

(async () => {
  const { server, registry } = await startAgentCoordinator();
  const { bridge } = server;

  // Simulate two agents
  const aId = 'agent-summarizer';
  const bId = 'agent-critic';

  // Fake register via internal registry (since we're not opening websockets here)
  registry.register({ id: aId, role: 'summarizer', skills: ['summarize'], intents: ['agent.prompt','agent.response'] });
  registry.register({ id: bId, role: 'critic', skills: ['review'], intents: ['agent.review','agent.response'] });

  // Listen for routed messages
  let routedPrompt = null;
  bridge.on('envelopeProcessed', (env) => {
    if (env.intent === 'agent.prompt' && env.to === aId) routedPrompt = env;
  });

  // Send a prompt targeting role `summarizer`
  bridge.acceptEnvelope({
    intent: 'agent.prompt',
    from: 'tester',
    taskId: 't1',
    payload: { role: 'summarizer', prompt: 'Summarize this text', skills: ['summarize'] },
  });

  // Wait briefly for routing
  await new Promise(r => setTimeout(r, 100));

  assert.ok(routedPrompt, 'Prompt was not routed to the summarizer');

  console.log('agent-coordinator basic tests: OK');
  process.exit(0);
})().catch((e) => {
  console.error('agent-coordinator tests failed:', e);
  process.exit(1);
});

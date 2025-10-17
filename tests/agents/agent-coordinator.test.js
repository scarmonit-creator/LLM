import { strict as assert } from 'assert';
import { startAgentCoordinator } from '../../src/agents/agent-coordinator.js';

(async () => {
  const { server, registry } = await startAgentCoordinator({
    wsPort: 0,
    httpPort: 0,
    logger: { log: () => {}, error: () => {}, warn: () => {} }
  });
  const { bridge } = server;

  try {
    // Simulate two agents
    const aId = 'agent-summarizer';
    const bId = 'agent-critic';

    // Fake register via internal registry (since we're not opening websockets here)
    registry.register({ id: aId, role: 'summarizer', skills: ['summarize'], intents: ['agent.prompt','agent.response'] });
    registry.register({ id: bId, role: 'critic', skills: ['review'], intents: ['agent.review','agent.response'] });

    // Listen for routed messages - bridge emits events after processing
    let routedPrompt = null;
    const handler = (env) => {
      if (env.intent === 'agent.prompt' && env.to === aId) routedPrompt = env;
    };
    bridge.on('envelopeProcessed', handler);

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
  } finally {
    await server.close();
  }

  process.exit(0);
})().catch(async (e) => {
  console.error('agent-coordinator tests failed:', e);
  process.exit(1);
});

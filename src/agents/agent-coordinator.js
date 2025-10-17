// Agent Prompting and Coordination Router
// Adds new intents and routing logic on top of the optimized bridge

import { createAIBridgeServer } from '../ai-bridge.js';
import { AgentRegistry, TaskGuard } from './agent-registry.js';

export async function startAgentCoordinator(options = {}) {
  const server = await createAIBridgeServer(options);
  const { bridge } = server;

  const registry = new AgentRegistry();
  const guard = new TaskGuard({ maxHops: 5 });

  // Register clients on connect - emit event after registration
  const originalRegisterClient = bridge.registerClient.bind(bridge);
  bridge.registerClient = function(ws, registration) {
    const meta = originalRegisterClient(ws, registration);
    if (meta && meta.id) {
      const reg = registry.register({
        id: meta.id,
        role: meta.role,
        skills: Array.from(meta.labels || []),
        intents: Array.from(meta.intents || [])
      });
      bridge.logger?.log?.(`[Coordinator] Registered ${reg.id} role=${reg.role}`);
      bridge.emit('clientRegistered', meta);
    }
    return meta;
  };

  // Handle client disconnection
  bridge.on('clientDisconnected', (clientId) => {
    registry.unregister(clientId);
  });

  // Intercept envelope processing to handle routing and load tracking
  bridge.on('envelopeProcessed', (envelope) => {
    // Update perceived load based on message count (simple heuristic)
    const meta = bridge.clients.get(envelope.to || envelope.from)?.meta;
    if (meta) registry.setLoad(meta.id, meta.messageCount || 0);

    // Core coordination: intercept prompts and route
    try {
      if (!guard.allow(envelope)) return;

      // Standardize hop increment
      const hop = Number(envelope.trace?.hop || 0) + 1;

      // 1) agent.prompt — route to best agent by role or id list
      if (envelope.intent === 'agent.prompt') {
        const to = envelope.to;
        const req = envelope.payload || {};
        const role = req.role || 'agent';
        const skills = req.skills || [];

        let target = null;
        if (Array.isArray(to) && to.length > 0) {
          target = registry.choose(to, skills);
        } else if (typeof to === 'string') {
          // Direct id or role
          target = registry.get(to) || registry.choose(role, skills);
        } else {
          target = registry.choose(role, skills);
        }

        if (!target) {
          // escalate back to sender
          if (envelope.from) {
            bridge.acceptEnvelope({
              intent: 'agent.escalate',
              from: 'coordinator',
              to: envelope.from,
              taskId: envelope.taskId,
              trace: { hop },
              payload: { reason: 'no-available-agent', role }
            });
          }
          return;
        }

        // Forward prompt to target agent
        bridge.acceptEnvelope({
          intent: 'agent.prompt',
          from: envelope.from || 'coordinator',
          to: target.id,
          taskId: envelope.taskId,
          trace: { hop },
          context: envelope.context || {},
          payload: req
        });
        return;
      }

      // 2) agent.review — forward to critic role
      if (envelope.intent === 'agent.review') {
        const role = 'critic';
        const target = registry.choose(role, envelope.payload?.skills || []);
        if (!target) return;
        bridge.acceptEnvelope({
          intent: 'agent.review',
          from: envelope.from || 'coordinator',
          to: target.id,
          taskId: envelope.taskId,
          trace: { hop },
          context: envelope.context || {},
          payload: envelope.payload || {}
        });
        return;
      }

      // 3) agent.response — could aggregate or route back to requester
      if (envelope.intent === 'agent.response' && envelope.replyTo) {
        bridge.acceptEnvelope({
          intent: 'agent.response',
          from: envelope.from,
          to: envelope.replyTo,
          taskId: envelope.taskId,
          trace: { hop },
          context: envelope.context || {},
          payload: envelope.payload || {}
        });
        return;
      }
    } catch (error) {
      bridge.logger?.error?.('[Coordinator] error:', error.message);
    }
  });

  return { server, registry };
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('agent-coordinator.js')) {
  startAgentCoordinator().catch((e) => {
    console.error('[Coordinator] fatal:', e);
    process.exit(1);
  });
}

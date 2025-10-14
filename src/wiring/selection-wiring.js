#!/usr/bin/env node
import { createAIBridgeServer } from '../ai-bridge-optimized.js';
import TabSelectionManager from '../selection/tab-selection-manager.js';

(async () => {
  const server = await createAIBridgeServer();
  const { bridge, httpServer } = server;

  // Wire selected-text events via envelopes
  const selectionManager = new TabSelectionManager();

  bridge.on('envelopeProcessed', async (envelope) => {
    try {
      if (envelope.intent === 'selected.text' && envelope.payload?.text && envelope.context?.tabId) {
        const result = await selectionManager.handleTextSelection(
          envelope.context.tabId,
          envelope.payload.text,
          envelope.context || {}
        );
        // Emit analysis back to sender or broadcast
        if (envelope.from) {
          bridge.acceptEnvelope({
            intent: 'selected.text.analysis',
            to: envelope.from,
            from: 'selection.manager',
            context: { tabId: envelope.context.tabId },
            payload: result
          });
        }
      }

      if (envelope.intent === 'tab.optimize' && envelope.context?.tabId) {
        const optimization = await selectionManager.optimizeCurrentTab(
          envelope.context.tabId,
          envelope.payload || {}
        );
        if (envelope.from) {
          bridge.acceptEnvelope({
            intent: 'tab.optimize.result',
            to: envelope.from,
            from: 'selection.manager',
            context: { tabId: envelope.context.tabId },
            payload: optimization
          });
        }
      }
    } catch (error) {
      // Report error back
      if (envelope.from) {
        bridge.acceptEnvelope({
          intent: 'selection.error',
          to: envelope.from,
          from: 'selection.manager',
          payload: { message: error.message }
        });
      }
    }
  });

  // Expose metrics endpoint similar to bridge
  const app = httpServer; // Not directly Express; extend via new route using the same port
})();

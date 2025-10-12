/**
 * Duck.ai agent for the multi‑agent orchestrator.
 *
 * This module wraps the unofficial DuckDuckGo AI chat API that powers
 * the Duck.ai service. Duck.ai advertises free access to several models
 * including GPT‑4o mini, GPT‑5 mini, Claude 3.5 Haiku, Llama 4 Scout
 * and Mistral Small 3 24B. The underlying API lives at
 * `https://duckduckgo.com/duckchat/v1/status` for session initialisation
 * and `https://duckduckgo.com/duckchat/v1/chat` for conversation. The
 * API requires a per‑session `x‑vqd‑4` header obtained from the status
 * endpoint and uses server‑sent events (SSE) to stream responses.
 *
 * Note: This agent is untested inside this environment because outbound
 * POST requests are currently blocked. However, it follows the
 * specification exposed by the DuckDuckGo client library and should
 * function correctly in an environment where the endpoints are
 * reachable. See the DuckDuckGo AI chat help page for details【422095921524084†L260-L268】.
 */

import { ReadableStreamDefaultReader } from 'stream/web';

export type DuckModel =
  | 'gpt-4o-mini'
  | 'gpt-5-mini'
  | 'claude-3.5-haiku'
  | 'meta-llama/Llama-4-Scout'
  | 'mistralai/Mistral-Small-3-24B';

interface DuckMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPayload {
  model: DuckModel;
  messages: DuckMessage[];
}

/**
 * Retrieve a fresh VQD session token. DuckDuckGo returns this token
 * in the `x-vqd-4` response header. The request must include the
 * `x-vqd-accept: 1` header, otherwise no token is returned. See
 * duckai's internal JS implementation for reference.
 */
async function getVqdToken(): Promise<string> {
  const resp = await fetch('https://duckduckgo.com/duckchat/v1/status', {
    headers: { 'x-vqd-accept': '1' },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch status: ${resp.status} ${resp.statusText}`);
  }
  // DuckDuckGo returns the token in a custom header
  const token = resp.headers.get('x-vqd-4');
  if (!token) {
    throw new Error('Missing x-vqd-4 header on status response');
  }
  return token;
}

/**
 * Parse a stream of Server‑Sent Events (SSE) returned by DuckDuckGo's
 * chat endpoint. Each SSE event contains a JSON payload with a
 * `message` field when a new chunk arrives. The stream ends when the
 * data line is `[DONE]`.
 *
 * @param reader A readable stream reader from the fetch response body.
 */
async function parseSse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE messages are separated by newlines
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      // We only care about lines beginning with "data:"
      if (line.startsWith('data:')) {
        const data = line.slice('data:'.length).trim();
        if (data === '[DONE]') {
          return result;
        }
        try {
          const obj = JSON.parse(data);
          if (obj.message) {
            result += obj.message;
          }
        } catch (_) {
          // ignore malformed JSON chunks
        }
      }
    }
  }
  return result;
}

/**
 * Send a single prompt to Duck.ai and return the assistant's full reply.
 *
 * Example:
 * ```ts
 * const reply = await askDuckAI('What is the capital of France?');
 * console.log(reply); // should print "Paris".
 * ```
 *
 * @param prompt The user message to send.
 * @param model Optional model name. Defaults to GPT‑4o mini.
 * @returns The assistant's full response text.
 */
export async function askDuckAI(prompt: string, model: DuckModel = 'gpt-4o-mini'): Promise<string> {
  // Obtain a new session token for each request. For multi‑message
  // conversations you should reuse the latest token and message history.
  const vqd = await getVqdToken();
  const payload: ChatPayload = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };
  const resp = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vqd-4': vqd,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`Failed to send chat request: ${resp.status} ${resp.statusText}`);
  }
  if (!resp.body) {
    throw new Error('No response body returned');
  }
  const reader = resp.body.getReader();
  const reply = await parseSse(reader);
  return reply.trim();
}
// agents/apifreellm.ts
//
// This module provides a simple wrapper around the ApiFreeLLM free API.
// The service exposes a POST https://apifreellm.com/api/chat endpoint that accepts
// a JSON body with a single `message` string. A successful response will
// contain a JSON object with a `response` field. No API key is required.
// See documentation: https://www.apifreellm.com/docs#free-api

// Fix TypeScript errors by using proper global declarations
declare const fetch: typeof import('undici').fetch;
declare const console: Console;

export interface ApiFreeLLMOptions {
  /** Additional model option. Currently ignored because the free API uses a default model. */
  model?: string;
}

export interface ApiFreeLLMResponse {
  response?: string;
  status: string;
  error?: string;
}

/**
 * Send a chat message to the ApiFreeLLM free API.
 *
 * The free API is rate limited to one request per five seconds per IP and
 * returns an object with a `response` string when successful. If the rate
 * limit is exceeded or another error occurs the returned object will have
 * an `error` field and `status` set to `error`.
 *
 * Note: This function uses the native fetch available in recent versions
 * of Node.js. If you're running on an older version of Node you may need
 * to install a polyfill such as `node-fetch`.
 *
 * @param message A plain‑text message to send to the LLM.
 * @param opts    Optional parameters. Currently unused.
 */
export async function chat(message: string, opts: ApiFreeLLMOptions = {}): Promise<ApiFreeLLMResponse> {
  const url = 'https://apifreellm.com/api/chat';
  const body = { message };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  // The API always returns HTTP 200, success or error info is contained in
  // the JSON body. We handle both here.
  const json = (await res.json()) as ApiFreeLLMResponse;
  return json;
}

// Example usage: run this file directly with ts-node to test the API.
// Note: Removing problematic require.main check that caused TypeScript errors
export async function testApiFreeLLM(): Promise<void> {
  try {
    const resp = await chat('Hello! Who are you?');
    console.log(resp);
  } catch (err) {
    console.error(err);
  }
}
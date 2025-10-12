/**
 * Agent that calls GPT4Free (g4f) endpoints for chat completions.
 *
 * This module exports a single function `chatCompletion` that accepts a
 * base URL (e.g. "https://g4f.dev/api/groq"), a model name (e.g. "gpt-4o" or
 * "llama3-8b"), and an array of messages following the OpenAI Chat
 * Completions schema. It performs a POST request to
 * `${baseUrl}/chat/completions` and returns the parsed JSON response.
 *
 * Note: GPT4Free hosts multiple providers with different model sets. See
 * the documentation for a list of public base URLs and which models they
 * support. Some providers require an API key; others are free to use
 * without authentication【116470011667186†L32-L49】. If a base URL requires
 * authentication, include an `apiKey` option when calling this function.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  apiKey?: string;
  /**
   * Include any extra fields supported by the provider. These will be
   * serialized into the request body.
   */
  extraBody?: Record<string, unknown>;
}

export interface ChatCompletionResponseChoice {
  index: number;
  message: ChatMessage;
  finish_reason?: string;
}

export interface ChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: ChatCompletionResponseChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Perform a chat completion request against a GPT4Free provider.
 *
 * @param options Configuration for the request including baseUrl, model,
 *                and messages. See `ChatCompletionOptions` for details.
 * @returns The parsed JSON response from the server.
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  const { baseUrl, model, messages, temperature = 0.7, apiKey, extraBody = {} } = options;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: any = {
    model,
    messages,
    temperature,
    ...extraBody,
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    // When a provider requires an API key, pass it in the Authorization header.
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`GPT4Free request failed with status ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as ChatCompletionResponse;
}
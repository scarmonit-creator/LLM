/**
 * Agent for calling the LLM7.io chat completions API.  The API is
 * compatible with OpenAI's chat completion format and supports a wide
 * variety of models, including GPT‑5 mini, GPT‑4o mini, Mistral, Gemini
 * and DeepSeek.  No API key is required on the free tier; specify
 * `apiKey` as "unused" (the default) to access the anonymous plan.
 *
 * Usage:
 *
 * ```ts
 * import { chatCompletion } from './agents/llm7';
 *
 * const res = await chatCompletion({
 *   model: 'gpt-5-mini',
 *   messages: [ { role: 'user', content: 'Hello!' } ],
 * });
 * console.log(res.choices[0].message.content);
 * ```
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatCompletionArgs {
  /**
   * Identifier of the model to use, e.g. "gpt-5-mini" or
   * "mistral-small-3.1-24b-instruct-2503".  See `https://api.llm7.io/v1/models`
   * for a full list of available models.
   */
  model: string;
  /**
   * Array of chat messages describing the conversation.
   */
  messages: ChatMessage[];
  /**
   * Maximum number of tokens to generate.  Optional; defaults to 512.
   */
  max_tokens?: number;
  /**
   * Temperature for sampling randomness.  Optional; defaults to 0.7.
   */
  temperature?: number;
  /**
   * API key for LLM7.io.  Use "unused" for anonymous free tier (default).
   */
  apiKey?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Perform a chat completion request to the LLM7 API.  This function
 * returns a parsed JSON response on success or throws an error if the
 * request fails.  It uses the global `fetch` API (available in Node
 * 18+).  If you need streaming responses, you can implement SSE
 * parsing separately.
 */
export async function chatCompletion(args: ChatCompletionArgs): Promise<ChatCompletionResponse> {
  const {
    model,
    messages,
    max_tokens = 512,
    temperature = 0.7,
    apiKey = 'unused',
  } = args;
  const url = 'https://api.llm7.io/v1/chat/completions';
  const body = JSON.stringify({ model, messages, max_tokens, temperature });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM7 API error ${res.status}: ${text}`);
  }
  return (await res.json()) as ChatCompletionResponse;
}
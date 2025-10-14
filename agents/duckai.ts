/**
 * Optimized Duck.ai agent for the multi-agent orchestrator.
 *
 * This module wraps the unofficial DuckDuckGo AI chat API that powers
 * the Duck.ai service. Duck.ai provides free access to several models
 * including GPT-4o mini, GPT-5 mini, Claude 3.5 Haiku, Llama 4 Scout
 * and Mistral Small 3 24B. The underlying API lives at
 * `https://duckduckgo.com/duckchat/v1/status` for session initialization
 * and `https://duckduckgo.com/duckchat/v1/chat` for conversation.
 *
 * Enhanced features:
 * - VQD token caching with automatic expiration
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * - Rate limiting
 * - Input validation
 * - Custom error handling
 * - SSE stream error recovery
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

export interface DuckAIOptions {
  model?: DuckModel;
  maxRetries?: number;
  timeout?: number;
  enableCache?: boolean;
}

export class DuckAIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: string
  ) {
    super(message);
    this.name = 'DuckAIError';
  }
}

// VQD token cache
interface TokenCache {
  token: string;
  timestamp: number;
}

let vqdCache: TokenCache | null = null;
const VQD_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const requestTimes: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 15;

/**
 * Check if request is within rate limits
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  
  // Clean up old requests (older than 1 minute)
  while (requestTimes.length > 0 && now - requestTimes[0]! > 60000) {
    requestTimes.shift();
  }
  
  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  requestTimes.push(now);
  return true;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate input prompt
 */
function validatePrompt(prompt: string): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new DuckAIError('Prompt must be a non-empty string');
  }
  
  if (prompt.trim().length === 0) {
    throw new DuckAIError('Prompt cannot be empty or only whitespace');
  }
  
  if (prompt.length > 32000) {
    throw new DuckAIError('Prompt exceeds maximum length of 32000 characters');
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DuckAIError('Request timeout exceeded');
    }
    throw error;
  }
}

/**
 * Retrieve a fresh VQD session token with retry logic.
 * Caches tokens for 5 minutes to reduce API calls.
 */
async function getVqdToken(timeout: number, maxRetries: number): Promise<string> {
  // Check cache first
  if (vqdCache && Date.now() - vqdCache.timestamp < VQD_TOKEN_TTL) {
    return vqdCache.token;
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetchWithTimeout(
        'https://duckduckgo.com/duckchat/v1/status',
        {
          headers: { 'x-vqd-accept': '1' },
        },
        timeout
      );
      
      if (!resp.ok) {
        throw new DuckAIError(
          `Failed to fetch VQD token: ${resp.statusText}`,
          resp.status,
          await resp.text()
        );
      }
      
      // DuckDuckGo returns the token in a custom header
      const token = resp.headers.get('x-vqd-4');
      if (!token) {
        throw new DuckAIError('Missing x-vqd-4 header on status response');
      }
      
      // Cache the token
      vqdCache = {
        token,
        timestamp: Date.now(),
      };
      
      return token;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on authentication errors
      if (error instanceof DuckAIError && error.statusCode === 401) {
        throw error;
      }
      
      // If this was the last attempt, break
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(backoffMs);
    }
  }
  
  throw new DuckAIError(
    `Failed to get VQD token after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}

/**
 * Parse a stream of Server-Sent Events (SSE) with error handling.
 * Each SSE event contains a JSON payload with a `message` field.
 * The stream ends when the data line is `[DONE]`.
 */
async function parseSse(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let result = '';
  
  try {
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
            
            // Handle error messages from the API
            if (obj.error) {
              throw new DuckAIError(`API error: ${obj.error}`);
            }
          } catch (parseError) {
            // Only ignore truly malformed JSON, not DuckAIErrors
            if (parseError instanceof DuckAIError) {
              throw parseError;
            }
            // Silently ignore malformed JSON chunks
          }
        }
      }
    }
    
    return result;
  } finally {
    // Always release the reader
    try {
      reader.releaseLock();
    } catch {
      // Ignore errors when releasing lock
    }
  }
}

/**
 * Send a single prompt to Duck.ai with retry logic and return the assistant's full reply.
 *
 * Example:
 * ```ts
 * const reply = await askDuckAI('What is the capital of France?');
 * console.log(reply); // should print "Paris".
 * ```
 *
 * @param prompt The user message to send.
 * @param options Optional configuration including model, retry settings, and timeout.
 * @returns The assistant's full response text.
 * @throws DuckAIError if request fails after all retries.
 */
export async function askDuckAI(
  prompt: string,
  options: DuckAIOptions = {}
): Promise<string> {
  const {
    model = 'gpt-4o-mini',
    maxRetries = 3,
    timeout = 30000,
    enableCache = true,
  } = options;
  
  // Validate input
  validatePrompt(prompt);
  
  // Check rate limit
  if (!checkRateLimit()) {
    throw new DuckAIError('Rate limit exceeded. Please wait before making more requests.');
  }
  
  let lastError: Error | null = null;
  
  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Obtain a session token (cached or fresh)
      const vqd = await getVqdToken(timeout, maxRetries);
      
      const payload: ChatPayload = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };
      
      const resp = await fetchWithTimeout(
        'https://duckduckgo.com/duckchat/v1/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-vqd-4': vqd,
          },
          body: JSON.stringify(payload),
        },
        timeout
      );
      
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new DuckAIError(
          `Failed to send chat request: ${resp.statusText}`,
          resp.status,
          errorText
        );
      }
      
      if (!resp.body) {
        throw new DuckAIError('No response body returned');
      }
      
      const reader = resp.body.getReader();
      const reply = await parseSse(reader);
      
      return reply.trim();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Invalidate token cache on certain errors
      if (error instanceof DuckAIError && error.statusCode === 401) {
        vqdCache = null;
      }
      
      // Don't retry on authentication or validation errors
      if (error instanceof DuckAIError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw error;
        }
        if (error.statusCode === 400 || error.message.includes('Prompt')) {
          throw error;
        }
      }
      
      // If this was the last attempt, break
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s...
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(backoffMs);
    }
  }
  
  throw new DuckAIError(
    `Request failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    lastError instanceof DuckAIError ? lastError.statusCode : undefined,
    lastError instanceof DuckAIError ? lastError.response : undefined
  );
}

/**
 * Clear the VQD token cache. Useful for forcing a fresh token fetch.
 */
export function clearTokenCache(): void {
  vqdCache = null;
}

/**
 * Get cache and rate limit statistics
 */
export function getStats(): {
  tokenCached: boolean;
  tokenAge: number | null;
  recentRequests: number;
} {
  return {
    tokenCached: vqdCache !== null,
    tokenAge: vqdCache ? Date.now() - vqdCache.timestamp : null,
    recentRequests: requestTimes.length,
  };
}

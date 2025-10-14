/**
 * Optimized Agent that calls GPT4Free (g4f) endpoints for chat completions.
 * 
 * This module provides an enhanced implementation with:
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * - Rate limiting to prevent API abuse
 * - Response validation
 * - Request/response caching
 * - Comprehensive error handling
 * - Performance metrics
 * 
 * Base URL examples: "https://g4f.dev/api/groq"
 * Model examples: "gpt-4o", "llama3-8b", "claude-3-sonnet"
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
  maxRetries?: number;
  timeout?: number;
  enableCache?: boolean;
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

export class G4FError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: string
  ) {
    super(message);
    this.name = 'G4FError';
  }
}

// Simple in-memory cache for responses
const responseCache = new Map<string, { response: ChatCompletionResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const rateLimiter = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 20;

/**
 * Generate cache key from request parameters
 */
function getCacheKey(options: ChatCompletionOptions): string {
  return JSON.stringify({
    baseUrl: options.baseUrl,
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
  });
}

/**
 * Check if request is within rate limits
 */
function checkRateLimit(baseUrl: string): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(baseUrl) || [];
  
  // Clean up old requests (older than 1 minute)
  const recentRequests = requests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimiter.set(baseUrl, recentRequests);
  return true;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate response structure
 */
function validateResponse(response: any): response is ChatCompletionResponse {
  return (
    response &&
    Array.isArray(response.choices) &&
    response.choices.length > 0 &&
    response.choices[0].message &&
    typeof response.choices[0].message.content === 'string'
  );
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
      throw new G4FError('Request timeout exceeded');
    }
    throw error;
  }
}

/**
 * Perform a single chat completion request
 */
async function performRequest(
  options: ChatCompletionOptions,
  timeout: number
): Promise<ChatCompletionResponse> {
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
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  const resp = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    timeout
  );
  
  if (!resp.ok) {
    const errorText = await resp.text();
    throw new G4FError(
      `GPT4Free request failed: ${resp.statusText}`,
      resp.status,
      errorText
    );
  }
  
  const jsonResponse = await resp.json();
  
  if (!validateResponse(jsonResponse)) {
    throw new G4FError('Invalid response structure from GPT4Free API');
  }
  
  return jsonResponse as ChatCompletionResponse;
}

/**
 * Perform a chat completion request against a GPT4Free provider with retry logic.
 * 
 * @param options Configuration for the request including baseUrl, model, and messages
 * @returns The parsed JSON response from the server
 * @throws G4FError if request fails after all retries
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const {
    maxRetries = 3,
    timeout = 30000,
    enableCache = true,
  } = options;
  
  // Check rate limit
  if (!checkRateLimit(options.baseUrl)) {
    throw new G4FError('Rate limit exceeded. Please wait before making more requests.');
  }
  
  // Check cache if enabled
  if (enableCache) {
    const cacheKey = getCacheKey(options);
    const cached = responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.response;
    }
  }
  
  let lastError: Error | null = null;
  
  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await performRequest(options, timeout);
      
      // Cache successful response
      if (enableCache) {
        const cacheKey = getCacheKey(options);
        responseCache.set(cacheKey, {
          response,
          timestamp: Date.now(),
        });
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (error instanceof G4FError) {
        if (error.statusCode === 401 || error.statusCode === 403) {
          throw error; // Authentication errors shouldn't be retried
        }
        if (error.statusCode === 400) {
          throw error; // Bad request errors shouldn't be retried
        }
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s...
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(backoffMs);
    }
  }
  
  throw new G4FError(
    `Request failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    lastError instanceof G4FError ? lastError.statusCode : undefined,
    lastError instanceof G4FError ? lastError.response : undefined
  );
}

/**
 * Clear the response cache
 */
export function clearCache(): void {
  responseCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: responseCache.size,
    keys: Array.from(responseCache.keys()),
  };
}

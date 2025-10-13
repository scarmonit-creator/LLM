#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import dotenv from 'dotenv';

import { ClaudeClient } from './claude-client.js';

dotenv.config();

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_OLLAMA_MODEL = 'llama3.2';
const DEFAULT_OLLAMA_PROMPT =
  'You are a helpful AI assistant running on Ollama. Provide concise, accurate answers.';

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureClaudeDefaults() {
  if (!process.env.MODEL) {
    process.env.MODEL = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  }
  if (!process.env.MAX_TOKENS) {
    const maxTokens = process.env.CLAUDE_MAX_TOKENS || '';
    process.env.MAX_TOKENS = `${toNumber(maxTokens, 4096)}`;
  }
  if (!process.env.TEMPERATURE) {
    const temperature = process.env.CLAUDE_TEMPERATURE || '';
    process.env.TEMPERATURE = `${toNumber(temperature, 0.7)}`;
  }
}

async function callOllama(messages) {
  const baseUrl = process.env.OLLAMA_API_BASE || 'http://localhost:11434';
  const apiKey = process.env.OLLAMA_API_KEY;
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const temperature = toNumber(process.env.OLLAMA_TEMPERATURE, 0.7);
  const maxTokens = toNumber(process.env.OLLAMA_MAX_TOKENS, 2048);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature,
        max_tokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const content = payload?.message?.content;
  if (!content) {
    throw new Error('Ollama response did not include message content');
  }
  return content;
}

const providers = {
  claude: {
    key: 'claude',
    label: 'Claude',
    description: 'Anthropic Claude via @anthropic-ai/sdk',
    history: [],
    client: null,
    isConfigured() {
      return Boolean(process.env.ANTHROPIC_API_KEY);
    },
    reset() {
      this.history = [];
    },
    async send(text) {
      ensureClaudeDefaults();
      const systemPrompt = process.env.CLAUDE_SYSTEM_PROMPT || '';
      if (!this.client) {
        this.client = new ClaudeClient();
      }

      const userMessage = { role: 'user', content: text };
      this.history.push(userMessage);
      try {
        const reply = await this.client.conversation(this.history, systemPrompt);
        const assistantMessage = { role: 'assistant', content: reply };
        this.history.push(assistantMessage);
        return reply;
      } catch (error) {
        this.history.pop();
        throw error;
      }
    },
  },
  ollama: {
    key: 'ollama',
    label: 'Ollama',
    description: 'Ollama local/cloud chat API',
    history: [],
    reset() {
      this.history = [];
    },
    isConfigured() {
      return true;
    },
    async send(text) {
      const userMessage = { role: 'user', content: text };
      this.history.push(userMessage);

      const systemPrompt = process.env.OLLAMA_SYSTEM_PROMPT || DEFAULT_OLLAMA_PROMPT;
      const conversation = [];
      if (systemPrompt) {
        conversation.push({ role: 'system', content: systemPrompt });
      }
      conversation.push(...this.history);

      try {
        const reply = await callOllama(conversation);
        const assistantMessage = { role: 'assistant', content: reply };
        this.history.push(assistantMessage);
        return reply;
      } catch (error) {
        this.history.pop();
        throw error;
      }
    },
  },
};

const providerKeys = Object.keys(providers);

function getAvailableProviders() {
  return providerKeys.filter((key) => providers[key].isConfigured());
}

function formatPrompt(activeKey) {
  if (!activeKey) {
    return 'chat> ';
  }
  return `${providers[activeKey].key}> `;
}

function printHelp() {
  console.log('\nCommands:');
  console.log('  :help             Show this help menu');
  console.log('  :use <provider>   Switch to a provider (claude, ollama)');
  console.log('  :clear            Reset the current conversation history');
  console.log('  :providers        List configured providers');
  console.log('  :quit             Exit the chat');
  console.log();
}

function listProviders(activeKey) {
  console.log('\nProviders:');
  providerKeys.forEach((key) => {
    const provider = providers[key];
    const status = provider.isConfigured() ? 'ready' : 'missing config';
    const marker = key === activeKey ? '*' : ' ';
    console.log(` ${marker} ${key.padEnd(6)} • ${status} — ${provider.description}`);
  });
  console.log();
}

async function main() {
  const rl = readline.createInterface({ input, output, terminal: true });
  let activeKey = null;

  const available = getAvailableProviders();
  if (available.length > 0) {
    activeKey = available[0];
  }

  console.log('========================================');
  console.log('  LLM Chat Launcher');
  console.log('  :help for commands, :quit to exit');
  console.log('========================================\n');

  if (!activeKey) {
    console.log(
      'No providers ready yet. Configure ANTHROPIC_API_KEY for Claude or run Ollama locally.'
    );
  } else {
    console.log(`Active provider: ${providers[activeKey].label}`);
  }
  listProviders(activeKey);

  const shutdown = () => {
    rl.close();
    console.log('\nGoodbye!');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    console.log();
    shutdown();
  });

  while (true) {
    const prompt = formatPrompt(activeKey);
    const inputLine = await rl.question(prompt);
    const trimmed = inputLine.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith(':')) {
      const [command, ...args] = trimmed.slice(1).split(/\s+/);
      switch (command.toLowerCase()) {
        case 'help':
          printHelp();
          break;
        case 'quit':
        case 'exit':
          shutdown();
          return;
        case 'use': {
          const target = args[0]?.toLowerCase();
          if (!target) {
            console.log('Usage: :use <provider>');
            break;
          }
          if (!providers[target]) {
            console.log(`Unknown provider: ${target}`);
            listProviders(activeKey);
            break;
          }
          if (!providers[target].isConfigured()) {
            console.log(`Provider '${target}' is missing configuration.`);
            break;
          }
          if (activeKey !== target) {
            activeKey = target;
            console.log(`Switched to ${providers[activeKey].label}.`);
          }
          break;
        }
        case 'clear':
          if (!activeKey) {
            console.log('No active provider to clear. Use :use to select one.');
            break;
          }
          providers[activeKey].reset();
          console.log(`Conversation history cleared for ${providers[activeKey].label}.`);
          break;
        case 'providers':
          listProviders(activeKey);
          break;
        default:
          console.log(`Unknown command: :${command}`);
          printHelp();
          break;
      }
      continue;
    }

    if (!activeKey) {
      console.log('No provider selected. Use :use <provider> after configuring your environment.');
      continue;
    }

    const provider = providers[activeKey];
    try {
      const reply = await provider.send(trimmed);
      console.log(`\n${provider.label}> ${reply.trim()}\n`);
    } catch (error) {
      console.error(`\n${provider.label} error: ${error.message}\n`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

# LLM Application

> A powerful Node.js workspace that connects Anthropic Claude, Google Jules, Ollama, and local tooling for advanced LLM interactions, RAG capabilities, and autonomous browser history analysis.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

---

## Features

- **Claude Integration**: Streaming responses, multi-turn conversations, and configurable Claude Sonnet 4.5 access
- **Jules API Client**: Repository analysis, automated coding sessions, and code generation workflows
- **Dual-Provider Chat**: Interactive CLI launcher with hot-swappable Claude/Ollama providers
- **RAG Pipeline**: Retrieval-Augmented Generation with ChromaDB vector store integration
- **Browser History**: Autonomous access to Chrome, Firefox, Edge, Safari, Opera, and Brave history
- **A2A Protocol**: Agent-to-Agent communication via Model Context Protocol (MCP)
- **TypeScript Support**: Full type definitions with ESM module system
- **Comprehensive Testing**: Unit, integration, and E2E tests with coverage reporting

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Core Scripts](#core-scripts)
  - [Development Commands](#development-commands)
  - [Chat Launcher](#chat-launcher)
- [Testing](#testing)
- [Browser History](#browser-history)
- [API Reference](#api-reference)
  - [ClaudeClient](#claudeclient)
  - [JulesClient](#julesclient)
  - [RAG Integration](#rag-integration)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Getting Started

### Prerequisites

- **Node.js** v18.0.0 or newer
- **npm** v9 or newer
- **Anthropic API Key** ([Get one](https://console.anthropic.com/))
- Optional: Ollama, ChromaDB, Jules API key

### Installation

```bash
# Clone and install
git clone <repository-url>
cd LLM
npm install
npm run build
```

### Configuration

```bash
# Create .env file
cp .env.example .env

# Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
```

---

## Environment Variables

### Claude

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Required** | Your Anthropic API key |
| `MODEL` | `claude-sonnet-4-5-20250929` | Claude model |
| `MAX_TOKENS` | `4096` | Max response tokens |
| `TEMPERATURE` | `1.0` | Sampling temperature |

### Ollama

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_API_BASE` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_API_KEY` | Optional | For cloud Ollama |
| `OLLAMA_MODEL` | `llama3` | Model name |

### RAG/ChromaDB

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROMADB_HOST` | `localhost` | ChromaDB host |
| `CHROMADB_PORT` | `8000` | ChromaDB port |
| `USE_MOCK_CHROMADB` | `false` | Use mock for testing |

---

## Usage

### Core Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run Claude demo |
| `npm run chat` | Launch chat launcher |
| `npm run start:orchestrator` | Start orchestrator |
| `npm run start:a2a` | Start A2A server |

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run lint` | Lint and fix code |
| `npm run format` | Format with Prettier |
| `npm run autofix` | Lint + format |
| `npm run typecheck` | Check types |

### Chat Launcher

```bash
npm run chat
```

Commands:
- `:help` - Show help
- `:use <provider>` - Switch provider
- `:clear` - Clear history
- `:quit` - Exit

### Packaging the Windows Launcher

To create a standalone Windows executable for the chat launcher, use the following command:

```bash
npm run build:chat-exe
```

This command bundles the chat launcher and uses `pkg` to produce `release/LLMChat.exe`. Ensure the `pkg` CLI is available (e.g., by running `npm install --save-dev pkg` or using `npx pkg`). The resulting executable will be located in the `release/` directory.

---

## Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run tests |
| `npm run test:watch` | Watch mode |
| `npm run test:e2e` | E2E tests |
| `npm run test:all` | All test suites |
| `npm run coverage` | Generate coverage |

### RAG Tests

```bash
# With ChromaDB
pip install chromadb
chroma run --host localhost --port 8000
npm test

# Or use mock
USE_MOCK_CHROMADB=true npm test
```

---

## Browser History

| Browser | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Chrome | ✓ | ✓ | ✓ |
| Firefox | ✓ | ✓ | ✓ |
| Edge | ✓ | ✓ | - |
| Safari | - | ✓ | - |

```javascript
import { browserHistoryTool } from './tools/browser-history.js';

const history = await browserHistoryTool.execute({
  browser: 'chrome',
  limit: 50,
});
```

---

## API Reference

### ClaudeClient

```javascript
import { ClaudeClient } from './src/claude-client.js';

const claude = new ClaudeClient();

// Send message
const response = await claude.sendMessage('Hello!');

// Stream message
await claude.streamMessage('Tell a story');

// Conversation
const messages = [
  { role: 'user', content: 'My name is Alice' },
  { role: 'assistant', content: 'Nice to meet you!' },
  { role: 'user', content: 'What is my name?' },
];
const reply = await claude.conversation(messages);
```

### JulesClient

```javascript
import { JulesClient } from './src/jules-client.js';

const jules = new JulesClient();

// List sources
const sources = await jules.listSources();

// Create session
const session = await jules.createSession({
  prompt: 'Analyze repository',
  sourceId: 'sources/github/owner/repo',
  title: 'Code Review',
});

// Get session
const details = await jules.getSession(session.sessionId);

// Approve plan
await jules.approvePlan(session.sessionId);
```

### RAG Integration

```javascript
import { createRAGEnabledLLM } from './src/rag-integration.js';
import { ClaudeClient } from './src/claude-client.js';

const claude = new ClaudeClient();
const ragLLM = createRAGEnabledLLM(claude);

await ragLLM.initialize();

// Add documents
await ragLLM.addKnowledge([
  {
    id: '1',
    content: 'Node.js is a JavaScript runtime.',
    metadata: { source: 'docs' },
  },
]);

// Query
const result = await ragLLM.generateWithRAG('What is Node.js?');
console.log(result.response);

await ragLLM.cleanup();
```

---

## Troubleshooting

### API Key Not Found

```bash
cp .env.example .env
echo "ANTHROPIC_API_KEY=your-key" >> .env
```

### Module Not Found

```bash
rm -rf node_modules
npm install
npm run build
```

### ChromaDB Connection Failed

```bash
# Start ChromaDB
pip install chromadb
chroma run --host localhost --port 8000

# Or use mock
USE_MOCK_CHROMADB=true npm test
```

---

## Deployment

### Production

```bash
npm ci --production
npm run build
export NODE_ENV=production
npm start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

---

## Contributing

```bash
git checkout -b feature/your-feature
npm run autofix
npm run test:all
npm run verify:all
```

Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Maintenance

---

## License

MIT

---

**Built with Node.js, TypeScript, and AI**

# LLM Integration Framework

> A comprehensive Node.js framework for orchestrating multi-provider LLM interactions with advanced RAG capabilities, agent protocols, browser history analysis, and autonomous tooling.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Automated-success.svg)](https://github.com/scarmonit-creator/LLM/actions)

---

## Overview

This repository provides a production-ready framework for building intelligent applications powered by multiple LLM providers. It features unified interfaces for Claude, Jules, and Ollama, advanced retrieval-augmented generation (RAG) with ChromaDB, autonomous browser history analysis, and Agent-to-Agent (A2A) communication protocols.

## Features

### Core LLM Integrations
- **Claude Integration**: Streaming responses, multi-turn conversations with Claude Sonnet 4.5, configurable context windows
- **Jules API Client**: Automated repository analysis, coding sessions, and intelligent code generation workflows
- **Ollama Support**: Local LLM deployment with full compatibility and streaming capabilities
- **Dual-Provider Chat**: Interactive CLI launcher with hot-swappable provider selection

### Advanced Capabilities
- **RAG Pipeline**: Retrieval-Augmented Generation with ChromaDB vector store, embeddings management, and semantic search
- **Knowledge Graph Integration**: Graph-based knowledge representation for complex reasoning and relationship mapping
- **AI Bridge**: Real-time WebSocket hub coordinating multiple LLM sessions (Claude, Codex, Gemini, Perplexity, Ollama)
- **Browser History Analysis**: Autonomous access to Chrome, Firefox, Edge, Safari, Opera, and Brave browsing data

### Agent Protocols & Tools
- **A2A Protocol**: Agent-to-Agent communication via Model Context Protocol (MCP)
- **ReAct Tool Reasoning**: Thought-action-observation loops for complex problem solving
- **Hallucination Detection**: Verify-Rectify loops with self-consistency checking
- **Chain-of-Thought**: Advanced reasoning patterns with self-consistency validation

### Infrastructure & Quality
- **TypeScript Support**: Full type definitions with ESM module system
- **Automated CI/CD**: GitHub Actions workflows for testing, linting, and deployment
- **Comprehensive Testing**: Unit, integration, and E2E tests with coverage reporting
- **Cleaned Structure**: Organized codebase with clear separation of concerns
- **Security**: Automated security scanning and dependency updates

---

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Claude Client](#claude-client)
  - [Jules Integration](#jules-integration)
  - [Ollama Local LLM](#ollama-local-llm)
  - [RAG Pipeline](#rag-pipeline)
  - [Browser History](#browser-history)
  - [AI Bridge](#ai-bridge)
  - [A2A Agent Server](#a2a-agent-server)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [License](#license)

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **ChromaDB** (for RAG features)
- API keys for desired providers:
  - Anthropic API key (for Claude)
  - Jules API credentials (for Jules integration)
  - Ollama installed locally (for Ollama support)

### Installation

```bash
# Clone the repository
git clone https://github.com/scarmonit-creator/LLM.git
cd LLM

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your API credentials:

```env
# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_key_here

# Jules API
JULES_API_KEY=your_jules_key_here
JULES_BASE_URL=https://api.jules.ai

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# AI Bridge
BRIDGE_PORT=3000
BRIDGE_WS_PORT=8080

# A2A Agent
A2A_PORT=3001
```

---

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes (for Claude) | - |
| `JULES_API_KEY` | Jules API authentication | Yes (for Jules) | - |
| `JULES_BASE_URL` | Jules API endpoint | No | `https://api.jules.ai` |
| `OLLAMA_BASE_URL` | Ollama server URL | No | `http://localhost:11434` |
| `CHROMA_HOST` | ChromaDB host | No | `localhost` |
| `CHROMA_PORT` | ChromaDB port | No | `8000` |
| `BRIDGE_PORT` | AI Bridge HTTP port | No | `3000` |
| `BRIDGE_WS_PORT` | AI Bridge WebSocket port | No | `8080` |
| `A2A_PORT` | A2A Agent server port | No | `3001` |

---

## Usage

### Claude Client

```javascript
import ClaudeClient from './src/claude-client.js';

const client = new ClaudeClient();

// Single query
const response = await client.query('Explain quantum computing');
console.log(response);

// Streaming conversation
await client.streamConversation('Tell me about AI', (chunk) => {
  process.stdout.write(chunk);
});
```

### Jules Integration

```javascript
import JulesClient from './src/jules-client.js';

const jules = new JulesClient();

// Analyze repository
const analysis = await jules.analyzeRepository('scarmonit-creator/LLM');

// Generate code
const code = await jules.generateCode('Create a REST API endpoint');
```

### Ollama Local LLM

```javascript
import OllamaDemo from './src/ollama-demo.js';

const ollama = new OllamaDemo();
await ollama.run('llama2', 'Explain machine learning');
```

### RAG Pipeline

```javascript
import RAGIntegration from './src/rag-integration.js';

const rag = new RAGIntegration();

// Index documents
await rag.indexDocuments([
  { id: '1', text: 'Document content...', metadata: { source: 'file.txt' } }
]);

// Query with context
const answer = await rag.query('What is the main topic?');
console.log(answer);
```

### Browser History

```javascript
import BrowserHistoryAnalyzer from './src/integrations/browser-history.js';

const analyzer = new BrowserHistoryAnalyzer();

// Retrieve history from all browsers
const history = await analyzer.getAllBrowserHistory();

// Analyze patterns
const insights = await analyzer.analyzePatterns(history);
```

### AI Bridge

```bash
# Start the AI Bridge server
node src/ai-bridge.js

# In another terminal, connect a client
node src/ai-bridge-client.js
```

### A2A Agent Server

```bash
# Start the A2A agent server
npm run start:a2a

# Server runs on port 3001 with MCP protocol support
```

---

## Project Structure

```
LLM/
├── .github/              # GitHub Actions workflows and CI/CD
├── .jules/               # Jules configuration
├── adapters/             # Provider adapters and interfaces
├── agents/               # Autonomous agent implementations
├── cloud-service/        # Cloud deployment configurations
├── config/               # Configuration files
├── examples/             # Example implementations and demos
├── extensions/           # Browser extensions and plugins
├── src/                  # Source code
│   ├── integrations/     # Third-party integrations
│   ├── proxy/            # Proxy services
│   ├── a2a-agent-server.ts    # A2A protocol server
│   ├── claude-client.js       # Claude API client
│   ├── jules-client.js        # Jules API client
│   ├── ollama-demo.js         # Ollama integration
│   ├── rag-integration.js     # RAG pipeline
│   ├── ai-bridge.js           # WebSocket bridge
│   ├── knowledge-graph-integration.js  # Graph database
│   └── ...
├── tests/                # Test suites
├── tools/                # Utility scripts
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

---

## CI/CD

Automated workflows via GitHub Actions:

- **Build & Test**: Runs on every push and pull request
- **Linting**: ESLint and Prettier checks
- **Security Scanning**: Dependency vulnerability checks
- **Coverage Reports**: Automated coverage reporting to Coveralls
- **Auto-fix**: Automated fixes for common issues

See `.github/workflows/` for detailed configurations.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community guidelines.

---

## Documentation

- [A2A Agent Protocol](A2A_AGENT_README.md)
- [AI Bridge Setup](BRIDGE_SETUP.md)
- [Browser History Automation](BROWSER_HISTORY_AUTOMATION.md)
- [CI/CD Auto-Fix Guide](CI_CD_AUTO_FIX_GUIDE.md)
- [Autonomous Tools](AUTONOMOUS_TOOLS_README.md)
- [Security Policy](SECURITY.md)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Anthropic for Claude API
- Google for Jules
- Ollama team for local LLM runtime
- ChromaDB for vector storage
- Open source community

---

**Built with ❤️ by [scarmonit-creator](https://github.com/scarmonit-creator)**

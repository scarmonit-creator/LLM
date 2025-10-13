# LLM Application
A Node.js application integrating Anthropic Claude and Google Jules APIs for advanced LLM interactions.

## Features
- **Claude Integration**: Direct integration with Anthropic's Claude API for conversational AI
- **Jules Integration**: Google Jules API for automated coding sessions and repository analysis
- **Browser History Integration**: Autonomous access and analysis of browser history from multiple browsers (Chrome, Firefox, Edge, Safari, Opera, Brave)
- **Streaming Support**: Real-time streaming responses from Claude
- **Multi-turn Conversations**: Context-aware dialogue
- **Environment Configuration**: Flexible setup via environment variables
- **Dual-Provider Chat Launcher**: Switch between Claude or Ollama from an interactive CLI or packaged Windows executable
- **Jules Ready**: Pre-configured for Jules virtual machine environment
- **RAG Integration**: Retrieval-Augmented Generation with ChromaDB support

## Quick Start

### Prerequisites
- Node.js v18.0.0 or higher
- Anthropic API key
- Google Jules API key
- ChromaDB (for RAG integration tests)

### Installation
```bash
npm install
```

### Configuration
1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```
ANTHROPIC_API_KEY=your_api_key_here
JULES_API_KEY=your_jules_api_key_here
```

### Usage
Run the Claude demo application:
```bash
npm start
```

Run Jules API integration demo:
```bash
npm run jules
```

Development mode with auto-reload:
```bash
npm run dev
```

Launch the interactive Claude/Ollama chat experience:
```bash
npm run chat
```

### Interactive Chat Launcher

- `:help` — list all available commands
- `:use <provider>` — switch between `claude` and `ollama`
- `:clear` — reset the current conversation context
- `:providers` — show configured providers and readiness
- `:quit` — exit the chat launcher

The launcher auto-selects the first provider with working credentials. Configure Claude with `ANTHROPIC_API_KEY` (and optionally `CLAUDE_MODEL`, `CLAUDE_TEMPERATURE`, `CLAUDE_MAX_TOKENS`, `CLAUDE_SYSTEM_PROMPT`). For Ollama, set `OLLAMA_API_BASE`, `OLLAMA_MODEL`, `OLLAMA_TEMPERATURE`, `OLLAMA_MAX_TOKENS`, and optionally `OLLAMA_API_KEY` for hosted access.

Build the Windows desktop executable:
```bash
npm run build:chat-exe
```

Place a `.env` next to `release/LLMChat.exe` (or set global environment variables) so the launcher can authenticate to Claude or Ollama.

## RAG Integration Tests

### ChromaDB Requirements

⚠️ **IMPORTANT**: RAG integration tests require ChromaDB to be properly initialized before running. Tests will fail if ChromaDB is not available.

### Testing Options

You have two options for running RAG integration tests:

#### Option 1: Local ChromaDB Instance (Recommended for Development)

1. Install ChromaDB:
```bash
pip install chromadb
```

2. Start ChromaDB server:
```bash
chroma run --host localhost --port 8000
```

3. Configure environment variables in `.env`:
```
CHROMADB_HOST=localhost
CHROMADB_PORT=8000
```

4. Run RAG integration tests:
```bash
npm run test:rag
```

#### Option 2: Mock Database Configuration (For CI/CD and Testing)

For environments where a full ChromaDB instance is not feasible (CI pipelines, quick local tests), use the mock configuration:

1. Set mock mode in `.env` or environment:
```bash
USE_MOCK_CHROMADB=true
```

2. Run tests with mock database:
```bash
USE_MOCK_CHROMADB=true npm run test:rag
```

### CI/CD Configuration

The CI pipeline automatically initializes ChromaDB in mock mode for integration tests. See `.github/workflows/integration.yml` for implementation details.

**Key CI Environment Variables:**
- `USE_MOCK_CHROMADB=true` - Enables mock ChromaDB for testing
- `CHROMADB_HOST=localhost` - ChromaDB host (ignored in mock mode)
- `CHROMADB_PORT=8000` - ChromaDB port (ignored in mock mode)

### Troubleshooting RAG Tests

If RAG integration tests fail:

1. **Check ChromaDB availability**:
   - Ensure ChromaDB server is running (Option 1)
   - OR ensure mock mode is enabled (Option 2)

2. **Verify environment variables**:
   ```bash
   echo $USE_MOCK_CHROMADB
   echo $CHROMADB_HOST
   echo $CHROMADB_PORT
   ```

3. **Check test output for initialization errors**:
   - Look for "ChromaDB connection failed" messages
   - Verify mock setup if using `USE_MOCK_CHROMADB=true`

4. **Local development quick fix**:
   ```bash
   # Use mock mode to bypass ChromaDB requirement
   USE_MOCK_CHROMADB=true npm test
   ```

## Browser History Integration

The application includes autonomous browser history access capabilities that can read and analyze browsing history from multiple browsers.

### Supported Browsers
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS)
- Opera
- Brave

### Usage
```javascript
import { browserHistoryTool } from './tools/browser-history.js';

// Get recent browser history
const history = await browserHistoryTool.execute({
  browser: 'chrome',
  limit: 50
});
```

### Configuration
Browser history paths are automatically detected based on your operating system. See [BROWSER_HISTORY_AUTOMATION.md](BROWSER_HISTORY_AUTOMATION.md) for detailed configuration and autonomous execution setup.

### Testing
Run browser history integration tests:
```bash
npm run test:browser-history
```

## API Reference

### JulesClient

#### `listSources()`
List all available GitHub sources.
```javascript
import { JulesClient } from './src/jules-client.js';

const jules = new JulesClient();
const sources = await jules.listSources();
```

#### `createSession({ prompt, sourceId?, title? })`
Create a new Jules coding session.
```javascript
const session = await jules.createSession({
  prompt: 'Analyze repository and suggest improvements',
  sourceId: 'github/owner/repo',
  title: 'Code Review Session'
});
```

#### `listSessions({ pageSize?, pageToken? })`
List all sessions with pagination.
```javascript
const sessions = await jules.listSessions({ pageSize: 10 });
```

#### `getSession(sessionId)`
Get detailed session information.
```javascript
const session = await jules.getSession('session-id-123');
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

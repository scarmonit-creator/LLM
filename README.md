# LLM Application
A Node.js application integrating Anthropic Claude and Google Jules APIs for advanced LLM interactions.

## Features
- **Claude Integration**: Direct integration with Anthropic's Claude API for conversational AI
- **Jules Integration**: Google Jules API for automated coding sessions and repository analysis
- **Browser History Integration**: Autonomous access and analysis of browser history from multiple browsers (Chrome, Firefox, Edge, Safari, Opera, Brave)
- **Streaming Support**: Real-time streaming responses from Claude
- **Multi-turn Conversations**: Context-aware dialogue
- **Environment Configuration**: Flexible setup via environment variables
- **Jules Ready**: Pre-configured for Jules virtual machine environment

## Quick Start

### Prerequisites
- Node.js v18.0.0 or higher
- Anthropic API key
- Google Jules API key

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

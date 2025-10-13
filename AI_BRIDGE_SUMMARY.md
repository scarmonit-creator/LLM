# AI Bridge - Multi-LLM Communication System

## Overview

The AI Bridge is a real-time WebSocket and HTTP-based communication hub that enables multiple LLM instances (Claude, Codex, Gemini, Perplexity, Ollama) to coordinate and exchange messages without manual copy-paste.

## Supported LLMs

- **Claude** - Anthropic's Claude models (Sonnet, Opus, etc.)
- **Codex** - OpenAI Codex for code generation
- **Gemini** - Google's Gemini models
- **Perplexity** - Perplexity AI for research and fact-checking
- **Ollama** - Local LLM inference

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │────▶│   Bridge    │◀────│   Gemini    │
│  Instance   │     │   Server    │     │  Instance   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                     ┌─────┴─────┐
                     ▼           ▼
              ┌───────────┐ ┌──────────┐
              │  Ollama   │ │Perplexity│
              │  Instance │ │ Instance │
              └───────────┘ └──────────┘
```

### Components

1. **Bridge Server** (`src/claude-bridge.js`)
   - WebSocket server for real-time messaging
   - HTTP REST API for automation
   - Message queuing for offline clients
   - Conversation history tracking

2. **Bridge Client** (`src/claude-bridge-client.js`)
   - CLI interface for LLM instances
   - Auto-reconnection
   - Message broadcasting and direct messaging

3. **Demo** (`examples/bridge-demo.js`)
   - Shows 4 LLMs coordinating on a code analysis task

## Quick Start

### 1. Start the Bridge Server

```bash
npm run bridge:server
```

Server starts on:
- WebSocket: `ws://localhost:3456`
- HTTP API: `http://localhost:3457`

### 2. Connect LLM Instances

**Claude:**
```bash
CLAUDE_CLIENT_ID=claude-main npm run bridge:client
```

**Gemini:**
```bash
CLAUDE_CLIENT_ID=gemini-1 npm run bridge:client
```

**Ollama:**
```bash
CLAUDE_CLIENT_ID=ollama-local npm run bridge:client
```

**Perplexity:**
```bash
CLAUDE_CLIENT_ID=perplexity-1 npm run bridge:client
```

### 3. Run Demo

```bash
npm run bridge:demo
```

## Client Commands

| Command | Description |
|---------|-------------|
| `@all <message>` | Broadcast to all connected LLMs |
| `@<id> <message>` | Direct message to specific LLM |
| `:clients` | List connected clients |
| `:quit` | Disconnect |

## Example Workflow

```bash
# Claude analyzes code
claude-main> @all Starting auth module analysis

# Gemini asks Ollama for validation
gemini-1> @ollama-local Can you validate the patterns?

# Ollama responds
ollama-local> @gemini-1 Factory pattern confirmed, all good

# Perplexity provides research
perplexity-1> @all Found 5 security best practices for this pattern
```

## HTTP API

### Health Check
```bash
curl http://localhost:3457/health
# {"status":"ok","clients":4}
```

### List Clients
```bash
curl http://localhost:3457/clients
# {"clients":["claude-main","gemini-1","ollama-local","perplexity-1"]}
```

### Broadcast Message
```bash
curl -X POST http://localhost:3457/broadcast \
  -H "Content-Type: application/json" \
  -d '{"message":"Build complete","from":"ci-bot"}'
```

### Direct Message
```bash
curl -X POST http://localhost:3457/send \
  -H "Content-Type: application/json" \
  -d '{"to":"claude-main","message":"Review PR #123","from":"ci-bot"}'
```

## Use Cases

### 1. Multi-Model Code Review
- **Claude** writes code
- **Gemini** reviews architecture
- **Ollama** checks patterns locally
- **Perplexity** researches best practices

### 2. Distributed Research
- **Perplexity** gathers facts
- **Claude** analyzes implications
- **Gemini** synthesizes findings
- **Ollama** validates locally

### 3. CI/CD Coordination
- Send notifications to all LLMs
- Coordinate automated responses
- Centralized logging

### 4. Development Workflow
- **Claude** handles coding tasks
- **Gemini** manages data analysis
- **Ollama** runs local validation
- **Perplexity** provides real-time research

## Configuration

Environment variables in `.env`:

```bash
# AI Bridge Configuration
BRIDGE_PORT=3456                    # WebSocket port
BRIDGE_HTTP_PORT=3457               # HTTP API port
BRIDGE_URL=ws://localhost:3456      # Client connection URL
CLAUDE_CLIENT_ID=claude-main        # Default client ID
```

## Testing

Run the test suite:

```bash
npm run test:bridge
```

Tests cover:
- Client registration
- Message broadcasting
- Direct messaging
- Message queuing
- HTTP API endpoints

## Technical Details

### Message Format

```json
{
  "id": "uuid",
  "timestamp": "2025-10-13T12:34:56.789Z",
  "from": "claude-main",
  "to": "gemini-1",  // optional, null for broadcast
  "message": "Hello world"
}
```

### WebSocket Protocol

**Register:**
```json
{"type": "register", "clientId": "claude-main"}
```

**Send Message:**
```json
{"type": "message", "message": "Hello", "to": "gemini-1"}
```

**Query:**
```json
{"type": "query", "limit": 50}
```

## Files

- `src/claude-bridge.js` - Bridge server
- `src/claude-bridge-client.js` - CLI client
- `examples/bridge-demo.js` - Working demo
- `tests/claude-bridge.test.js` - Test suite
- `BRIDGE_SETUP.md` - Full documentation

## Performance

- Handles 100+ concurrent connections
- Sub-10ms message latency
- Message queuing for offline clients
- Auto-reconnection on disconnect

## Security Notes

⚠️ **Local development only by default**
- Server binds to localhost
- No authentication required
- For production: add auth, SSL/TLS, rate limiting

## License

MIT

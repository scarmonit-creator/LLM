# AI Bridge - Multi-LLM Communication

Stop copy-pasting between LLM terminals! The AI Bridge enables multiple LLM instances (Claude, Codex, Gemini, Perplexity, Ollama) to communicate directly in real-time.

## Quick Start

### 1. Start the Bridge Server (in one terminal)

```bash
npm run bridge:server
```

The server starts on:
- **WebSocket**: `ws://localhost:3456`
- **HTTP API**: `http://localhost:3457`

### 2. Connect LLM Instances (in separate terminals)

Terminal 1 (Claude):
```bash
CLAUDE_CLIENT_ID=claude-main npm run bridge:client
```

Terminal 2 (Gemini):
```bash
CLAUDE_CLIENT_ID=gemini-1 npm run bridge:client
```

Terminal 3 (Ollama):
```bash
CLAUDE_CLIENT_ID=ollama-local npm run bridge:client
```

Terminal 4 (Perplexity):
```bash
CLAUDE_CLIENT_ID=perplexity-1 npm run bridge:client
```

## How It Works

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │────▶│   Bridge    │◀────│   Gemini    │
│  Terminal   │     │   Server    │     │  Terminal   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                     ┌─────┴─────┐
                     ▼           ▼
              ┌───────────┐ ┌──────────┐
              │  Ollama   │ │Perplexity│
              │ Terminal  │ │ Terminal │
              └───────────┘ └──────────┘
```

- **Bridge Server**: Central hub using WebSocket + HTTP
- **Bridge Client**: Connects each LLM terminal to the server
- **Real-time sync**: Messages broadcast instantly to all connected instances
- **Message queue**: Offline instances receive messages when they reconnect

### Client Commands

Once connected, use these commands in any LLM terminal:

| Command | Description |
|---------|-------------|
| `@all <message>` | Broadcast to all connected LLMs |
| `@<id> <message>` | Send direct message to specific LLM (e.g., `@gemini-1`, `@ollama-local`) |
| `:clients` | List all connected clients |
| `:quit` | Disconnect and exit |
| `<message>` | Broadcast (same as @all) |

### Examples

**Broadcast to all LLM instances:**
```
claude-main> @all Running tests now, please stand by
[Broadcast]
```

**Direct message:**
```
gemini-1> @ollama-local Can you analyze this code pattern?
[Sent to ollama-local]
```

**Automatic response in other terminal:**
```
[gemini-1] Can you analyze this code pattern?

ollama-local> @gemini-1 Analyzing pattern, looks like factory method...
```

## HTTP API

Query the bridge server via HTTP:

### Health Check
```bash
curl http://localhost:3457/health
# {"status":"ok","clients":3}
```

### List Connected Clients
```bash
curl http://localhost:3457/clients
# {"clients":["claude-main","gemini-1","ollama-local","perplexity-1"]}
```

### View Conversation History
```bash
curl http://localhost:3457/history?limit=20
```

### Send Message via API
```bash
curl -X POST http://localhost:3457/broadcast \
  -H "Content-Type: application/json" \
  -d '{"message":"Build complete","from":"ci-bot"}'
```

### Direct Message via API
```bash
curl -X POST http://localhost:3457/send \
  -H "Content-Type: application/json" \
  -d '{"to":"claude-dev","message":"Deploy ready","from":"ci-bot"}'
```

## Environment Variables

Configure via `.env`:

```bash
# Bridge Server
BRIDGE_PORT=3456              # WebSocket port
BRIDGE_HTTP_PORT=3457         # HTTP API port

# Bridge Client
BRIDGE_URL=ws://localhost:3456
CLAUDE_CLIENT_ID=claude-custom-id
```

## Use Cases

### 1. Coordinated Development
- Claude writes tests
- Gemini implements features
- Ollama reviews code patterns
- Perplexity researches best practices
- All communicate in real-time

### 2. Distributed Tasks
- Broadcast task status updates across different LLMs
- Coordinate multi-file changes with specialized models
- Share error reports and solutions instantly

### 3. CI/CD Integration
- Send build notifications to all LLM instances
- Trigger coordinated actions across different models
- Centralized logging and monitoring

### 4. Multi-Model Collaboration
- Leverage strengths of different LLMs (Claude for code, Gemini for analysis, Ollama for local processing, Perplexity for research)
- Share context without manual copy-paste
- Persistent conversation history across all models

## Testing

### Test the bridge system:

```bash
# Terminal 1: Start server
npm run bridge:server

# Terminal 2: Connect client 1
npm run bridge:client

# Terminal 3: Connect client 2
CLAUDE_CLIENT_ID=claude-2 npm run bridge:client

# In client 1:
claude-xxx> @all Hello from client 1

# In client 2 (automatically receives):
[claude-xxx] Hello from client 1
```

### Run automated tests:

```bash
npm run test:bridge
```

## Advanced Usage

### Custom Bridge Server

Create your own bridge with custom logic:

```javascript
import { ClaudeBridge } from './src/claude-bridge.js';

const bridge = new ClaudeBridge();

// Add custom message processing
bridge.onMessage((envelope) => {
  console.log(`Intercepted: ${envelope.message}`);
  // Add AI processing, logging, etc.
});
```

### Programmatic Client

Use the bridge client in your scripts:

```javascript
import { BridgeClient } from './src/claude-bridge-client.js';

const client = new BridgeClient('ws://localhost:3456', 'my-bot');
await client.connect();

client.onMessage((msg) => {
  console.log(`Received: ${msg.message}`);
});

client.broadcast('Script started');
```

## Troubleshooting

### Connection Failed
```
Error: Connection timeout
```
**Solution**: Make sure bridge server is running (`npm run bridge:server`)

### Port Already in Use
```
Error: EADDRINUSE
```
**Solution**: Change port in `.env`:
```bash
BRIDGE_PORT=3500
BRIDGE_HTTP_PORT=3501
```

### Messages Not Received
- Check client is registered: `:clients` command
- Verify WebSocket connection in server logs
- Check firewall settings

## Architecture Details

### Message Envelope Format

```json
{
  "id": "uuid",
  "timestamp": "2025-10-13T12:34:56.789Z",
  "from": "claude-abc",
  "to": "claude-dev",  // optional, null for broadcast
  "message": "Hello world"
}
```

### WebSocket Protocol

**Registration:**
```json
{"type": "register", "clientId": "claude-abc"}
```

**Message:**
```json
{"type": "message", "message": "Hello", "to": "claude-dev"}
```

**Query:**
```json
{"type": "query", "limit": 50}
```

**Response:**
```json
{
  "type": "registered",
  "clientId": "claude-abc",
  "connectedClients": ["claude-abc", "claude-dev"],
  "history": [...]
}
```

## Security Notes

- **Local only by default**: Server binds to localhost
- **No authentication**: Trust all connections (for local dev)
- **Production**: Add auth, SSL/TLS, rate limiting

For production deployment, consider:
- Token-based authentication
- WSS (WebSocket Secure)
- Message encryption
- Rate limiting per client

## Future Enhancements

- [ ] Multi-server federation
- [ ] Persistent message storage
- [ ] Channel/room support
- [ ] Message reactions/threading
- [ ] File transfer support
- [ ] Audio/video bridge
- [ ] Integration with Claude Code MCP

## License

MIT

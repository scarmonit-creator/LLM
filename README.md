# LLM Application

A Node.js application for interacting with Anthropic's Claude LLM, optimized for Jules environment.

## Features

- **Simple API**: Easy-to-use Claude client wrapper
- **Streaming Support**: Real-time streaming responses
- **Multi-turn Conversations**: Context-aware dialogue
- **Environment Configuration**: Flexible setup via environment variables
- **Jules Ready**: Pre-configured for Jules virtual machine environment

## Quick Start

### Prerequisites

- Node.js v18.0.0 or higher
- Anthropic API key

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=your_api_key_here
```

### Usage

Run the application:
```bash
npm start
```

Development mode with auto-reload:
```bash
npm run dev
```

## API Reference

### ClaudeClient

#### `sendMessage(message, systemPrompt?)`

Send a message and receive a complete response.

```javascript
const client = new ClaudeClient();
const response = await client.sendMessage('Hello!');
console.log(response);
```

#### `streamMessage(message, systemPrompt?)`

Stream a response in real-time.

```javascript
await client.streamMessage('Tell me a story');
```

#### `conversation(messages, systemPrompt?)`

Multi-turn conversation with context.

```javascript
const messages = [
  { role: 'user', content: 'What is 5 + 3?' },
  { role: 'assistant', content: '8' },
  { role: 'user', content: 'What is that plus 2?' }
];
const response = await client.conversation(messages);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | *Required* |
| `MODEL` | Claude model to use | `claude-sonnet-4-5-20250929` |
| `MAX_TOKENS` | Maximum tokens in response | `4096` |
| `TEMPERATURE` | Response randomness (0-1) | `1.0` |

## Development

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Jules Environment

This project is configured for Jules virtual machine environments:

- **Setup Script**: `.jules/setup.sh` handles automatic environment configuration
- **Environment Hints**: `agents.md` provides Jules with setup instructions
- **Pre-installed Tools**: Leverages Jules' pre-installed Node.js, npm, eslint, and prettier

### Jules Setup

The Jules environment will automatically:
1. Detect Node.js version
2. Install npm dependencies
3. Run linter checks
4. Execute tests
5. Validate the environment

## Project Structure

```
LLM/
├── .jules/
│   └── setup.sh          # Jules environment setup script
├── src/
│   ├── index.js          # Application entry point
│   └── claude-client.js  # Claude API client wrapper
├── tests/
│   └── claude-client.test.js  # Unit tests
├── agents.md             # Jules environment hints
├── package.json          # Project dependencies
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── eslint.config.js      # ESLint configuration
└── .prettierrc           # Prettier configuration
```

## License

MIT

## Author

Parker Dunn <scarmonit@gmail.com>

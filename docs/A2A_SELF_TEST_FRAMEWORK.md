# A2A Self-Test Framework

## Overview

The **Agent-to-Agent (A2A) Self-Test Framework** is a comprehensive integration testing and self-healing automation system for the LLM Integration Framework. It combines backend services, AI workflow orchestration, WebSocket communication, and intelligent recovery mechanisms to provide a robust, production-ready testing infrastructure.

## Key Features

### 1. Comprehensive Integration Testing
- **A2A Protocol Communication**: Full test coverage for agent registration, message routing, and inter-agent communication
- **Multi-Agent Collaboration**: Validates coordination between multiple AI agents working on collaborative tasks
- **AI Workflow Orchestration**: Tests complex workflows involving Claude, Ollama, and Jules in sequence
- **WebSocket Integration**: Real-time bidirectional communication testing via AI Bridge
- **Performance & Load Testing**: Validates system behavior under concurrent requests and high load

### 2. Self-Healing Automation
- **Automated Diagnosis**: Intelligent scanning of all system components and dependencies
- **Recovery Strategies**: Automatic remediation for common failure scenarios
- **Service Restart**: Automated restart of A2A server, AI Bridge, and Ollama services
- **Dependency Management**: Automatic npm dependency reinstallation when needed
- **Graceful Degradation**: Skip non-critical components that can't be recovered

### 3. CI/CD Integration
- **Multi-Node Testing**: Tests across Node.js 18.x and 20.x
- **Automated Retry**: Failed tests trigger self-healing and automatic retry
- **Daily Validation**: Scheduled runs for continuous system health monitoring
- **Deployment Readiness**: Automated checks before production deployment
- **Comprehensive Reporting**: Detailed test results and recovery logs

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   A2A Self-Test Framework                   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
    │  Test Suite  │ │  Backend  │ │   CI/CD     │
    │              │ │  Services │ │  Pipeline   │
    └───────┬──────┘ └─────┬─────┘ └──────┬──────┘
            │               │               │
    ┌───────▼──────────────▼───────────────▼──────┐
    │        Self-Healing Recovery System         │
    └─────────────────────────────────────────────┘
```

## Components

### 1. Test Suite
**Location**: `tests/integration/a2a-self-test-framework.test.js`

- **A2A Protocol Tests**: Handshake, message routing, agent collaboration
- **Workflow Orchestration Tests**: Multi-LLM workflows, failure handling, retry policies
- **WebSocket Tests**: Connection establishment, message broadcasting, real-time communication
- **Self-Healing Tests**: Service recovery, health checks, auto-recovery mechanisms
- **E2E Tests**: Complete agent-to-agent-to-LLM flow validation
- **Performance Tests**: Concurrent requests, load testing, response time validation

### 2. Enhanced A2A Server
**Location**: `src/enhanced-a2a-server.js`

**Endpoints**:
- `GET /health` - Server health check
- `POST /register` - Agent registration
- `POST /message` - Inter-agent message routing
- `POST /collaborate` - Multi-agent collaboration initiation
- `POST /workflow` - Workflow orchestration
- `GET /workflow/:id` - Workflow status
- `POST /health-check` - Multi-service health validation
- `POST /auto-recover` - Automated recovery trigger
- `POST /e2e-workflow` - End-to-end workflow execution

**Features**:
- Agent registry with capability tracking
- Workflow state management
- Retry policies with exponential backoff
- Health monitoring for all dependencies
- MCP (Model Context Protocol) support

### 3. Collaboration Demo
**Location**: `examples/a2a-collaboration-demo.js`

**Demo Scenarios**:
1. **Basic Communication**: Simple agent-to-agent messaging
2. **Multi-Agent Collaboration**: Coordinated task execution
3. **Workflow Orchestration**: Multi-LLM pipeline processing
4. **End-to-End Flow**: Complete system integration demonstration

**Usage**:
```bash
node examples/a2a-collaboration-demo.js
```

### 4. Self-Healing Recovery
**Location**: `scripts/self-healing-recovery.js`

**Recovery Phases**:
1. **Diagnosis**: Scan all system components
2. **Recovery**: Execute remediation strategies
3. **Reporting**: Generate detailed recovery logs

**Supported Recovery Actions**:
- Reinstall npm dependencies
- Restart A2A server
- Restart AI Bridge
- Restart Ollama service
- Skip non-critical tests
- Pull latest code updates

### 5. CI/CD Workflow
**Location**: `.github/workflows/a2a-self-test-ci.yml`

**Jobs**:
- **a2a-integration-test**: Main test suite with self-healing retry
- **performance-validation**: Load and performance testing
- **e2e-workflow-validation**: End-to-end workflow validation
- **self-healing-validation**: Self-healing capabilities testing
- **deployment-readiness**: Pre-deployment validation
- **notify-results**: Comprehensive reporting

## Installation & Setup

### Prerequisites
```bash
# Node.js >= 18.0.0
node --version

# npm or yarn
npm --version

# Ollama (optional, for local LLM testing)
curl -fsSL https://ollama.ai/install.sh | sh
```

### Installation
```bash
# Install dependencies
npm ci

# Install test dependencies
npm install --save-dev @jest/globals ws node-fetch
```

### Configuration
Create or update `.env`:
```env
# A2A Server
A2A_PORT=3001

# AI Bridge
BRIDGE_PORT=3000
BRIDGE_WS_PORT=8080

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Self-Healing
RECOVERY_MODE=auto
NOTIFICATION_ENABLED=true

# Testing
NODE_ENV=test
```

## Usage

### Running Tests

```bash
# Run complete test suite
npm test -- tests/integration/a2a-self-test-framework.test.js

# Run with coverage
npm run test:coverage -- tests/integration/a2a-self-test-framework.test.js

# Run in watch mode
npm test -- --watch tests/integration/a2a-self-test-framework.test.js
```

### Starting Services

```bash
# Start A2A Server
node src/enhanced-a2a-server.js

# Start AI Bridge (in another terminal)
node src/ai-bridge.js

# Start Ollama (if using local LLM)
ollama serve
```

### Running Demo

```bash
# Make sure services are running first
node examples/a2a-collaboration-demo.js
```

### Manual Self-Healing

```bash
# Run diagnostic and recovery
node scripts/self-healing-recovery.js

# View recovery report
cat self-healing-report.json
```

## Testing Scenarios

### 1. Agent Communication
```javascript
// Register agents
await demo.registerAgent('agent-1', ['research', 'analysis']);
await demo.registerAgent('agent-2', ['coding', 'debugging']);

// Send message
await demo.sendMessage('agent-1', 'agent-2', {
  request: 'code-review',
  data: { /* ... */ }
});
```

### 2. Multi-Agent Collaboration
```javascript
// Initiate collaboration
await demo.initiateCollaboration(
  ['claude-agent', 'ollama-agent', 'coordinator'],
  'Analyze system architecture',
  { system: 'LLM Framework' }
);
```

### 3. Workflow Orchestration
```javascript
// Execute multi-LLM workflow
await demo.executeWorkflow('workflow-1', [
  { provider: 'ollama', action: 'analyze' },
  { provider: 'claude', action: 'refine' },
  { provider: 'ollama', action: 'validate' }
], 'Input data');
```

### 4. Health Monitoring
```javascript
// Check system health
const health = await demo.checkHealth();
console.log(`Active agents: ${health.active_agents}`);
console.log(`Active workflows: ${health.active_workflows}`);
```

## CI/CD Integration

### Automated Testing
The framework automatically runs on:
- Every push to main, feature/*, or develop branches
- All pull requests to main
- Daily at 2 AM UTC (scheduled)
- Manual workflow dispatch

### Self-Healing in CI
When tests fail:
1. CI triggers `scripts/self-healing-recovery.js`
2. System diagnoses issues
3. Recovery strategies are executed
4. Tests are automatically retried
5. Results are reported

### Deployment Validation
Before deployment to production:
1. All test suites must pass
2. Performance metrics validated
3. Self-healing capabilities verified
4. Deployment readiness report generated

## Monitoring & Observability

### Health Endpoints
```bash
# A2A Server health
curl http://localhost:3001/health

# Check specific services
curl -X POST http://localhost:3001/health-check \
  -H "Content-Type: application/json" \
  -d '{"services": ["a2a-server", "ai-bridge", "ollama"]}'
```

### Logs & Reports
- Test results: `coverage/` directory
- Recovery logs: `self-healing-report.json`
- CI artifacts: Available in GitHub Actions

## Performance Benchmarks

| Metric | Target | Current |
|--------|--------|----------|
| Agent registration | < 100ms | ✓ |
| Message routing | < 50ms | ✓ |
| Workflow initiation | < 200ms | ✓ |
| Concurrent agents | 50+ | ✓ |
| Load test (50 requests) | < 10s | ✓ |

## Troubleshooting

### Common Issues

**Tests failing with "Connection refused"**
```bash
# Check if services are running
ps aux | grep "node.*a2a\|node.*bridge"

# Restart services
node scripts/self-healing-recovery.js
```

**Ollama tests failing**
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama
systemctl restart ollama

# Or skip Ollama tests
export SKIP_OLLAMA_TESTS=true
```

**Self-healing not working**
```bash
# Run in manual mode
RECOVERY_MODE=manual node scripts/self-healing-recovery.js

# Check diagnostics
cat self-healing-report.json | jq '.diagnostics'
```

## Contributing

Contributions are welcome! Please:
1. Add tests for new features
2. Ensure self-healing strategies are robust
3. Update documentation
4. Follow existing patterns

## Roadmap

- [ ] Add Redis-based agent state persistence
- [ ] Implement distributed workflow orchestration
- [ ] Add Prometheus metrics export
- [ ] Create Grafana dashboards
- [ ] Add support for additional LLM providers
- [ ] Implement agent capability discovery
- [ ] Add workflow versioning and rollback
- [ ] Create web-based monitoring dashboard

## License

MIT License - See [LICENSE](../LICENSE) for details

## Acknowledgments

- Built on the LLM Integration Framework
- Uses Model Context Protocol (MCP) for A2A communication
- Inspired by autonomous agent systems research

---

**Status**: ✅ Production Ready

**Version**: 1.0.0

**Last Updated**: October 14, 2025

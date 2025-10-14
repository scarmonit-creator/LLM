/**
 * Enhanced A2A Agent Server with Self-Healing and Workflow Orchestration
 * Extends the base A2A server with advanced features for testing and automation
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.A2A_PORT || 3001;

app.use(express.json());

// Agent registry for tracking connected agents
const agentRegistry = new Map();
const activeWorkflows = new Map();
const healthChecks = new Map();

// Middleware for logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    protocol: 'MCP',
    timestamp: new Date().toISOString(),
    active_agents: agentRegistry.size,
    active_workflows: activeWorkflows.size
  });
});

// Agent registration
app.post('/register', (req, res) => {
  const { agent_id, capabilities, metadata } = req.body;
  
  if (!agent_id) {
    return res.status(400).json({ error: 'agent_id is required' });
  }
  
  agentRegistry.set(agent_id, {
    capabilities: capabilities || [],
    metadata: metadata || {},
    registered_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: 'active'
  });
  
  res.json({
    registered: true,
    agent_id,
    registry_size: agentRegistry.size
  });
});

// Message routing between agents
app.post('/message', async (req, res) => {
  const { type, from, to, payload } = req.body;
  
  if (!from || !to || !payload) {
    return res.status(400).json({ error: 'Missing required fields: from, to, payload' });
  }
  
  const targetAgent = agentRegistry.get(to);
  
  if (!targetAgent) {
    return res.status(404).json({ 
      error: 'Target agent not found',
      delivered: false,
      available_agents: Array.from(agentRegistry.keys())
    });
  }
  
  // Simulate message delivery
  targetAgent.last_seen = new Date().toISOString();
  agentRegistry.set(to, targetAgent);
  
  res.json({
    delivered: true,
    message_id: `msg-${Date.now()}`,
    from,
    to,
    timestamp: new Date().toISOString()
  });
});

// Multi-agent collaboration
app.post('/collaborate', async (req, res) => {
  const { type, agents, task, data } = req.body;
  
  if (!agents || !Array.isArray(agents) || agents.length === 0) {
    return res.status(400).json({ error: 'agents array is required' });
  }
  
  const collaboration_id = `collab-${Date.now()}`;
  const participating_agents = agents.filter(agent => agentRegistry.has(agent));
  
  if (participating_agents.length === 0) {
    return res.status(404).json({ 
      error: 'No registered agents found',
      requested_agents: agents,
      available_agents: Array.from(agentRegistry.keys())
    });
  }
  
  // Store collaboration session
  activeWorkflows.set(collaboration_id, {
    type: 'collaboration',
    participating_agents,
    task,
    data,
    started_at: new Date().toISOString(),
    status: 'active'
  });
  
  res.json({
    collaboration_id,
    participating_agents,
    task,
    status: 'initiated'
  });
});

// Workflow orchestration
app.post('/workflow', async (req, res) => {
  const { id, steps, input, retry_policy } = req.body;
  
  if (!id || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'workflow id and steps array are required' });
  }
  
  const workflow = {
    id,
    steps,
    input,
    retry_policy: retry_policy || { max_retries: 3, backoff: 'exponential' },
    created_at: new Date().toISOString(),
    status: 'initiated',
    current_step: 0,
    retry_count: 0
  };
  
  // Validate steps
  const validProviders = ['claude', 'ollama', 'jules'];
  const invalidSteps = steps.filter(step => 
    !validProviders.includes(step.provider)
  );
  
  if (invalidSteps.length > 0) {
    workflow.status = 'failed';
    workflow.error = 'Invalid provider in workflow steps';
    workflow.invalid_steps = invalidSteps;
    
    // Check retry policy
    if (workflow.retry_count < workflow.retry_policy.max_retries) {
      workflow.status = 'retrying';
      workflow.retry_count++;
      workflow.next_retry_at = new Date(Date.now() + Math.pow(2, workflow.retry_count) * 1000).toISOString();
    }
  }
  
  activeWorkflows.set(id, workflow);
  
  res.json({
    workflow_id: id,
    status: workflow.status,
    current_step: workflow.current_step,
    retry_count: workflow.retry_count,
    next_retry_at: workflow.next_retry_at
  });
});

// Get workflow status
app.get('/workflow/:id', (req, res) => {
  const { id } = req.params;
  const workflow = activeWorkflows.get(id);
  
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  
  res.json(workflow);
});

// Health check for multiple services
app.post('/health-check', async (req, res) => {
  const { services, recovery_enabled } = req.body;
  
  const healthStatus = {
    timestamp: new Date().toISOString(),
    services: {},
    all_healthy: true
  };
  
  for (const service of services || []) {
    let status = 'healthy';
    
    // Simulate health checks
    switch (service) {
      case 'a2a-server':
        status = 'healthy';
        break;
      case 'ai-bridge':
        status = await checkAIBridge() ? 'healthy' : 'degraded';
        break;
      case 'ollama':
        status = await checkOllama() ? 'healthy' : 'unavailable';
        break;
      default:
        status = 'unknown';
    }
    
    healthStatus.services[service] = {
      status,
      last_check: new Date().toISOString(),
      recovery_enabled
    };
    
    if (status !== 'healthy') {
      healthStatus.all_healthy = false;
    }
  }
  
  res.json(healthStatus);
});

// Auto-recovery endpoint
app.post('/auto-recover', async (req, res) => {
  const { component, issue, auto_fix } = req.body;
  
  const recovery = {
    component,
    issue,
    recovery_attempted: auto_fix || false,
    timestamp: new Date().toISOString()
  };
  
  if (auto_fix) {
    // Determine recovery strategy
    switch (component) {
      case 'ollama':
        recovery.recovery_strategy = 'restart_service';
        recovery.actions = ['check_process', 'restart_if_needed', 'verify_connection'];
        recovery.estimated_time = '30s';
        break;
      case 'ai-bridge':
        recovery.recovery_strategy = 'reconnect_websocket';
        recovery.actions = ['close_stale_connections', 'reinitialize_bridge'];
        recovery.estimated_time = '10s';
        break;
      default:
        recovery.recovery_strategy = 'manual_intervention_required';
        recovery.actions = ['notify_admin'];
    }
    
    // Log recovery attempt
    healthChecks.set(`recovery-${Date.now()}`, recovery);
  }
  
  res.json(recovery);
});

// End-to-end workflow execution
app.post('/e2e-workflow', async (req, res) => {
  const { agent_id, workflow, query } = req.body;
  
  if (!agent_id || !workflow || !query) {
    return res.status(400).json({ error: 'agent_id, workflow, and query are required' });
  }
  
  const execution = {
    agent_id,
    workflow_name: workflow.name,
    query,
    started_at: new Date().toISOString(),
    steps_executed: 0,
    workflow_completed: false
  };
  
  // Simulate workflow execution
  for (const step of workflow.steps) {
    console.log(`Executing step: ${step.stage} - ${step.action}`);
    execution.steps_executed++;
    
    // Simulate step execution time
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  execution.workflow_completed = execution.steps_executed === workflow.steps.length;
  execution.completed_at = new Date().toISOString();
  execution.final_response = {
    success: true,
    query,
    result: `Processed query through ${execution.steps_executed} stages`,
    execution_time: `${Date.now() - new Date(execution.started_at).getTime()}ms`
  };
  
  res.json(execution);
});

// Helper functions
async function checkAIBridge() {
  try {
    const response = await fetch(`http://localhost:${process.env.BRIDGE_PORT || 3000}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function checkOllama() {
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`Enhanced A2A Server running on port ${PORT}`);
  console.log(`Protocol: MCP (Model Context Protocol)`);
  console.log(`Features:`);
  console.log(`  - Agent registration and routing`);
  console.log(`  - Multi-agent collaboration`);
  console.log(`  - Workflow orchestration`);
  console.log(`  - Self-healing automation`);
  console.log(`  - Health monitoring`);
});

export default app;
export { agentRegistry, activeWorkflows, healthChecks };

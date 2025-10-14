/**
 * A2A Collaboration Demo
 * Demonstrates multi-agent collaboration with AI workflow orchestration
 * Shows practical usage of the A2A self-test framework
 */

import fetch from 'node-fetch';
import { ClaudeClient } from '../src/claude-client.js';
import { OllamaDemo } from '../src/ollama-demo.js';

const A2A_SERVER_URL = process.env.A2A_SERVER_URL || 'http://localhost:3001';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  agent: (name, msg) => console.log(`${colors.cyan}[${name}]${colors.reset} ${msg}`),
  workflow: (msg) => console.log(`${colors.magenta}→${colors.reset} ${msg}`)
};

class A2ACollaborationDemo {
  constructor() {
    this.agents = new Map();
  }

  async registerAgent(agentId, capabilities) {
    log.info(`Registering agent: ${agentId}`);
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          capabilities,
          metadata: {
            version: '1.0.0',
            registered_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to register agent: ${response.statusText}`);
      }

      const result = await response.json();
      this.agents.set(agentId, { capabilities, status: 'active' });
      log.success(`Agent ${agentId} registered successfully`);
      return result;
    } catch (error) {
      log.warning(`Failed to register agent ${agentId}: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(from, to, payload) {
    log.agent(from, `Sending message to ${to}`);
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'query',
          from,
          to,
          payload
        })
      });

      if (!response.ok) {
        throw new Error(`Message delivery failed: ${response.statusText}`);
      }

      const result = await response.json();
      log.success(`Message delivered: ${result.message_id}`);
      return result;
    } catch (error) {
      log.warning(`Message delivery failed: ${error.message}`);
      throw error;
    }
  }

  async initiateCollaboration(agents, task, data) {
    log.workflow(`Initiating collaboration: ${task}`);
    log.info(`Participating agents: ${agents.join(', ')}`);
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/collaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'collaborative-task',
          agents,
          task,
          data
        })
      });

      if (!response.ok) {
        throw new Error(`Collaboration failed: ${response.statusText}`);
      }

      const result = await response.json();
      log.success(`Collaboration initiated: ${result.collaboration_id}`);
      log.info(`Active participants: ${result.participating_agents.length}`);
      return result;
    } catch (error) {
      log.warning(`Collaboration initiation failed: ${error.message}`);
      throw error;
    }
  }

  async executeWorkflow(workflowId, steps, input) {
    log.workflow(`Executing workflow: ${workflowId}`);
    log.info(`Total steps: ${steps.length}`);
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflowId,
          steps,
          input,
          retry_policy: {
            max_retries: 3,
            backoff: 'exponential'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Workflow execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      log.success(`Workflow ${result.workflow_id} status: ${result.status}`);
      
      if (result.status === 'retrying') {
        log.warning(`Workflow is retrying (attempt ${result.retry_count})`);
      }
      
      return result;
    } catch (error) {
      log.warning(`Workflow execution failed: ${error.message}`);
      throw error;
    }
  }

  async runE2EWorkflow(agentId, workflowName, query) {
    log.workflow(`Running E2E workflow: ${workflowName}`);
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/e2e-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          workflow: {
            name: workflowName,
            steps: [
              { stage: 'a2a-routing', action: 'route_to_specialist' },
              { stage: 'bridge-coordination', action: 'coordinate_llms' },
              { stage: 'llm-execution', action: 'execute_query' },
              { stage: 'response-aggregation', action: 'aggregate_results' }
            ]
          },
          query
        })
      });

      if (!response.ok) {
        throw new Error(`E2E workflow failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.workflow_completed) {
        log.success(`Workflow completed in ${result.final_response.execution_time}`);
        log.success(`Steps executed: ${result.steps_executed}`);
        log.info(`Result: ${result.final_response.result}`);
      } else {
        log.warning(`Workflow incomplete`);
      }
      
      return result;
    } catch (error) {
      log.warning(`E2E workflow failed: ${error.message}`);
      throw error;
    }
  }

  async checkHealth() {
    log.info('Checking A2A server health...');
    
    try {
      const response = await fetch(`${A2A_SERVER_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const health = await response.json();
      log.success(`Server status: ${health.status}`);
      log.info(`Protocol: ${health.protocol}`);
      log.info(`Active agents: ${health.active_agents}`);
      log.info(`Active workflows: ${health.active_workflows}`);
      
      return health;
    } catch (error) {
      log.warning(`Health check failed: ${error.message}`);
      throw error;
    }
  }
}

// Demo scenarios
async function demoBasicCommunication(demo) {
  console.log(`\n${colors.bright}=== Demo 1: Basic Agent Communication ===${colors.reset}\n`);
  
  await demo.registerAgent('research-agent', ['research', 'analysis', 'summarization']);
  await demo.registerAgent('coding-agent', ['code-generation', 'debugging', 'refactoring']);
  
  await demo.sendMessage(
    'research-agent',
    'coding-agent',
    { 
      request: 'code-review',
      code: 'function add(a, b) { return a + b; }'
    }
  );
}

async function demoMultiAgentCollaboration(demo) {
  console.log(`\n${colors.bright}=== Demo 2: Multi-Agent Collaboration ===${colors.reset}\n`);
  
  await demo.registerAgent('claude-agent', ['reasoning', 'analysis']);
  await demo.registerAgent('ollama-agent', ['local-processing', 'inference']);
  await demo.registerAgent('coordinator-agent', ['orchestration', 'routing']);
  
  await demo.initiateCollaboration(
    ['claude-agent', 'ollama-agent', 'coordinator-agent'],
    'Analyze system architecture and suggest improvements',
    {
      system: 'LLM Integration Framework',
      focus_areas: ['performance', 'scalability', 'maintainability']
    }
  );
}

async function demoWorkflowOrchestration(demo) {
  console.log(`\n${colors.bright}=== Demo 3: AI Workflow Orchestration ===${colors.reset}\n`);
  
  const workflow = [
    { provider: 'ollama', action: 'initial_analysis', model: 'llama2' },
    { provider: 'claude', action: 'refinement' },
    { provider: 'ollama', action: 'validation' }
  ];
  
  await demo.executeWorkflow(
    'multi-llm-workflow-1',
    workflow,
    'Explain the concept of agent-to-agent communication in AI systems'
  );
}

async function demoEndToEndFlow(demo) {
  console.log(`\n${colors.bright}=== Demo 4: End-to-End Agent Flow ===${colors.reset}\n`);
  
  await demo.registerAgent('orchestrator-agent', ['orchestration', 'coordination']);
  
  await demo.runE2EWorkflow(
    'orchestrator-agent',
    'complete-ai-pipeline',
    'What are the benefits of multi-agent systems in AI?'
  );
}

// Main execution
async function main() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  A2A Collaboration & Orchestration Demo   ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════╝${colors.reset}\n`);
  
  const demo = new A2ACollaborationDemo();
  
  try {
    // Check server health
    await demo.checkHealth();
    
    // Run demos
    await demoBasicCommunication(demo);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoMultiAgentCollaboration(demo);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoWorkflowOrchestration(demo);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoEndToEndFlow(demo);
    
    console.log(`\n${colors.green}${colors.bright}✓ All demos completed successfully!${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.yellow}${colors.bright}✗ Demo failed: ${error.message}${colors.reset}\n`);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default A2ACollaborationDemo;
export { log, colors };

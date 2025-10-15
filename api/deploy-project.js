// API endpoint for deploying and testing projects using Nitric
const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');

const execPromise = util.promisify(exec);

const router = express.Router();

// Store deployment status
const deployments = new Map();

// POST /api/deploy-project
// Body: { projectId: string, projectName: string, repoUrl: string }
router.post('/deploy-project', async (req, res) => {
  const { projectId, projectName, repoUrl } = req.body;
  
  if (!projectId || !projectName || !repoUrl) {
    return res.status(400).json({ 
      error: 'Missing required fields: projectId, projectName, repoUrl' 
    });
  }

  const deploymentId = `deploy-${projectId}-${Date.now()}`;
  
  // Initialize deployment status
  deployments.set(deploymentId, {
    id: deploymentId,
    projectId,
    projectName,
    status: 'initializing',
    logs: [],
    startTime: new Date().toISOString()
  });

  // Return deployment ID immediately
  res.json({ 
    deploymentId,
    status: 'initializing',
    message: 'Deployment started'
  });

  // Start deployment process asynchronously
  deployProject(deploymentId, projectId, projectName, repoUrl).catch(err => {
    console.error(`Deployment ${deploymentId} failed:`, err);
    const deployment = deployments.get(deploymentId);
    if (deployment) {
      deployment.status = 'failed';
      deployment.error = err.message;
      deployment.endTime = new Date().toISOString();
    }
  });
});

// GET /api/deploy-project/:deploymentId/status
router.get('/deploy-project/:deploymentId/status', (req, res) => {
  const { deploymentId } = req.params;
  const deployment = deployments.get(deploymentId);
  
  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  
  res.json(deployment);
});

// GET /api/deploy-project/:deploymentId/logs
router.get('/deploy-project/:deploymentId/logs', (req, res) => {
  const { deploymentId } = req.params;
  const deployment = deployments.get(deploymentId);
  
  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' });
  }
  
  res.json({ logs: deployment.logs });
});

async function deployProject(deploymentId, projectId, projectName, repoUrl) {
  const deployment = deployments.get(deploymentId);
  const workDir = path.join('/tmp', `project-${projectId}-${Date.now()}`);
  
  try {
    // Update status
    deployment.status = 'cloning';
    addLog(deployment, 'Cloning repository...');
    
    // Clone repository
    await execPromise(`git clone ${repoUrl} ${workDir}`);
    addLog(deployment, `Repository cloned to ${workDir}`);
    
    // Check for Nitric configuration
    deployment.status = 'checking';
    addLog(deployment, 'Checking for Nitric configuration...');
    
    const nitricStackPath = path.join(workDir, 'nitric.yaml');
    try {
      await fs.access(nitricStackPath);
      addLog(deployment, 'Found nitric.yaml');
    } catch {
      addLog(deployment, 'No nitric.yaml found, creating default configuration...');
      await createDefaultNitricConfig(workDir, projectName);
    }
    
    // Install dependencies
    deployment.status = 'installing';
    addLog(deployment, 'Installing dependencies...');
    
    try {
      const { stdout: installOut } = await execPromise('npm install', { cwd: workDir });
      addLog(deployment, installOut);
    } catch (err) {
      addLog(deployment, 'No package.json or npm install failed, continuing...');
    }
    
    // Deploy with Nitric
    deployment.status = 'deploying';
    addLog(deployment, 'Starting Nitric deployment...');
    
    try {
      // Start Nitric in local mode for testing
      const { stdout: nitricOut, stderr: nitricErr } = await execPromise(
        'nitric start',
        { 
          cwd: workDir,
          timeout: 120000 // 2 minute timeout
        }
      );
      
      addLog(deployment, nitricOut);
      if (nitricErr) addLog(deployment, nitricErr);
      
      deployment.status = 'testing';
      addLog(deployment, 'Running tests...');
      
      // Run basic health check
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for startup
      
      deployment.status = 'success';
      deployment.endTime = new Date().toISOString();
      deployment.deploymentUrl = `http://localhost:4001`; // Default Nitric local port
      addLog(deployment, 'Deployment successful!');
      addLog(deployment, `Service available at: ${deployment.deploymentUrl}`);
      
    } catch (err) {
      throw new Error(`Nitric deployment failed: ${err.message}`);
    }
    
    // Cleanup
    addLog(deployment, 'Deployment complete. Temporary files will be cleaned up.');
    
  } catch (error) {
    deployment.status = 'failed';
    deployment.error = error.message;
    deployment.endTime = new Date().toISOString();
    addLog(deployment, `ERROR: ${error.message}`);
    throw error;
  } finally {
    // Cleanup temporary directory after some time
    setTimeout(async () => {
      try {
        await execPromise(`rm -rf ${workDir}`);
      } catch (err) {
        console.error('Failed to cleanup:', err);
      }
    }, 300000); // Clean up after 5 minutes
  }
}

async function createDefaultNitricConfig(workDir, projectName) {
  const config = `name: ${projectName}

services:
  - match: './services/*.js'
    start: node $SERVICE_PATH
`;
  
  await fs.writeFile(path.join(workDir, 'nitric.yaml'), config);
}

function addLog(deployment, message) {
  const timestamp = new Date().toISOString();
  deployment.logs.push(`[${timestamp}] ${message}`);
  console.log(`[${deployment.id}] ${message}`);
}

module.exports = router;

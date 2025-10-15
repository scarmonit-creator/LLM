#!/usr/bin/env node

/**
 * ⚡ Project Deployer - Autonomous Deployment Engine
 * 
 * Enables one-click deployment of AI/ML projects from the cataloged
 * projects index with full automation and monitoring.
 * 
 * Features:
 * - Rapid project cloning and environment setup
 * - Nitric cloud integration for scalable deployment
 * - Real-time deployment monitoring and logging
 * - Auto-rollback on deployment failures
 * - Email notifications and status updates
 * - Dashboard integration for status tracking
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const Docker = require('dockerode');
const crypto = require('crypto');
const EventEmitter = require('events');

class ProjectDeployer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      tempDir: options.tempDir || path.join(__dirname, '..', 'temp'),
      experimentsDir: options.experimentsDir || path.join(__dirname, '..', 'experiments'),
      nitricEndpoint: options.nitricEndpoint || process.env.NITRIC_ENDPOINT,
      emailService: options.emailService || process.env.EMAIL_SERVICE_URL,
      dashboardUrl: options.dashboardUrl || 'https://www.scarmonit.com',
      maxConcurrentDeployments: options.maxConcurrent || 3,
      deploymentTimeout: options.timeout || 900000, // 15 minutes
      cleanupOnSuccess: options.cleanup !== false
    };
    
    this.docker = new Docker();
    this.activeDeployments = new Map();
    this.deploymentQueue = [];
    this.deploymentStats = {
      total: 0,
      successful: 0,
      failed: 0,
      active: 0
    };
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for deployment lifecycle
   */
  setupEventHandlers() {
    this.on('deployment:started', this.handleDeploymentStarted.bind(this));
    this.on('deployment:progress', this.handleDeploymentProgress.bind(this));
    this.on('deployment:completed', this.handleDeploymentCompleted.bind(this));
    this.on('deployment:failed', this.handleDeploymentFailed.bind(this));
    this.on('deployment:timeout', this.handleDeploymentTimeout.bind(this));
  }

  /**
   * Deploy a project from the AI projects catalog
   */
  async deployProject(projectConfig, options = {}) {
    const deploymentId = this.generateDeploymentId();
    
    console.log(`🚀 Starting deployment: ${deploymentId}`);
    console.log(`💻 Project: ${projectConfig.title}`);
    console.log(`🔗 Repository: ${projectConfig.url}`);
    
    try {
      // Validate project configuration
      this.validateProjectConfig(projectConfig);
      
      // Check deployment queue capacity
      if (this.activeDeployments.size >= this.config.maxConcurrentDeployments) {
        return this.queueDeployment(projectConfig, options);
      }
      
      // Initialize deployment context
      const deployment = await this.initializeDeployment(deploymentId, projectConfig, options);
      this.activeDeployments.set(deploymentId, deployment);
      
      // Emit deployment started event
      this.emit('deployment:started', deployment);
      
      // Execute deployment pipeline
      const result = await this.executeDeploymentPipeline(deployment);
      
      // Handle successful deployment
      this.emit('deployment:completed', { ...deployment, result });
      
      return result;
      
    } catch (error) {
      console.error(`❌ Deployment ${deploymentId} failed:`, error.message);
      
      // Handle deployment failure
      this.emit('deployment:failed', { 
        deploymentId, 
        projectConfig, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    } finally {
      // Cleanup deployment context
      this.activeDeployments.delete(deploymentId);
      this.processDeploymentQueue();
    }
  }

  /**
   * Initialize deployment context with all necessary metadata
   */
  async initializeDeployment(deploymentId, projectConfig, options) {
    const deployment = {
      id: deploymentId,
      project: projectConfig,
      options,
      status: 'initializing',
      startTime: new Date(),
      progress: 0,
      logs: [],
      environment: null,
      endpoints: [],
      tempPath: path.join(this.config.tempDir, deploymentId),
      experimentPath: path.join(this.config.experimentsDir, deploymentId)
    };
    
    // Create deployment directories
    await fs.mkdir(deployment.tempPath, { recursive: true });
    await fs.mkdir(deployment.experimentPath, { recursive: true });
    
    // Generate deployment metadata
    deployment.metadata = {
      estimatedDuration: projectConfig.deploymentConfig?.estimatedDeployTime || '2-5 minutes',
      complexity: projectConfig.deploymentConfig?.complexity || 'medium',
      strategy: projectConfig.deploymentConfig?.deploymentStrategy || 'docker-container',
      resources: projectConfig.deploymentConfig?.requirements?.resources || {},
      runtime: projectConfig.deploymentConfig?.requirements?.runtime || 'node:18'
    };
    
    this.log(deployment, `Deployment ${deploymentId} initialized`);
    return deployment;
  }

  /**
   * Execute the complete deployment pipeline
   */
  async executeDeploymentPipeline(deployment) {
    const pipeline = [
      { name: 'clone', handler: this.cloneRepository, weight: 10 },
      { name: 'analyze', handler: this.analyzeProject, weight: 15 },
      { name: 'prepare', handler: this.prepareEnvironment, weight: 20 },
      { name: 'build', handler: this.buildProject, weight: 30 },
      { name: 'deploy', handler: this.deployToCloud, weight: 20 },
      { name: 'verify', handler: this.verifyDeployment, weight: 5 }
    ];
    
    let accumulatedProgress = 0;
    
    for (const step of pipeline) {
      try {
        this.log(deployment, `Executing step: ${step.name}`);
        deployment.status = step.name;
        
        // Execute pipeline step
        const stepResult = await step.handler.call(this, deployment);
        
        // Update progress
        accumulatedProgress += step.weight;
        deployment.progress = accumulatedProgress;
        
        this.emit('deployment:progress', {
          deploymentId: deployment.id,
          step: step.name,
          progress: deployment.progress,
          result: stepResult
        });
        
        this.log(deployment, `Completed step: ${step.name}`);
        
      } catch (error) {
        this.log(deployment, `Failed step: ${step.name} - ${error.message}`);
        
        // Attempt rollback if possible
        if (step.name !== 'clone') {
          await this.rollbackDeployment(deployment, step.name);
        }
        
        throw new Error(`Deployment failed at step '${step.name}': ${error.message}`);
      }
    }
    
    // Mark deployment as complete
    deployment.status = 'completed';
    deployment.progress = 100;
    deployment.completionTime = new Date();
    deployment.duration = deployment.completionTime - deployment.startTime;
    
    return {
      deploymentId: deployment.id,
      status: 'success',
      endpoints: deployment.endpoints,
      duration: deployment.duration,
      logs: deployment.logs.slice(-10), // Last 10 log entries
      metadata: deployment.metadata
    };
  }

  /**
   * Clone the repository to the temporary directory
   */
  async cloneRepository(deployment) {
    const { project, tempPath } = deployment;
    
    this.log(deployment, `Cloning repository: ${project.url}`);
    
    // Clone with shallow depth for faster cloning
    await this.executeCommand('git', [
      'clone',
      '--depth', '1',
      project.url,
      tempPath
    ]);
    
    // Verify clone success
    const stats = await fs.stat(tempPath);
    if (!stats.isDirectory()) {
      throw new Error('Repository clone failed - directory not created');
    }
    
    this.log(deployment, 'Repository cloned successfully');
    return { clonePath: tempPath };
  }

  /**
   * Analyze the project structure and requirements
   */
  async analyzeProject(deployment) {
    const { tempPath } = deployment;
    
    this.log(deployment, 'Analyzing project structure...');
    
    // Read directory contents
    const files = await fs.readdir(tempPath);
    
    // Detect project type and dependencies
    const analysis = {
      projectType: await this.detectProjectType(tempPath, files),
      dependencies: await this.analyzeDependencies(tempPath, files),
      entryPoints: await this.findEntryPoints(tempPath, files),
      dockerSupport: files.includes('Dockerfile'),
      configFiles: files.filter(f => this.isConfigFile(f))
    };
    
    deployment.analysis = analysis;
    this.log(deployment, `Project analysis complete: ${analysis.projectType}`);
    
    return analysis;
  }

  /**
   * Prepare the deployment environment
   */
  async prepareEnvironment(deployment) {
    const { analysis, metadata } = deployment;
    
    this.log(deployment, 'Preparing deployment environment...');
    
    // Generate environment configuration
    const environment = {
      runtime: metadata.runtime,
      ports: await this.detectRequiredPorts(deployment),
      environment: await this.generateEnvironmentVariables(deployment),
      volumes: await this.generateVolumeConfig(deployment),
      healthCheck: await this.generateHealthCheck(deployment)
    };
    
    // Generate Dockerfile if not present
    if (!analysis.dockerSupport) {
      await this.generateDockerfile(deployment, environment);
    }
    
    // Generate docker-compose for complex setups
    if (analysis.projectType === 'complex') {
      await this.generateDockerCompose(deployment, environment);
    }
    
    deployment.environment = environment;
    this.log(deployment, 'Environment preparation complete');
    
    return environment;
  }

  /**
   * Build the project using the appropriate build system
   */
  async buildProject(deployment) {
    const { tempPath, analysis, environment } = deployment;
    
    this.log(deployment, 'Building project...');
    
    let buildResult;
    
    switch (analysis.projectType) {
      case 'nodejs':
        buildResult = await this.buildNodeProject(deployment);
        break;
      case 'python':
        buildResult = await this.buildPythonProject(deployment);
        break;
      case 'docker':
        buildResult = await this.buildDockerProject(deployment);
        break;
      default:
        buildResult = await this.buildGenericProject(deployment);
    }
    
    this.log(deployment, 'Project build complete');
    return buildResult;
  }

  /**
   * Deploy the built project to cloud infrastructure
   */
  async deployToCloud(deployment) {
    const { metadata } = deployment;
    
    this.log(deployment, 'Deploying to cloud infrastructure...');
    
    let deployResult;
    
    switch (metadata.strategy) {
      case 'serverless':
        deployResult = await this.deployServerless(deployment);
        break;
      case 'nitric-container':
        deployResult = await this.deployToNitric(deployment);
        break;
      case 'docker-container':
        deployResult = await this.deployDockerContainer(deployment);
        break;
      default:
        throw new Error(`Unknown deployment strategy: ${metadata.strategy}`);
    }
    
    deployment.endpoints = deployResult.endpoints || [];
    this.log(deployment, `Cloud deployment complete. Endpoints: ${deployment.endpoints.join(', ')}`);
    
    return deployResult;
  }

  /**
   * Verify the deployment is working correctly
   */
  async verifyDeployment(deployment) {
    const { endpoints } = deployment;
    
    this.log(deployment, 'Verifying deployment...');
    
    const verificationResults = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, { timeout: 10000 });
        verificationResults.push({
          endpoint,
          status: 'healthy',
          statusCode: response.status,
          responseTime: response.headers['x-response-time'] || 'unknown'
        });
      } catch (error) {
        verificationResults.push({
          endpoint,
          status: 'unhealthy',
          error: error.message
        });
      }
    }
    
    const healthyCount = verificationResults.filter(r => r.status === 'healthy').length;
    const overallHealth = healthyCount > 0 ? 'healthy' : 'unhealthy';
    
    this.log(deployment, `Verification complete: ${healthyCount}/${endpoints.length} endpoints healthy`);
    
    return {
      overallHealth,
      endpoints: verificationResults,
      healthyCount,
      totalEndpoints: endpoints.length
    };
  }

  /**
   * Build Node.js project
   */
  async buildNodeProject(deployment) {
    const { tempPath } = deployment;
    
    // Install dependencies
    if (await this.fileExists(path.join(tempPath, 'package.json'))) {
      await this.executeCommand('npm', ['install'], { cwd: tempPath });
    }
    
    // Run build script if available
    if (await this.hasNpmScript(tempPath, 'build')) {
      await this.executeCommand('npm', ['run', 'build'], { cwd: tempPath });
    }
    
    return { buildType: 'nodejs', success: true };
  }

  /**
   * Build Python project
   */
  async buildPythonProject(deployment) {
    const { tempPath } = deployment;
    
    // Install dependencies
    if (await this.fileExists(path.join(tempPath, 'requirements.txt'))) {
      await this.executeCommand('pip', ['install', '-r', 'requirements.txt'], { cwd: tempPath });
    }
    
    return { buildType: 'python', success: true };
  }

  /**
   * Build Docker project
   */
  async buildDockerProject(deployment) {
    const { tempPath, id } = deployment;
    const imageName = `llm-project-${id.toLowerCase()}`;
    
    // Build Docker image
    await this.executeCommand('docker', ['build', '-t', imageName, '.'], { cwd: tempPath });
    
    deployment.dockerImage = imageName;
    return { buildType: 'docker', imageName, success: true };
  }

  /**
   * Build generic project
   */
  async buildGenericProject(deployment) {
    const { tempPath } = deployment;
    
    // Try to find and execute common build commands
    const buildCommands = [
      { cmd: 'make', args: [] },
      { cmd: 'mvn', args: ['compile'] },
      { cmd: 'gradle', args: ['build'] }
    ];
    
    for (const build of buildCommands) {
      try {
        if (await this.commandExists(build.cmd)) {
          await this.executeCommand(build.cmd, build.args, { cwd: tempPath });
          return { buildType: 'generic', buildCommand: build.cmd, success: true };
        }
      } catch (error) {
        // Continue to next build option
      }
    }
    
    return { buildType: 'generic', success: true, note: 'No build step required' };
  }

  /**
   * Deploy to Nitric cloud platform
   */
  async deployToNitric(deployment) {
    const { id, project, environment } = deployment;
    
    if (!this.config.nitricEndpoint) {
      throw new Error('Nitric endpoint not configured');
    }
    
    // Generate Nitric deployment configuration
    const nitricConfig = {
      name: `llm-project-${id.toLowerCase()}`,
      image: deployment.dockerImage,
      environment: environment.environment,
      ports: environment.ports,
      resources: deployment.metadata.resources
    };
    
    // Deploy via Nitric API
    const response = await axios.post(`${this.config.nitricEndpoint}/deploy`, nitricConfig);
    
    return {
      provider: 'nitric',
      deploymentId: response.data.deploymentId,
      endpoints: response.data.endpoints || [],
      status: response.data.status
    };
  }

  /**
   * Deploy as Docker container
   */
  async deployDockerContainer(deployment) {
    const { id, dockerImage, environment } = deployment;
    
    // Run container with generated configuration
    const container = await this.docker.createContainer({
      Image: dockerImage,
      name: `llm-project-${id.toLowerCase()}`,
      Env: Object.entries(environment.environment).map(([k, v]) => `${k}=${v}`),
      PortBindings: this.generatePortBindings(environment.ports),
      RestartPolicy: { Name: 'unless-stopped' }
    });
    
    await container.start();
    
    const containerInfo = await container.inspect();
    const endpoints = this.extractContainerEndpoints(containerInfo);
    
    return {
      provider: 'docker',
      containerId: container.id,
      endpoints,
      status: 'running'
    };
  }

  /**
   * Rollback deployment on failure
   */
  async rollbackDeployment(deployment, failedStep) {
    this.log(deployment, `Rolling back deployment after failure at: ${failedStep}`);
    
    try {
      // Stop any running containers
      if (deployment.dockerImage) {
        await this.cleanupDockerResources(deployment);
      }
      
      // Clean up cloud resources if deployed
      if (deployment.endpoints?.length > 0) {
        await this.cleanupCloudResources(deployment);
      }
      
      this.log(deployment, 'Rollback completed');
    } catch (error) {
      this.log(deployment, `Rollback failed: ${error.message}`);
    }
  }

  /**
   * Event handlers for deployment lifecycle
   */
  async handleDeploymentStarted(deployment) {
    this.deploymentStats.total++;
    this.deploymentStats.active++;
    
    // Send notification email
    await this.sendNotificationEmail({
      type: 'deployment_started',
      deployment,
      subject: `Deployment Started: ${deployment.project.title}`,
      message: `Deployment ${deployment.id} has been started for project ${deployment.project.title}`
    });
    
    // Update dashboard
    await this.updateDashboard(deployment);
  }

  async handleDeploymentCompleted(deployment) {
    this.deploymentStats.successful++;
    this.deploymentStats.active--;
    
    // Log deployment results to experiments branch
    await this.logToExperimentsBranch(deployment);
    
    // Send success notification
    await this.sendNotificationEmail({
      type: 'deployment_success',
      deployment,
      subject: `✅ Deployment Successful: ${deployment.project.title}`,
      message: `Deployment completed successfully. Endpoints: ${deployment.endpoints.join(', ')}`
    });
    
    // Clean up temporary files if configured
    if (this.config.cleanupOnSuccess) {
      await this.cleanupTempFiles(deployment);
    }
  }

  async handleDeploymentFailed(deployment) {
    this.deploymentStats.failed++;
    this.deploymentStats.active--;
    
    // Send failure notification
    await this.sendNotificationEmail({
      type: 'deployment_failed',
      deployment,
      subject: `❌ Deployment Failed: ${deployment.project?.title}`,
      message: `Deployment ${deployment.deploymentId} failed: ${deployment.error}`
    });
    
    // Log failure details
    await this.logFailureDetails(deployment);
  }

  /**
   * Utility methods
   */
  generateDeploymentId() {
    return `dep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  log(deployment, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp}: ${message}`;
    deployment.logs.push(logEntry);
    console.log(`[${deployment.id}] ${message}`);
  }

  async executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, options);
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', data => stdout += data.toString());
      process.stderr?.on('data', data => stderr += data.toString());
      
      process.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', reject);
    });
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async detectProjectType(projectPath, files) {
    if (files.includes('package.json')) return 'nodejs';
    if (files.includes('requirements.txt') || files.includes('setup.py')) return 'python';
    if (files.includes('Dockerfile')) return 'docker';
    if (files.includes('pom.xml')) return 'java';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('go.mod')) return 'go';
    return 'generic';
  }

  validateProjectConfig(config) {
    if (!config.url || !config.title) {
      throw new Error('Project configuration must include url and title');
    }
    
    if (!config.url.includes('github.com')) {
      throw new Error('Only GitHub repositories are currently supported');
    }
  }

  async sendNotificationEmail(notification) {
    if (!this.config.emailService) return;
    
    try {
      await axios.post(this.config.emailService, {
        to: 'scarmonit@scarmonit.com',
        subject: notification.subject,
        text: notification.message,
        html: this.generateEmailHtml(notification)
      });
    } catch (error) {
      console.warn('⚠️ Failed to send notification email:', error.message);
    }
  }

  generateEmailHtml(notification) {
    return `
      <h2>${notification.subject}</h2>
      <p>${notification.message}</p>
      <hr>
      <p><strong>Deployment ID:</strong> ${notification.deployment?.id}</p>
      <p><strong>Project:</strong> ${notification.deployment?.project?.title}</p>
      <p><strong>Status:</strong> ${notification.deployment?.status}</p>
      <p><strong>Progress:</strong> ${notification.deployment?.progress}%</p>
      ${notification.deployment?.endpoints?.length ? 
        `<p><strong>Endpoints:</strong> ${notification.deployment.endpoints.join(', ')}</p>` : ''}
    `;
  }

  /**
   * Get deployment statistics
   */
  getStats() {
    return {
      ...this.deploymentStats,
      successRate: this.deploymentStats.total > 0 ? 
        (this.deploymentStats.successful / this.deploymentStats.total * 100).toFixed(2) + '%' : '0%',
      activeDeployments: Array.from(this.activeDeployments.keys()),
      queueLength: this.deploymentQueue.length
    };
  }

  /**
   * Get status of a specific deployment
   */
  getDeploymentStatus(deploymentId) {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      return { status: 'not_found' };
    }
    
    return {
      id: deployment.id,
      status: deployment.status,
      progress: deployment.progress,
      startTime: deployment.startTime,
      endpoints: deployment.endpoints,
      logs: deployment.logs.slice(-5) // Last 5 log entries
    };
  }
}

// CLI execution
if (require.main === module) {
  const deployer = new ProjectDeployer();
  
  // Example usage
  const exampleProject = {
    title: 'Test Project',
    url: 'https://github.com/example/test-project',
    deploymentConfig: {
      complexity: 'low',
      deploymentStrategy: 'docker-container'
    }
  };
  
  deployer.deployProject(exampleProject)
    .then(result => {
      console.log('🎉 Deployment completed:', result);
      console.log('📊 Deployment stats:', deployer.getStats());
    })
    .catch(error => {
      console.error('💥 Deployment failed:', error.message);
    });
}

module.exports = ProjectDeployer;
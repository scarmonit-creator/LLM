// Enhanced Projects Dashboard JavaScript - Optimized for GitHub Pages
// Handles loading projects from Projects.json with fallback support and full deployment integration

class ProjectsDashboard {
    constructor() {
        this.projects = [];
        this.deployments = new Map();
        this.activeDeployments = 0;
        this.isGitHubPages = window.location.hostname.includes('github.io');
        this.apiBaseUrl = this.isGitHubPages ? '' : ''; // GitHub Pages doesn't support backend APIs
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Projects Dashboard v2.1.0');
        console.log(`Environment: ${this.isGitHubPages ? 'GitHub Pages' : 'Local/Server'}`);
        
        this.bindEvents();
        await this.loadProjects();
        this.setupPolling();
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refresh-btn');
        const stopAllBtn = document.getElementById('stop-all-btn');

        refreshBtn?.addEventListener('click', () => this.loadProjects());
        stopAllBtn?.addEventListener('click', () => this.stopAllDeployments());
    }

    async loadProjects() {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay?.classList.add('show');

        try {
            console.log('📦 Loading projects...');
            
            // Try multiple sources for Projects.json
            const sources = [
                './Projects.json',  // GitHub Pages
                '../Projects.json', // Local dev
                '/projects.json',   // Server endpoint
            ];
            
            let data = null;
            for (const source of sources) {
                try {
                    console.log(`Trying source: ${source}`);
                    const response = await fetch(source);
                    if (response.ok) {
                        data = await response.json();
                        console.log(`✅ Loaded from ${source}`);
                        break;
                    }
                } catch (err) {
                    console.log(`❌ Failed to load from ${source}:`, err.message);
                }
            }
            
            if (!data) {
                throw new Error('Could not load Projects.json from any source');
            }

            // Handle both formats: array of URLs or structured object
            if (Array.isArray(data)) {
                // Legacy format: just URLs
                this.projects = data.map((url, index) => ({
                    id: index + 1,
                    name: this.extractProjectName(url),
                    url: url,
                    repoUrl: url,
                    description: this.generateDescription(url),
                    canDeploy: url.includes('github.com'),
                    category: 'general'
                }));
            } else {
                // New structured format with metadata
                this.projects = (data.projects || []).map(project => ({
                    ...project,
                    repoUrl: project.url,
                    canDeploy: this.isGitHubPages ? false : (project.url && project.url.includes('github.com'))
                }));
                
                // Update metadata display if available
                if (data.metadata) {
                    this.updateMetadata(data.metadata);
                }
            }

            console.log(`📊 Loaded ${this.projects.length} projects`);
            this.renderProjects();
            this.updateStats();
            
        } catch (error) {
            console.error('❌ Error loading projects:', error);
            this.showError(`Failed to load projects: ${error.message}`);
        } finally {
            loadingOverlay?.classList.remove('show');
        }
    }
    
    updateMetadata(metadata) {
        const titleEl = document.querySelector('.header h1');
        const descEl = document.querySelector('.header p');
        
        if (titleEl && metadata.title) {
            titleEl.textContent = metadata.title;
        }
        
        if (descEl) {
            descEl.innerHTML = `Browse and deploy ${metadata.total_projects || this.projects.length} AI/ML projects 
                              <span style="opacity: 0.8; font-size: 0.9rem;">(Updated: ${new Date(metadata.last_updated || Date.now()).toLocaleDateString()})</span>`;
        }
    }

    extractProjectName(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (urlObj.hostname === 'github.com' && pathParts.length >= 2) {
                return pathParts[1].replace(/[-_]/g, ' ');
            }
            
            // For other URLs, try to extract meaningful name
            return pathParts.length > 0 ? pathParts[pathParts.length - 1] : urlObj.hostname;
        } catch {
            return 'Unknown Project';
        }
    }
    
    generateDescription(url) {
        if (url.includes('github.com')) {
            const name = this.extractProjectName(url);
            return `GitHub repository: ${name}`;
        }
        if (url.includes('medium.com') || url.includes('towardsdatascience.com')) {
            return 'Medium article with project code';
        }
        if (url.includes('kaggle.com')) {
            return 'Kaggle project or dataset';
        }
        return 'AI/ML project resource';
    }

    renderProjects() {
        const container = document.getElementById('projects-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.projects.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: white; padding: 3rem;">
                    <h3>🔍 No projects found</h3>
                    <p style="margin: 1rem 0;">Check your Projects.json file or try refreshing the page.</p>
                    <button onclick="location.reload()" style="background: white; color: #667eea; border: none; padding: 0.8rem 1.5rem; border-radius: 25px; cursor: pointer; font-weight: 600;">Refresh Page</button>
                </div>
            `;
            return;
        }

        this.projects.forEach(project => {
            const projectCard = this.createProjectCard(project);
            container.appendChild(projectCard);
        });
        
        console.log(`✅ Rendered ${this.projects.length} project cards`);
    }

    createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.setAttribute('data-project-id', project.id);

        const deploymentStatus = this.deployments.get(project.id);
        const isDeploying = deploymentStatus && ['initializing', 'cloning', 'installing', 'deploying', 'testing'].includes(deploymentStatus.status);
        
        card.innerHTML = `
            <div class="project-header">
                <div class="project-id">Project #${project.id}</div>
                ${project.category ? `<span style="background: #f0f0f0; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; color: #666;">${project.category}</span>` : ''}
            </div>
            <div class="project-name">
                <strong>${this.escapeHtml(project.name || 'Unknown Project')}</strong>
            </div>
            ${project.description ? `<div style="color: #666; font-size: 0.9rem; margin: 0.5rem 0; line-height: 1.4;">${this.escapeHtml(project.description)}</div>` : ''}
            <div class="project-url">
                <a href="${project.url}" target="_blank" style="color: #667eea; text-decoration: none; font-size: 0.85rem; word-break: break-all;">
                    ${this.escapeHtml(this.shortenUrl(project.url))}
                </a>
            </div>
            <div class="project-actions">
                ${project.canDeploy && !this.isGitHubPages ? `
                    <button class="test-btn ${isDeploying ? 'loading' : ''}" data-project-id="${project.id}" ${isDeploying ? 'disabled' : ''}>
                        <div class="loading-spinner"></div>
                        <span class="btn-text">${isDeploying ? 'Deploying...' : '🚀 Deploy Project'}</span>
                    </button>
                ` : `
                    <button class="test-btn" disabled title="${this.isGitHubPages ? 'Deployment not available on GitHub Pages' : 'Cannot deploy non-GitHub repositories'}" style="opacity: 0.6;">
                        <span class="btn-text">${this.isGitHubPages ? '📄 View Only' : '❌ Cannot Deploy'}</span>
                    </button>
                `}
                <a href="${project.url}" target="_blank" class="view-btn">
                    👁️ View Source
                </a>
            </div>
            <div class="deployment-status" id="status-${project.id}">
                <div class="status-text">${project.canDeploy && !this.isGitHubPages ? 'Ready to deploy' : 'View-only mode'}</div>
                <div class="status-details"></div>
            </div>
        `;

        // Bind deploy button event only if deployment is supported
        if (project.canDeploy && !this.isGitHubPages) {
            const testBtn = card.querySelector('.test-btn[data-project-id]');
            testBtn?.addEventListener('click', () => this.deployProject(project));
        }

        return card;
    }
    
    shortenUrl(url) {
        if (url.length <= 60) return url;
        return url.substring(0, 30) + '...' + url.substring(url.length - 25);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async deployProject(project) {
        if (this.isGitHubPages) {
            this.showError('Deployment is not available on GitHub Pages. Run locally for deployment features.');
            return;
        }
        
        const testBtn = document.querySelector(`[data-project-id="${project.id}"]`);
        const statusDiv = document.getElementById(`status-${project.id}`);

        try {
            // Update UI to show loading
            testBtn.classList.add('loading');
            testBtn.disabled = true;
            this.showStatus(project.id, 'initializing', 'Starting deployment...');

            // Call backend API
            const response = await fetch('/api/deploy-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: project.id,
                    projectName: project.name,
                    repoUrl: project.repoUrl
                })
            });

            if (!response.ok) {
                throw new Error(`Deployment failed: ${response.statusText}`);
            }

            const result = await response.json();
            const deploymentId = result.deploymentId;

            // Store deployment info
            this.deployments.set(project.id, {
                deploymentId,
                status: 'initializing',
                project
            });

            this.activeDeployments++;
            this.updateStats();

            // Start polling for status
            this.pollDeploymentStatus(deploymentId, project.id);

            this.showStatus(project.id, 'initializing', `Deployment started: ${deploymentId}`);

        } catch (error) {
            console.error('Deployment error:', error);
            testBtn.classList.remove('loading');
            testBtn.disabled = false;
            this.showStatus(project.id, 'failed', `Error: ${error.message}`);
        }
    }

    async pollDeploymentStatus(deploymentId, projectId) {
        const maxPolls = 60; // 5 minutes at 5-second intervals
        let pollCount = 0;

        const poll = async () => {
            try {
                const response = await fetch(`/api/deploy-project/${deploymentId}/status`);
                if (!response.ok) {
                    throw new Error('Failed to get deployment status');
                }

                const deployment = await response.json();
                const status = deployment.status;

                this.updateDeploymentStatus(projectId, deployment);

                // Continue polling if still in progress
                if (['initializing', 'cloning', 'checking', 'installing', 'deploying', 'testing'].includes(status)) {
                    pollCount++;
                    if (pollCount < maxPolls) {
                        setTimeout(poll, 5000); // Poll every 5 seconds
                    } else {
                        this.showStatus(projectId, 'failed', 'Deployment timeout');
                        this.finishDeployment(projectId);
                    }
                } else {
                    // Deployment finished (success or failed)
                    this.finishDeployment(projectId);
                }

            } catch (error) {
                console.error('Polling error:', error);
                this.showStatus(projectId, 'failed', `Polling error: ${error.message}`);
                this.finishDeployment(projectId);
            }
        };

        poll();
    }

    updateDeploymentStatus(projectId, deployment) {
        const statusMessages = {
            initializing: '⏳ Initializing deployment...',
            cloning: '📥 Cloning repository...',
            checking: '🔍 Checking Nitric configuration...',
            installing: '📦 Installing dependencies...',
            deploying: '🚀 Starting Nitric deployment...',
            testing: '🧪 Running tests...',
            success: `✅ Deployment successful!${deployment.deploymentUrl ? ` <a href="${deployment.deploymentUrl}" target="_blank" style="color: #0c5460; font-weight: bold;">View App</a>` : ''}`,
            failed: `❌ Deployment failed: ${deployment.error || 'Unknown error'}`
        };

        const message = statusMessages[deployment.status] || `Status: ${deployment.status}`;
        this.showStatus(projectId, deployment.status, message);

        // Update stored deployment
        if (this.deployments.has(projectId)) {
            this.deployments.get(projectId).status = deployment.status;
        }
    }

    showStatus(projectId, status, message) {
        const statusDiv = document.getElementById(`status-${projectId}`);
        if (!statusDiv) return;

        statusDiv.className = `deployment-status show ${status}`;
        statusDiv.querySelector('.status-text').innerHTML = message;

        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        const detailsDiv = statusDiv.querySelector('.status-details');
        detailsDiv.textContent = `Last updated: ${timestamp}`;
    }

    finishDeployment(projectId) {
        const testBtn = document.querySelector(`[data-project-id="${projectId}"]`);
        if (testBtn) {
            testBtn.classList.remove('loading');
            testBtn.disabled = false;
            
            const deployment = this.deployments.get(projectId);
            if (deployment?.status === 'success') {
                testBtn.innerHTML = '<span class="btn-text">✅ Deployed</span>';
            } else {
                testBtn.innerHTML = '<span class="btn-text">🚀 Retry Deploy</span>';
            }
        }

        if (this.deployments.has(projectId)) {
            this.activeDeployments = Math.max(0, this.activeDeployments - 1);
            this.updateStats();
        }
    }

    async stopAllDeployments() {
        // This would require backend implementation to stop deployments
        // For now, just reset the UI
        this.deployments.clear();
        this.activeDeployments = 0;
        this.updateStats();

        // Reset all test buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-text">🚀 Deploy Project</span>';
        });

        // Hide all status displays
        document.querySelectorAll('.deployment-status').forEach(status => {
            status.classList.remove('show');
        });

        console.log('🛑 All deployments stopped');
    }

    updateStats() {
        const totalProjectsEl = document.getElementById('total-projects');
        const activeDeploymentsEl = document.getElementById('active-deployments');

        if (totalProjectsEl) {
            totalProjectsEl.textContent = this.projects.length;
        }

        if (activeDeploymentsEl) {
            activeDeploymentsEl.textContent = this.activeDeployments;
        }
    }

    showError(message) {
        // Create and show error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: #f8d7da;
            color: #721c24;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #f5c6cb;
            z-index: 1001;
            max-width: 400px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        `;
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.5rem;">⚠️ Error</div>
            <div>${this.escapeHtml(message)}</div>
        `;

        document.body.appendChild(errorDiv);

        // Remove after 7 seconds
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 7000);
    }

    setupPolling() {
        // Poll for deployment updates every 30 seconds
        setInterval(() => {
            if (this.activeDeployments > 0) {
                console.log(`🔄 Checking ${this.activeDeployments} active deployments...`);
            }
        }, 30000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.projectsDashboard = new ProjectsDashboard();
    console.log('✅ Projects Dashboard initialized');
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectsDashboard;
}
// Projects Dashboard JavaScript
// Handles loading projects from Projects.json and integrating with backend API for deployment

class ProjectsDashboard {
    constructor() {
        this.projects = [];
        this.deployments = new Map();
        this.activeDeployments = 0;
        this.init();
    }

    async init() {
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
            const response = await fetch('../Projects.json');
            if (!response.ok) {
                throw new Error('Failed to load projects');
            }

            const data = await response.json();
            this.projects = data.map((url, index) => ({
                id: `project-${index + 1}`,
                name: this.extractProjectName(url),
                url: url,
                repoUrl: url
            }));

            this.renderProjects();
            this.updateStats();
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showError('Failed to load projects. Please try again.');
        } finally {
            loadingOverlay?.classList.remove('show');
        }
    }

    extractProjectName(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            
            if (urlObj.hostname === 'github.com' && pathParts.length >= 2) {
                return `${pathParts[0]}/${pathParts[1]}`;
            }
            
            // For other URLs, try to extract meaningful name
            return pathParts.length > 0 ? pathParts[pathParts.length - 1] : urlObj.hostname;
        } catch {
            return 'Unknown Project';
        }
    }

    renderProjects() {
        const container = document.getElementById('projects-container');
        if (!container) return;

        container.innerHTML = '';

        this.projects.forEach(project => {
            const projectCard = this.createProjectCard(project);
            container.appendChild(projectCard);
        });
    }

    createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.setAttribute('data-project-id', project.id);

        card.innerHTML = `
            <div class="project-header">
                <div class="project-id">Project #${project.id.split('-')[1]}</div>
            </div>
            <div class="project-name">
                <strong>${project.name}</strong>
            </div>
            <div class="project-url">
                ${project.url}
            </div>
            <div class="project-actions">
                <button class="test-btn" data-project-id="${project.id}">
                    <div class="loading-spinner"></div>
                    <span class="btn-text">🚀 Test/Run Project</span>
                </button>
                <a href="${project.url}" target="_blank" class="view-btn">
                    👁️ View
                </a>
            </div>
            <div class="deployment-status" id="status-${project.id}">
                <div class="status-text">Ready to deploy</div>
                <div class="status-details"></div>
            </div>
        `;

        // Bind test button event
        const testBtn = card.querySelector('.test-btn');
        testBtn.addEventListener('click', () => this.deployProject(project));

        return card;
    }

    async deployProject(project) {
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
            initializing: 'Initializing deployment...',
            cloning: 'Cloning repository...',
            checking: 'Checking Nitric configuration...',
            installing: 'Installing dependencies...',
            deploying: 'Starting Nitric deployment...',
            testing: 'Running tests...',
            success: `✅ Deployment successful!${deployment.deploymentUrl ? ` Available at: ${deployment.deploymentUrl}` : ''}`,
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
        statusDiv.querySelector('.status-text').textContent = message;

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
        });

        // Hide all status displays
        document.querySelectorAll('.deployment-status').forEach(status => {
            status.classList.remove('show');
        });

        console.log('All deployments stopped');
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
        `;
        errorDiv.textContent = message;

        document.body.appendChild(errorDiv);

        // Remove after 5 seconds
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 5000);
    }

    setupPolling() {
        // Poll for deployment updates every 30 seconds
        setInterval(() => {
            if (this.activeDeployments > 0) {
                console.log(`Checking ${this.activeDeployments} active deployments...`);
            }
        }, 30000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProjectsDashboard();
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectsDashboard;
}

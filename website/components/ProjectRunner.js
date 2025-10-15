/**
 * 🌐 Project Runner - One-Click Deployment Interface
 * 
 * Interactive React component for browsing and deploying AI projects
 * from the cataloged projects index with real-time monitoring.
 * 
 * Features:
 * - Real-time project browsing from AI catalog
 * - One-click deployment with progress tracking
 * - Live deployment status and log monitoring
 * - Project filtering and search capabilities
 * - Integration with dashboard and deployment engine
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  PlayArrow as DeployIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Launch as LaunchIcon,
  Code as CodeIcon,
  Star as StarIcon,
  Schedule as TimeIcon,
  Memory as ResourceIcon,
  Cloud as CloudIcon,
  Info as InfoIcon
} from '@mui/icons-material';

const ProjectRunner = () => {
  // State management
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedComplexity, setSelectedComplexity] = useState('all');
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeDeployments, setActiveDeployments] = useState(new Map());
  const [deploymentStats, setDeploymentStats] = useState({});
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [projectMetadata, setProjectMetadata] = useState({});
  
  // Refs for real-time updates
  const wsRef = useRef(null);
  const updateIntervalRef = useRef(null);

  // Configuration
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000/api';
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws';

  /**
   * Load projects on component mount
   */
  useEffect(() => {
    loadProjects();
    loadProjectMetadata();
    setupWebSocketConnection();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  /**
   * Filter projects based on search and filters
   */
  useEffect(() => {
    filterProjects();
  }, [projects, searchTerm, selectedCategory, selectedComplexity]);

  /**
   * Setup real-time updates
   */
  useEffect(() => {
    if (realTimeUpdates) {
      setupRealTimeUpdates();
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    }
  }, [realTimeUpdates]);

  /**
   * Load projects from the AI catalog
   */
  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/projects.json');
      setProjects(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load AI projects catalog');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load project metadata for statistics
   */
  const loadProjectMetadata = async () => {
    try {
      const response = await axios.get('/projects-metadata.json');
      setProjectMetadata(response.data);
    } catch (err) {
      console.warn('Could not load project metadata:', err);
    }
  };

  /**
   * Setup WebSocket connection for real-time updates
   */
  const setupWebSocketConnection = () => {
    if (!realTimeUpdates) return;
    
    try {
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected for real-time updates');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      wsRef.current.onerror = (error) => {
        console.warn('WebSocket error:', error);
      };
      
      wsRef.current.onclose = () => {
        // Attempt to reconnect after 5 seconds
        setTimeout(setupWebSocketConnection, 5000);
      };
    } catch (error) {
      console.warn('WebSocket not available, falling back to polling');
      setupPollingUpdates();
    }
  };

  /**
   * Setup polling updates as fallback
   */
  const setupPollingUpdates = () => {
    updateIntervalRef.current = setInterval(() => {
      loadDeploymentStats();
      updateActiveDeployments();
    }, 5000);
  };

  /**
   * Setup real-time updates
   */
  const setupRealTimeUpdates = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // WebSocket already connected
      return;
    }
    setupWebSocketConnection();
  };

  /**
   * Handle WebSocket messages
   */
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'deployment:started':
        handleDeploymentStarted(data.deployment);
        break;
      case 'deployment:progress':
        handleDeploymentProgress(data);
        break;
      case 'deployment:completed':
        handleDeploymentCompleted(data.deployment);
        break;
      case 'deployment:failed':
        handleDeploymentFailed(data.deployment);
        break;
      case 'stats:update':
        setDeploymentStats(data.stats);
        break;
    }
  };

  /**
   * Filter projects based on current criteria
   */
  const filterProjects = () => {
    let filtered = [...projects];
    
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(term) ||
        project.metadata?.description?.toLowerCase().includes(term) ||
        project.metadata?.language?.toLowerCase().includes(term)
      );
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(project => 
        project.category === selectedCategory ||
        project.enhancedCategory === selectedCategory
      );
    }
    
    // Complexity filter
    if (selectedComplexity !== 'all') {
      filtered = filtered.filter(project => 
        project.deploymentConfig?.complexity === selectedComplexity
      );
    }
    
    // Sort by stars (descending)
    filtered.sort((a, b) => (b.metadata?.stars || 0) - (a.metadata?.stars || 0));
    
    setFilteredProjects(filtered);
  };

  /**
   * Start project deployment
   */
  const deployProject = async (project) => {
    try {
      const response = await axios.post(`${API_BASE}/deploy`, {
        project,
        options: {
          realTimeUpdates: true,
          emailNotifications: true
        }
      });
      
      const deploymentId = response.data.deploymentId;
      
      // Add to active deployments
      setActiveDeployments(prev => new Map(prev.set(deploymentId, {
        id: deploymentId,
        project,
        status: 'starting',
        progress: 0,
        startTime: new Date(),
        logs: []
      })));
      
      // Close deployment dialog
      setDeploymentDialogOpen(false);
      setSelectedProject(null);
      
      // Switch to deployments tab
      setCurrentTab(1);
      
    } catch (error) {
      console.error('Deployment failed:', error);
      setError(`Failed to start deployment: ${error.message}`);
    }
  };

  /**
   * Handle deployment events
   */
  const handleDeploymentStarted = (deployment) => {
    setActiveDeployments(prev => new Map(prev.set(deployment.id, deployment)));
  };

  const handleDeploymentProgress = (data) => {
    setActiveDeployments(prev => {
      const updated = new Map(prev);
      const deployment = updated.get(data.deploymentId);
      if (deployment) {
        deployment.status = data.step;
        deployment.progress = data.progress;
        deployment.logs = [...(deployment.logs || []), `${data.step}: ${JSON.stringify(data.result)}`];
        updated.set(data.deploymentId, deployment);
      }
      return updated;
    });
  };

  const handleDeploymentCompleted = (deployment) => {
    setActiveDeployments(prev => {
      const updated = new Map(prev);
      updated.set(deployment.id, {
        ...deployment,
        status: 'completed',
        progress: 100,
        completionTime: new Date()
      });
      return updated;
    });
  };

  const handleDeploymentFailed = (deployment) => {
    setActiveDeployments(prev => {
      const updated = new Map(prev);
      updated.set(deployment.id, {
        ...deployment,
        status: 'failed',
        error: deployment.error,
        completionTime: new Date()
      });
      return updated;
    });
  };

  /**
   * Load deployment statistics
   */
  const loadDeploymentStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`);
      setDeploymentStats(response.data);
    } catch (error) {
      console.warn('Could not load deployment stats:', error);
    }
  };

  /**
   * Update active deployments status
   */
  const updateActiveDeployments = async () => {
    const deploymentIds = Array.from(activeDeployments.keys());
    
    for (const id of deploymentIds) {
      try {
        const response = await axios.get(`${API_BASE}/deployment/${id}/status`);
        const status = response.data;
        
        if (status.status !== 'not_found') {
          setActiveDeployments(prev => {
            const updated = new Map(prev);
            const existing = updated.get(id) || {};
            updated.set(id, { ...existing, ...status });
            return updated;
          });
        }
      } catch (error) {
        console.warn(`Could not update deployment ${id}:`, error);
      }
    }
  };

  /**
   * Get category color
   */
  const getCategoryColor = (category) => {
    const colors = {
      'machine-learning': '#4CAF50',
      'deep-learning': '#2196F3',
      'computer-vision': '#FF9800',
      'nlp': '#9C27B0',
      'reinforcement-learning': '#F44336',
      'data-science': '#607D8B',
      'ai-tools': '#795548',
      'general-ai': '#9E9E9E'
    };
    return colors[category] || '#9E9E9E';
  };

  /**
   * Get complexity chip props
   */
  const getComplexityProps = (complexity) => {
    const props = {
      'low': { color: 'success', label: 'Low' },
      'medium': { color: 'warning', label: 'Medium' },
      'high': { color: 'error', label: 'High' }
    };
    return props[complexity] || { color: 'default', label: 'Unknown' };
  };

  /**
   * Render project card
   */
  const renderProjectCard = (project) => {
    const isDeploying = Array.from(activeDeployments.values())
      .some(dep => dep.project?.repositoryPath === project.repositoryPath && dep.status !== 'completed' && dep.status !== 'failed');
    
    const complexityProps = getComplexityProps(project.deploymentConfig?.complexity);
    
    return (
      <Grid item xs={12} sm={6} md={4} key={project.repositoryPath}>
        <Card 
          sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative',
            '&:hover': { boxShadow: 3 }
          }}
        >
          <CardContent sx={{ flexGrow: 1 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
              <Typography variant="h6" component="h2" noWrap>
                {project.title}
              </Typography>
              {project.metadata?.stars > 0 && (
                <Box display="flex" alignItems="center" color="text.secondary">
                  <StarIcon fontSize="small" />
                  <Typography variant="caption" ml={0.5}>
                    {project.metadata.stars}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              {project.metadata?.description || 'No description available'}
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
              <Chip
                size="small"
                label={project.category || 'general'}
                sx={{ 
                  backgroundColor: getCategoryColor(project.category),
                  color: 'white'
                }}
              />
              
              <Chip
                size="small"
                label={complexityProps.label}
                color={complexityProps.color}
              />
              
              {project.metadata?.language && (
                <Chip
                  size="small"
                  label={project.metadata.language}
                  variant="outlined"
                />
              )}
            </Box>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" color="text.secondary">
              <Box display="flex" alignItems="center">
                <TimeIcon fontSize="small" />
                <Typography variant="caption" ml={0.5}>
                  {project.deploymentConfig?.estimatedDeployTime || '2-5 min'}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center">
                <ResourceIcon fontSize="small" />
                <Typography variant="caption" ml={0.5}>
                  {project.deploymentConfig?.requirements?.resources?.memory || '1Gi'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
          
          <CardActions>
            <Button
              size="small"
              startIcon={<InfoIcon />}
              onClick={() => {
                setSelectedProject(project);
                setDeploymentDialogOpen(true);
              }}
            >
              Details
            </Button>
            
            <Button
              size="small"
              startIcon={<CodeIcon />}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </Button>
            
            <Button
              size="small"
              variant="contained"
              startIcon={isDeploying ? <CircularProgress size={16} /> : <DeployIcon />}
              onClick={() => deployProject(project)}
              disabled={isDeploying}
              sx={{ ml: 'auto' }}
            >
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </Button>
          </CardActions>
        </Card>
      </Grid>
    );
  };

  /**
   * Render deployment card
   */
  const renderDeploymentCard = ([deploymentId, deployment]) => (
    <Card key={deploymentId} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {deployment.project?.title || 'Unknown Project'}
          </Typography>
          
          <Chip
            label={deployment.status}
            color={
              deployment.status === 'completed' ? 'success' :
              deployment.status === 'failed' ? 'error' :
              'primary'
            }
          />
        </Box>
        
        <LinearProgress
          variant="determinate"
          value={deployment.progress || 0}
          sx={{ mb: 2 }}
        />
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Progress: {deployment.progress || 0}%
        </Typography>
        
        {deployment.endpoints?.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Endpoints:
            </Typography>
            {deployment.endpoints.map((endpoint, index) => (
              <Button
                key={index}
                size="small"
                startIcon={<LaunchIcon />}
                href={endpoint}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ mr: 1, mb: 1 }}
              >
                Open App
              </Button>
            ))}
          </Box>
        )}
        
        {deployment.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {deployment.error}
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  /**
   * Render deployment dialog
   */
  const renderDeploymentDialog = () => (
    <Dialog
      open={deploymentDialogOpen}
      onClose={() => setDeploymentDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Deploy Project: {selectedProject?.title}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Description:</strong> {selectedProject?.metadata?.description}
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            <strong>Language:</strong> {selectedProject?.metadata?.language}
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            <strong>Stars:</strong> {selectedProject?.metadata?.stars}
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            <strong>Estimated Deploy Time:</strong> {selectedProject?.deploymentConfig?.estimatedDeployTime}
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            <strong>Complexity:</strong> {selectedProject?.deploymentConfig?.complexity}
          </Typography>
          
          <Typography variant="body2" gutterBottom>
            <strong>Strategy:</strong> {selectedProject?.deploymentConfig?.deploymentStrategy}
          </Typography>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            This will clone the repository, build the project, and deploy it to the cloud.
            You'll receive email notifications at scarmonit@scarmonit.com with deployment status.
          </Alert>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => setDeploymentDialogOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => deployProject(selectedProject)}
          startIcon={<DeployIcon />}
        >
          Start Deployment
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Main render
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading AI Projects...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          {error}
        </Alert>
        <Button
          variant="contained"
          onClick={loadProjects}
          sx={{ mt: 2 }}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h3" component="h1">
          AI Projects Runner
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={realTimeUpdates}
              onChange={(e) => setRealTimeUpdates(e.target.checked)}
            />
          }
          label="Real-time Updates"
        />
      </Box>
      
      {projectMetadata?.totalProjects && (
        <Paper sx={{ p: 2, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Catalog Statistics
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="primary">
                {projectMetadata.totalProjects}
              </Typography>
              <Typography variant="body2">Total Projects</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="secondary">
                {deploymentStats.total || 0}
              </Typography>
              <Typography variant="body2">Deployments</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="success.main">
                {deploymentStats.successRate || '0%'}
              </Typography>
              <Typography variant="body2">Success Rate</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="info.main">
                {deploymentStats.active || 0}
              </Typography>
              <Typography variant="body2">Active</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
        <Tab label={`Projects (${filteredProjects.length})`} />
        <Tab label={`Deployments (${activeDeployments.size})`} />
      </Tabs>
      
      {currentTab === 0 && (
        <>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 4 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search projects"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, description, or language"
                />
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {Object.keys(projectMetadata?.categories || {}).map(cat => (
                      <MenuItem key={cat} value={cat}>
                        {cat.replace('-', ' ')} ({projectMetadata.categories[cat]})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Complexity</InputLabel>
                  <Select
                    value={selectedComplexity}
                    onChange={(e) => setSelectedComplexity(e.target.value)}
                  >
                    <MenuItem value="all">All Complexities</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setSelectedComplexity('all');
                  }}
                  startIcon={<RefreshIcon />}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Projects Grid */}
          <Grid container spacing={3}>
            {filteredProjects.map(renderProjectCard)}
          </Grid>
          
          {filteredProjects.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                No projects found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Try adjusting your search criteria or filters.
              </Typography>
            </Paper>
          )}
        </>
      )}
      
      {currentTab === 1 && (
        <>
          {Array.from(activeDeployments.entries()).map(renderDeploymentCard)}
          
          {activeDeployments.size === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                No active deployments
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Deploy a project from the Projects tab to see it here.
              </Typography>
            </Paper>
          )}
        </>
      )}
      
      {renderDeploymentDialog()}
    </Container>
  );
};

export default ProjectRunner;
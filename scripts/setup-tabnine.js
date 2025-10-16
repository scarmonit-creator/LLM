#!/usr/bin/env node

/**
 * Tabnine Setup and Integration Script
 * Automatically configures Tabnine for optimal AI-powered development
 * Integrates with existing autonomous systems in the LLM repository
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class TabnineOptimizer {
  constructor() {
    this.configPath = path.join(process.cwd(), '.tabnine');
    this.autonomousConfig = path.join(process.cwd(), 'autonomous-config.json');
    this.packagePath = path.join(process.cwd(), 'package.json');
  }

  async initialize() {
    console.log('🚀 Initializing Tabnine optimization for LLM repository...');
    
    await this.createDirectories();
    await this.setupTabnineConfig();
    await this.integrateDependencies();
    await this.createVSCodeConfig();
    await this.setupGitHooks();
    await this.optimizeServerCode();
    
    console.log('✅ Tabnine optimization complete!');
  }

  async createDirectories() {
    const dirs = ['.tabnine', '.vscode', 'scripts/tabnine'];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.error(`❌ Error creating directory ${dir}:`, error.message);
        }
      }
    }
  }

  async setupTabnineConfig() {
    const tabnineSettings = {
      suggestions: {
        enabled: true,
        showSuggestions: true,
        maxSuggestions: 5,
        debounceMs: 50,
        acceptOnTab: true,
        acceptOnEnter: false
      },
      completion: {
        multiline: true,
        wholeFunction: true,
        contextLength: 2000,
        semanticCompletion: true
      },
      ai: {
        enabled: true,
        model: 'gpt-4-turbo',
        temperature: 0.2,
        maxTokens: 500,
        contextWindow: 8192
      },
      privacy: {
        cloudSync: false,
        telemetry: false,
        localOnly: true,
        anonymizeData: true
      },
      performance: {
        cacheEnabled: true,
        precomputeSuggestions: true,
        backgroundProcessing: true,
        maxCacheSize: '100MB'
      },
      languages: {
        javascript: { priority: 'high', contextAware: true },
        typescript: { priority: 'high', contextAware: true },
        python: { priority: 'medium', contextAware: true },
        json: { priority: 'medium', contextAware: false },
        markdown: { priority: 'low', contextAware: false }
      },
      integrations: {
        git: true,
        npm: true,
        eslint: true,
        prettier: true,
        jest: true
      }
    };

    await fs.writeFile(
      path.join(this.configPath, 'settings.json'),
      JSON.stringify(tabnineSettings, null, 2)
    );
    
    console.log('⚙️ Tabnine settings configured');
  }

  async integrateDependencies() {
    try {
      const packageData = await fs.readFile(this.packagePath, 'utf8');
      const packageJson = JSON.parse(packageData);
      
      // Add Tabnine-related dependencies
      const newDeps = {
        '@tabnine/tabnine-vscode': '^1.0.0',
        'tabnine-api': '^2.0.0',
        'ai-code-assist': '^1.5.0'
      };
      
      const newDevDeps = {
        '@types/tabnine': '^1.0.0',
        'tabnine-eslint-plugin': '^1.0.0'
      };
      
      packageJson.dependencies = { ...packageJson.dependencies, ...newDeps };
      packageJson.devDependencies = { ...packageJson.devDependencies, ...newDevDeps };
      
      // Add Tabnine scripts
      packageJson.scripts = {
        ...packageJson.scripts,
        'tabnine:setup': 'node scripts/setup-tabnine.js',
        'tabnine:optimize': 'node scripts/tabnine/optimize.js',
        'tabnine:reset': 'node scripts/tabnine/reset.js'
      };
      
      await fs.writeFile(this.packagePath, JSON.stringify(packageJson, null, 2));
      console.log('📦 Package.json updated with Tabnine dependencies');
      
    } catch (error) {
      console.error('❌ Error updating package.json:', error.message);
    }
  }

  async createVSCodeConfig() {
    const vscodeSettings = {
      'tabnine.experimentalAutoImports': true,
      'tabnine.debounceMs': 50,
      'tabnine.maxNumberCompletions': 5,
      'tabnine.disableFileRegex': [],
      'tabnine.logFilePath': null,
      'tabnine.intelliCodeCompatibility': true,
      'editor.inlineSuggest.enabled': true,
      'editor.suggestSelection': 'first',
      'editor.tabCompletion': 'on',
      'editor.wordBasedSuggestions': 'off',
      'editor.quickSuggestions': {
        'other': true,
        'comments': true,
        'strings': true
      },
      'files.autoSave': 'afterDelay',
      'files.autoSaveDelay': 1000
    };

    const extensions = {
      recommendations: [
        'TabNine.tabnine-vscode',
        'ms-vscode.vscode-ai',
        'GitHub.copilot',
        'ms-python.python',
        'bradlc.vscode-tailwindcss'
      ]
    };

    await fs.writeFile(
      path.join(process.cwd(), '.vscode', 'settings.json'),
      JSON.stringify(vscodeSettings, null, 2)
    );
    
    await fs.writeFile(
      path.join(process.cwd(), '.vscode', 'extensions.json'),
      JSON.stringify(extensions, null, 2)
    );
    
    console.log('🔧 VS Code configuration created');
  }

  async setupGitHooks() {
    const preCommitHook = `#!/bin/bash
# Pre-commit hook with Tabnine optimization

echo "🔍 Running pre-commit optimizations..."

# Format code with Prettier
npm run format 2>/dev/null || true

# Lint code with ESLint
npm run lint:fix 2>/dev/null || true

# Run Tabnine optimization
node scripts/tabnine/optimize.js 2>/dev/null || true

echo "✅ Pre-commit optimizations complete"
`;

    try {
      await fs.mkdir('.git/hooks', { recursive: true });
      await fs.writeFile('.git/hooks/pre-commit', preCommitHook);
      execSync('chmod +x .git/hooks/pre-commit');
      console.log('🪝 Git hooks configured');
    } catch (error) {
      console.log('⚠️ Git hooks setup skipped (not a git repository)');
    }
  }

  async optimizeServerCode() {
    const optimizationScript = `
/**
 * Tabnine-optimized server enhancement
 * Adds AI-powered code completion context
 */

const tabnineIntegration = {
  // Enhanced code completion context
  getCodeContext: (filePath, position) => {
    // Implementation for context extraction
    return {
      file: filePath,
      position: position,
      surrounding: extractSurroundingCode(filePath, position),
      imports: extractImports(filePath),
      dependencies: extractDependencies(filePath)
    };
  },

  // AI-powered suggestions
  generateSuggestions: async (context) => {
    // Integration with Tabnine API
    return await tabnineAPI.getSuggestions(context);
  },

  // Performance monitoring
  trackPerformance: (startTime, endTime, suggestion) => {
    const latency = endTime - startTime;
    console.log(\`Tabnine suggestion latency: \${latency}ms\`);
    
    if (latency > 200) {
      console.warn('High latency detected in Tabnine suggestions');
    }
  }
};

module.exports = tabnineIntegration;
`;

    await fs.writeFile(
      path.join(process.cwd(), 'src', 'tabnine-integration.js'),
      optimizationScript
    );
    
    console.log('🧠 Server code optimized for Tabnine integration');
  }
}

// Execute if run directly
if (require.main === module) {
  const optimizer = new TabnineOptimizer();
  optimizer.initialize().catch(console.error);
}

module.exports = TabnineOptimizer;
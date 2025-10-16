export default {
  // ESM Configuration
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  
  // Test environment
  testEnvironment: 'node',
  
  // Module resolution for ESM
  moduleNameMapping: {
    '^(\.\.?\/.+)\.js$': '$1',
  },
  
  // Transform configuration with ESM support
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2022',
        moduleResolution: 'node'
      }
    }],
    '^.+\.jsx?$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
    }]
  },
  
  // File patterns - broader matching for better test discovery
  testMatch: [
    '**/tests/**/*.test.(js|ts|jsx|tsx)',
    '**/test/**/*.test.(js|ts|jsx|tsx)',
    '**/src/**/*.test.(js|ts|jsx|tsx)',
    '**/__tests__/**/*.(js|ts|jsx|tsx)',
    '**/*(test|spec).(js|ts|jsx|tsx)'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts,jsx,tsx}',
    'scripts/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/__tests__/**',
    '!scripts/DEPENDENCIES_MISSING.md',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  
  // Coverage thresholds - realistic for active development
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Timeout for tests
  testTimeout: 30000,
  
  // Performance optimization
  maxWorkers: '50%',
  
  // Silent mode for CI
  silent: process.env.CI === 'true',
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: false,
  
  // Global setup
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/reports/',
    '/website/'
  ],
  
  // Watch mode settings
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/reports/'
  ],
  
  // Mock files
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ]
};
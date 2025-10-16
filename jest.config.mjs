export default {
  // Use tsx for TypeScript transformation
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  
  // Test environment
  testEnvironment: 'node',
  
  // Module resolution
  moduleNameMapping: {
    '^(\\.\\.?\\/.+)\\.js$': '$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        target: 'es2022'
      }
    }]
  },
  
  // File patterns
  testMatch: [
    '**/tests/**/*.test.(js|ts)',
    '**/src/**/*.test.(js|ts)',
    '**/__tests__/**/*.(js|ts)'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Timeout for tests
  testTimeout: 30000
};
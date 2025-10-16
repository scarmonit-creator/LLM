/**
 * Jest Test Setup
 * Global test configuration and environment setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.AI_BRIDGE_PORT = '0'; // Use random port for testing

// Global test timeout
jest.setTimeout(30000);

// Mock external API calls during testing
if (!process.env.SKIP_API_MOCKS) {
  // Mock Anthropic API
  jest.mock('@anthropic-ai/sdk', () => {
    return {
      Anthropic: jest.fn().mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ text: 'Mocked response' }]
          })
        }
      }))
    };
  });

  // Mock WebSocket for AI Bridge
  jest.mock('ws', () => {
    return {
      WebSocketServer: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn()
      })),
      WebSocket: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
      }))
    };
  });
}

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cleanup after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  // Clear all mocks
  jest.clearAllMocks();
});

console.log('🧪 Test environment initialized');

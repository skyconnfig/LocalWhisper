// Global test setup
const { CONFIG, TestUtils } = require('./config');

// Jest setup
jest.setTimeout(CONFIG.TIMEOUT.LONG);

// Console overrides for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  originalConsoleError(...args);
};

// Global test helpers
global.TestUtils = TestUtils;
global.CONFIG = CONFIG;

// Cleanup function
global.cleanup = async () => {
  // Add any global cleanup logic here
  TestUtils.log.info('Running global cleanup...');
};
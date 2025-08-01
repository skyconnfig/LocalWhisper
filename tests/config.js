// Test configuration and global setup
const chalk = require('chalk');

// Test configuration
const CONFIG = {
  // Base URLs
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api',
  
  // Service URLs
  POSTGRES_URL: process.env.DATABASE_URL || 'postgresql://whisper_user:whisper_password@localhost:5432/whisper_db',
  REDIS_URL: process.env.REDIS_URL || 'redis://:redis123@localhost:6379',
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  
  // MinIO credentials
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME || 'audio-files',
  MINIO_TEMP_BUCKET_NAME: process.env.MINIO_TEMP_BUCKET_NAME || 'temp-files',
  
  // Test timeouts
  TIMEOUT: {
    SHORT: 5000,    // 5 seconds
    MEDIUM: 15000,  // 15 seconds
    LONG: 60000,    // 1 minute
    AI_MODEL: 120000 // 2 minutes for AI operations
  },
  
  // Test data
  TEST_USER: {
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User'
  },
  
  // Test files
  TEST_FILES: {
    SMALL_AUDIO: './test-data/small-audio.wav',
    LARGE_AUDIO: './test-data/large-audio.wav',
    INVALID_FILE: './test-data/invalid-file.txt',
    CORRUPTED_AUDIO: './test-data/corrupted-audio.wav'
  },
  
  // Performance thresholds
  PERFORMANCE: {
    API_RESPONSE_TIME: 2000,     // 2 seconds
    FILE_UPLOAD_TIME: 10000,     // 10 seconds
    TRANSCRIPTION_TIME: 30000,   // 30 seconds
    DB_QUERY_TIME: 1000,         // 1 second
    MEMORY_USAGE_MB: 512         // 512 MB
  }
};

// Test utilities
const TestUtils = {
  log: {
    info: (message) => console.log(chalk.blue(`ℹ ${message}`)),
    success: (message) => console.log(chalk.green(`✓ ${message}`)),
    error: (message) => console.log(chalk.red(`✗ ${message}`)),
    warning: (message) => console.log(chalk.yellow(`⚠ ${message}`)),
    test: (message) => console.log(chalk.cyan(`🧪 ${message}`))
  },
  
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  getCurrentTimestamp: () => new Date().toISOString(),
  
  formatDuration: (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  },
  
  formatBytes: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// Global test setup
global.beforeAll(() => {
  TestUtils.log.info('Starting test suite...');
  TestUtils.log.info(`Base URL: ${CONFIG.BASE_URL}`);
  TestUtils.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

global.afterAll(() => {
  TestUtils.log.info('Test suite completed');
});

module.exports = {
  CONFIG,
  TestUtils
};
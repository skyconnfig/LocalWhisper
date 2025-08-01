# 🎙️ Whisper Local Deployment Test Suite

A comprehensive testing framework for validating the functionality, performance, and reliability of your Whisper local deployment.

## 📁 Directory Structure

```
tests/
├── package.json                    # Test dependencies
├── jest.config.js                  # Jest configuration
├── config.js                       # Test configuration and utilities
├── setup.js                        # Global test setup
├── custom-sequencer.js             # Test execution order
├── run-all-tests.js                # Main test runner (executable)
│
├── services/                       # Service connection tests
│   ├── test-services.js            # Service connectivity tester
│   └── services.test.js            # Jest test cases
│
├── api/                            # API endpoint tests
│   ├── test-api-endpoints.js       # API endpoint tester
│   └── api.test.js                 # Jest test cases
│
├── frontend/                       # Frontend functionality tests
│   ├── test-frontend.js            # Frontend functionality tester
│   └── frontend.test.js            # Jest test cases
│
├── e2e/                            # End-to-end test scenarios
│   ├── test-e2e.js                 # E2E scenario tester
│   └── e2e.test.js                 # Jest test cases
│
├── performance/                    # Performance tests
│   ├── test-performance.js         # Performance tester
│   └── performance.test.js         # Jest test cases
│
├── error-handling/                 # Error handling tests
│   ├── test-error-handling.js      # Error handling tester
│   └── error-handling.test.js      # Jest test cases
│
├── utils/                          # Utilities
│   └── generate-report.js          # Test report generator
│
├── test-data/                      # Test files (created during tests)
├── screenshots/                    # Test screenshots (created during tests)
└── test-reports/                   # Generated reports
    ├── latest-report.html           # Latest HTML report
    ├── latest-report.json           # Latest JSON report
    ├── latest-report.md             # Latest Markdown report
    └── test-report-[timestamp].*    # Timestamped reports
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd tests
npm install
```

### 2. Configure Environment

The tests will use your existing environment configuration. Ensure your Whisper application is running:

```bash
# From the project root
docker-compose up -d
# or
npm run dev
```

### 3. Run All Tests

```bash
# Run all test categories
node run-all-tests.js

# Or use npm script
npm run test:all
```

## 🧪 Test Categories

### 1. Service Connection Tests (`services/`)
Tests connectivity to all backend services:
- **PostgreSQL Database**: Connection, queries, schema validation
- **Redis Cache**: Connection, set/get operations, performance
- **MinIO Storage**: Connection, bucket access, file operations
- **Ollama AI**: Connection, model availability, basic inference

### 2. API Endpoint Tests (`api/`)
Tests REST API functionality:
- **Health Endpoint**: Application status and service health
- **Authentication**: User registration, login, token validation
- **File Upload**: Audio file upload and validation
- **Transcription**: Audio-to-text conversion endpoints
- **Transformation**: Text transformation and AI processing
- **File Management**: File listing, access, and metadata

### 3. Frontend Functionality Tests (`frontend/`)
Tests user interface using Puppeteer:
- **Page Load**: Application loading and rendering
- **Authentication UI**: Login/register forms and flows
- **Recording Interface**: Audio recording controls and feedback
- **File Upload UI**: Drag-and-drop and file selection
- **History View**: Transcription listing and navigation
- **Navigation**: Menu and routing functionality

### 4. End-to-End Tests (`e2e/`)
Tests complete user workflows:
- **User Registration Flow**: Complete signup and login process
- **Audio Recording Flow**: Record, stop, and upload audio
- **File Upload Flow**: Select, upload, and process files
- **Transcription Flow**: Generate and view transcriptions
- **File Management Flow**: Browse, search, and manage files

### 5. Performance Tests (`performance/`)
Tests system performance and scalability:
- **API Response Times**: Endpoint latency and throughput
- **File Upload Performance**: Upload speed for various file sizes
- **Database Query Performance**: Database operation timing
- **AI Model Performance**: Transcription and transformation speed
- **Memory Usage**: Application memory consumption
- **Concurrent Users**: Multiple simultaneous user simulation

### 6. Error Handling Tests (`error-handling/`)
Tests system resilience and error recovery:
- **Service Offline Handling**: Behavior when services are unavailable
- **Invalid File Handling**: Response to corrupted or invalid files
- **Network Error Handling**: Timeout and connection error management
- **Authentication Errors**: Invalid credentials and token handling
- **Rate Limiting**: Protection against abuse and overload
- **Disk Space Handling**: Graceful handling of storage limitations

## 🎯 Running Specific Tests

### Individual Test Categories

```bash
# Service tests only
npm run test:services

# API tests only
npm run test:api

# Frontend tests only (requires display)
npm run test:frontend

# E2E tests only (requires display)
npm run test:e2e

# Performance tests only
npm run test:performance

# Error handling tests only
npm run test:error-handling
```

### Using the Main Runner with Options

```bash
# Skip specific test categories
node run-all-tests.js --skip-e2e --skip-performance

# Verbose output
node run-all-tests.js --verbose

# Skip report generation
node run-all-tests.js --no-report

# Run tests in parallel (experimental)
node run-all-tests.js --parallel

# Show help
node run-all-tests.js --help
```

### Using Jest Directly

```bash
# Run all Jest tests
npm test

# Run specific test files
npm test services
npm test api
npm test frontend

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📊 Test Reports

The test suite generates comprehensive reports in multiple formats:

### HTML Report (`test-reports/latest-report.html`)
- Visual dashboard with charts and metrics
- Detailed test results with color-coded status
- Interactive elements and responsive design
- Perfect for sharing with stakeholders

### JSON Report (`test-reports/latest-report.json`)
- Machine-readable format for automation
- Complete test data with timestamps and metrics
- Integration with CI/CD pipelines
- Custom analysis and processing

### Markdown Report (`test-reports/latest-report.md`)
- Human-readable format for documentation
- Table-formatted results
- Recommendations and troubleshooting tips
- Version control friendly

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the tests directory or set environment variables:

```bash
# Application URLs
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000/api

# Service URLs
DATABASE_URL=postgresql://whisper_user:whisper_password@localhost:5432/whisper_db
REDIS_URL=redis://:redis123@localhost:6379
MINIO_ENDPOINT=http://localhost:9000
OLLAMA_BASE_URL=http://localhost:11434

# MinIO Credentials
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=audio-files
MINIO_TEMP_BUCKET_NAME=temp-files

# Test Configuration
VERBOSE_TESTS=false
NODE_ENV=test
```

### Performance Thresholds

Adjust performance expectations in `config.js`:

```javascript
PERFORMANCE: {
  API_RESPONSE_TIME: 2000,     // 2 seconds
  FILE_UPLOAD_TIME: 10000,     // 10 seconds  
  TRANSCRIPTION_TIME: 30000,   // 30 seconds
  DB_QUERY_TIME: 1000,         // 1 second
  MEMORY_USAGE_MB: 512         // 512 MB
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Tests failing with connection errors**:
   ```bash
   # Check if services are running
   docker-compose ps
   
   # Check service logs
   docker-compose logs [service-name]
   ```

2. **Frontend/E2E tests failing**:
   ```bash
   # Install required dependencies for headless browser
   sudo apt-get install -y chromium-browser
   
   # Or run with display (Linux)
   export DISPLAY=:0
   ```

3. **Performance tests failing**:
   - Check system resources (CPU, memory, disk)
   - Adjust performance thresholds in config
   - Ensure no other applications are consuming resources

4. **File upload tests failing**:
   ```bash
   # Check disk space
   df -h
   
   # Check MinIO bucket permissions
   docker-compose exec minio mc ls myminio/
   ```

### Debug Mode

Run tests with verbose output for detailed debugging:

```bash
node run-all-tests.js --verbose
```

Check individual test logs:
```bash
# Run specific test with debug output
node services/test-services.js
node api/test-api-endpoints.js
# etc.
```

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Whisper Deployment
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Start services
        run: docker-compose up -d
        
      - name: Wait for services
        run: sleep 30
        
      - name: Install test dependencies
        run: |
          cd tests
          npm install
          
      - name: Run tests
        run: |
          cd tests
          node run-all-tests.js --skip-frontend --skip-e2e
          
      - name: Upload test reports
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: tests/test-reports/
```

### Docker Integration

Run tests in Docker container:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY tests/ ./tests/
RUN cd tests && npm install
CMD ["node", "tests/run-all-tests.js"]
```

## 📈 Extending the Test Suite

### Adding New Test Categories

1. Create a new directory: `mkdir tests/my-category/`
2. Create the tester class: `tests/my-category/test-my-category.js`
3. Create Jest tests: `tests/my-category/my-category.test.js`
4. Add to main runner: Update `run-all-tests.js`

### Adding Custom Tests

```javascript
// tests/my-category/test-my-category.js
const { CONFIG, TestUtils } = require('../config');

class MyCategoryTester {
  constructor() {
    this.results = {};
  }

  async testMyFeature() {
    const startTime = Date.now();
    TestUtils.log.test('Testing my feature...');
    
    try {
      // Your test logic here
      const duration = Date.now() - startTime;
      
      this.results.myFeature = {
        status: 'healthy',
        message: 'Feature works correctly',
        duration,
        details: {}
      };
      
      TestUtils.log.success(`My feature: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.myFeature = {
        status: 'unhealthy',
        message: `Feature failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`My feature failed: ${error.message}`);
    }
  }

  async runAllTests() {
    TestUtils.log.info('Starting my category tests...');
    const startTime = Date.now();
    
    await this.testMyFeature();
    
    const totalDuration = Date.now() - startTime;
    
    return {
      summary: {
        totalDuration,
        // ... summary data
      },
      results: this.results
    };
  }
}

module.exports = MyCategoryTester;
```

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review test logs and reports
3. Ensure all services are properly configured
4. Check the main project documentation
5. Create an issue with detailed test output

---

*This test suite ensures your Whisper local deployment is robust, performant, and reliable. Run it regularly to catch issues early and maintain deployment health.*
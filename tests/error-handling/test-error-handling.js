// Error handling and resilience tests
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { CONFIG, TestUtils } = require('../config');

class ErrorHandlingTester {
  constructor() {
    this.results = {
      serviceOfflineHandling: { status: 'unknown', message: '', scenarios: {} },
      invalidFileHandling: { status: 'unknown', message: '', scenarios: {} },
      networkErrorHandling: { status: 'unknown', message: '', scenarios: {} },
      authenticationErrors: { status: 'unknown', message: '', scenarios: {} },
      rateLimitingHandling: { status: 'unknown', message: '', scenarios: {} },
      diskSpaceHandling: { status: 'unknown', message: '', scenarios: {} }
    };
  }

  async createInvalidFiles() {
    const testDataDir = path.join(__dirname, '..', 'test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    const invalidFiles = {
      // Empty file
      emptyFile: {
        path: path.join(testDataDir, 'empty.txt'),
        content: Buffer.alloc(0)
      },
      // Text file with audio extension
      fakeAudio: {
        path: path.join(testDataDir, 'fake.wav'),
        content: Buffer.from('This is not an audio file')
      },
      // Corrupted header
      corruptedWav: {
        path: path.join(testDataDir, 'corrupted.wav'),
        content: Buffer.from('CORRUPTED_HEADER_DATA_NOT_VALID_WAV_FORMAT')
      },
      // Extremely large file (simulate)
      largeFile: {
        path: path.join(testDataDir, 'large.wav'),
        content: Buffer.alloc(1024 * 1024, 0) // 1MB of zeros
      },
      // Binary file with wrong extension
      binaryFile: {
        path: path.join(testDataDir, 'binary.mp3'),
        content: Buffer.from([0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA])
      }
    };
    
    Object.entries(invalidFiles).forEach(([name, file]) => {
      fs.writeFileSync(file.path, file.content);
    });
    
    return invalidFiles;
  }

  async testServiceOfflineHandling() {
    const startTime = Date.now();
    TestUtils.log.test('Testing service offline error handling...');
    
    const scenarios = {};
    
    // Test non-existent service endpoints
    const offlineTests = [
      {
        name: 'nonExistentAPI',
        url: 'http://localhost:9999/api/health',
        expectedBehavior: 'Connection refused or timeout'
      },
      {
        name: 'invalidDatabaseConnection',
        url: `${CONFIG.API_BASE_URL}/health`,
        expectedBehavior: 'Graceful degradation'
      },
      {
        name: 'ollama_offline',
        url: 'http://localhost:11435/api/version', // Wrong port
        expectedBehavior: 'Service unavailable error'
      }
    ];
    
    for (const test of offlineTests) {
      try {
        const testStart = Date.now();
        
        const response = await axios.get(test.url, {
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          response: response.data,
          handledGracefully: response.status >= 500 || response.status === 503
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: false,
          error: error.message,
          duration: testDuration,
          errorType: error.code,
          handledGracefully: error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT'
        };
      }
      
      await TestUtils.delay(500);
    }
    
    const duration = Date.now() - startTime;
    const gracefullyHandled = Object.values(scenarios).filter(s => s.handledGracefully).length;
    const totalTests = Object.keys(scenarios).length;
    
    this.results.serviceOfflineHandling = {
      status: gracefullyHandled >= totalTests * 0.5 ? 'healthy' : 'unhealthy',
      message: `Gracefully handled: ${gracefullyHandled}/${totalTests} offline service scenarios`,
      scenarios,
      metrics: {
        gracefullyHandled,
        totalTests,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Service offline handling: ${TestUtils.formatDuration(duration)}`);
  }

  async testInvalidFileHandling() {
    const startTime = Date.now();
    TestUtils.log.test('Testing invalid file error handling...');
    
    const scenarios = {};
    const invalidFiles = await this.createInvalidFiles();
    
    for (const [fileName, fileInfo] of Object.entries(invalidFiles)) {
      try {
        const testStart = Date.now();
        
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(fileInfo.path));
        formData.append('name', `Invalid File Test - ${fileName}`);
        
        const response = await axios.post(`${CONFIG.API_BASE_URL}/local-upload`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          timeout: CONFIG.TIMEOUT.MEDIUM,
          validateStatus: () => true // Accept any status code
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[fileName] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          response: response.data,
          rejectedAsExpected: response.status >= 400 && response.status < 500,
          fileSize: fileInfo.content.length
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[fileName] = {
          success: false,
          error: error.message,
          duration: testDuration,
          errorType: error.code,
          rejectedAsExpected: error.response?.status >= 400 && error.response?.status < 500,
          fileSize: fileInfo.content.length
        };
      }
      
      await TestUtils.delay(500);
    }
    
    // Cleanup test files
    Object.values(invalidFiles).forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    
    const duration = Date.now() - startTime;
    const properlyRejected = Object.values(scenarios).filter(s => s.rejectedAsExpected).length;
    const totalTests = Object.keys(scenarios).length;
    
    this.results.invalidFileHandling = {
      status: properlyRejected >= totalTests * 0.7 ? 'healthy' : 'unhealthy',
      message: `Properly rejected: ${properlyRejected}/${totalTests} invalid file uploads`,
      scenarios,
      metrics: {
        properlyRejected,
        totalTests,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Invalid file handling: ${TestUtils.formatDuration(duration)}`);
  }

  async testNetworkErrorHandling() {
    const startTime = Date.now();
    TestUtils.log.test('Testing network error handling...');
    
    const scenarios = {};
    
    // Test timeout scenarios
    const timeoutTests = [
      {
        name: 'veryShortTimeout',
        timeout: 1,
        url: `${CONFIG.API_BASE_URL}/health`
      },
      {
        name: 'mediumTimeout',
        timeout: 100,
        url: `${CONFIG.API_BASE_URL}/files`
      }
    ];
    
    for (const test of timeoutTests) {
      try {
        const testStart = Date.now();
        
        const response = await axios.get(test.url, {
          timeout: test.timeout,
          validateStatus: () => true
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          timeoutOccurred: false,
          expectedTimeout: test.timeout
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: false,
          error: error.message,
          duration: testDuration,
          timeoutOccurred: error.code === 'ECONNABORTED',
          expectedTimeout: test.timeout,
          handledGracefully: error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
        };
      }
      
      await TestUtils.delay(500);
    }
    
    // Test malformed requests
    const malformedTests = [
      {
        name: 'invalidJSON',
        data: '{"invalid": json}',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        name: 'missingContentType',
        data: { test: 'data' },
        headers: {}
      }
    ];
    
    for (const test of malformedTests) {
      try {
        const testStart = Date.now();
        
        const response = await axios.post(`${CONFIG.API_BASE_URL}/transform`, test.data, {
          headers: test.headers,
          timeout: CONFIG.TIMEOUT.MEDIUM,
          validateStatus: () => true
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          rejectedProperly: response.status >= 400 && response.status < 500
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: false,
          error: error.message,
          duration: testDuration,
          rejectedProperly: error.response?.status >= 400 && error.response?.status < 500
        };
      }
      
      await TestUtils.delay(500);
    }
    
    const duration = Date.now() - startTime;
    const handledGracefully = Object.values(scenarios).filter(s => 
      s.handledGracefully || s.rejectedProperly || s.timeoutOccurred
    ).length;
    const totalTests = Object.keys(scenarios).length;
    
    this.results.networkErrorHandling = {
      status: handledGracefully >= totalTests * 0.6 ? 'healthy' : 'unhealthy',
      message: `Gracefully handled: ${handledGracefully}/${totalTests} network error scenarios`,
      scenarios,
      metrics: {
        handledGracefully,
        totalTests,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Network error handling: ${TestUtils.formatDuration(duration)}`);
  }

  async testAuthenticationErrors() {
    const startTime = Date.now();
    TestUtils.log.test('Testing authentication error handling...');
    
    const scenarios = {};
    
    const authTests = [
      {
        name: 'noAuthToken',
        headers: {},
        url: `${CONFIG.API_BASE_URL}/files`
      },
      {
        name: 'invalidAuthToken',
        headers: { 'Authorization': 'Bearer invalid_token_12345' },
        url: `${CONFIG.API_BASE_URL}/files`
      },
      {
        name: 'expiredToken',
        headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid' },
        url: `${CONFIG.API_BASE_URL}/files`
      },
      {
        name: 'malformedAuthHeader',
        headers: { 'Authorization': 'InvalidFormat' },
        url: `${CONFIG.API_BASE_URL}/files`
      }
    ];
    
    for (const test of authTests) {
      try {
        const testStart = Date.now();
        
        const response = await axios.get(test.url, {
          headers: test.headers,
          timeout: CONFIG.TIMEOUT.MEDIUM,
          validateStatus: () => true
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          properlyRejected: response.status === 401 || response.status === 403,
          response: response.data
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: false,
          error: error.message,
          duration: testDuration,
          properlyRejected: error.response?.status === 401 || error.response?.status === 403
        };
      }
      
      await TestUtils.delay(500);
    }
    
    // Test invalid login attempts
    const loginTests = [
      {
        name: 'invalidCredentials',
        data: { email: 'nonexistent@example.com', password: 'wrongpassword' }
      },
      {
        name: 'missingPassword',
        data: { email: 'test@example.com' }
      },
      {
        name: 'missingEmail',
        data: { password: 'password123' }
      }
    ];
    
    for (const test of loginTests) {
      try {
        const testStart = Date.now();
        
        const response = await axios.post(`${CONFIG.API_BASE_URL}/auth/signin`, test.data, {
          timeout: CONFIG.TIMEOUT.MEDIUM,
          validateStatus: () => true
        });
        
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: true,
          httpStatus: response.status,
          duration: testDuration,
          properlyRejected: response.status >= 400 && response.status < 500
        };
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        
        scenarios[test.name] = {
          success: false,
          error: error.message,
          duration: testDuration,
          properlyRejected: error.response?.status >= 400 && error.response?.status < 500
        };
      }
      
      await TestUtils.delay(500);
    }
    
    const duration = Date.now() - startTime;
    const properlyRejected = Object.values(scenarios).filter(s => s.properlyRejected).length;
    const totalTests = Object.keys(scenarios).length;
    
    this.results.authenticationErrors = {
      status: properlyRejected >= totalTests * 0.8 ? 'healthy' : 'unhealthy',
      message: `Properly rejected: ${properlyRejected}/${totalTests} authentication error scenarios`,
      scenarios,
      metrics: {
        properlyRejected,
        totalTests,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Authentication errors: ${TestUtils.formatDuration(duration)}`);
  }

  async testRateLimitingHandling() {
    const startTime = Date.now();
    TestUtils.log.test('Testing rate limiting error handling...');
    
    const scenarios = {};
    
    try {
      // Test rapid requests to health endpoint
      const rapidRequests = Array.from({ length: 50 }, (_, i) => 
        axios.get(`${CONFIG.API_BASE_URL}/health`, {
          timeout: CONFIG.TIMEOUT.SHORT,
          validateStatus: () => true
        }).catch(error => ({
          error: error.message,
          status: error.response?.status || 0
        }))
      );
      
      const results = await Promise.all(rapidRequests);
      
      const successfulRequests = results.filter(r => !r.error && r.status === 200).length;
      const rateLimitedRequests = results.filter(r => 
        r.status === 429 || (r.error && r.error.includes('rate limit'))
      ).length;
      const totalRequests = results.length;
      
      scenarios.rapidHealthRequests = {
        totalRequests,
        successfulRequests,
        rateLimitedRequests,
        rateLimitingActive: rateLimitedRequests > 0,
        results: results.slice(0, 10) // Sample of results
      };
      
      // Test file upload rate limiting
      await TestUtils.delay(2000); // Wait before next test
      
      const testFileName = `rate_limit_test_${TestUtils.generateTestId()}.wav`;
      const testFilePath = path.join(__dirname, '..', 'test-data', testFileName);
      
      // Create small test file
      const testDataDir = path.dirname(testFilePath);
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
      
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
        0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
        0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
        0x00, 0x08, 0x00, 0x00
      ]);
      const silenceData = Buffer.alloc(1024, 0);
      fs.writeFileSync(testFilePath, Buffer.concat([wavHeader, silenceData]));
      
      // Test rapid file uploads
      const uploadTests = Array.from({ length: 10 }, async (_, i) => {
        try {
          const formData = new FormData();
          formData.append('audio', fs.createReadStream(testFilePath));
          formData.append('name', `Rate Limit Test ${i}`);
          
          const response = await axios.post(`${CONFIG.API_BASE_URL}/local-upload`, formData, {
            headers: {
              ...formData.getHeaders()
            },
            timeout: CONFIG.TIMEOUT.MEDIUM,
            validateStatus: () => true
          });
          
          return {
            status: response.status,
            success: response.status < 400
          };
          
        } catch (error) {
          return {
            error: error.message,
            status: error.response?.status || 0,
            success: false
          };
        }
      });
      
      const uploadResults = await Promise.all(uploadTests);
      
      // Cleanup test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      
      const successfulUploads = uploadResults.filter(r => r.success).length;
      const rateLimitedUploads = uploadResults.filter(r => r.status === 429).length;
      
      scenarios.rapidUploads = {
        totalUploads: uploadResults.length,
        successfulUploads,
        rateLimitedUploads,
        rateLimitingActive: rateLimitedUploads > 0,
        results: uploadResults
      };
      
    } catch (error) {
      scenarios.error = error.message;
    }
    
    const duration = Date.now() - startTime;
    const hasRateLimiting = Object.values(scenarios).some(s => s.rateLimitingActive);
    
    this.results.rateLimitingHandling = {
      status: hasRateLimiting ? 'healthy' : 'partial',
      message: `Rate limiting ${hasRateLimiting ? 'detected and working' : 'not detected or not configured'}`,
      scenarios,
      metrics: {
        hasRateLimiting,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Rate limiting handling: ${TestUtils.formatDuration(duration)}`);
  }

  async testDiskSpaceHandling() {
    const startTime = Date.now();
    TestUtils.log.test('Testing disk space error handling...');
    
    const scenarios = {};
    
    try {
      // Test with very large file (simulated)
      const largeFileName = `large_file_test_${TestUtils.generateTestId()}.wav`;
      const largeFilePath = path.join(__dirname, '..', 'test-data', largeFileName);
      
      const testDataDir = path.dirname(largeFilePath);
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
      
      // Create a 50MB file
      const largeFileSize = 50 * 1024 * 1024; // 50MB
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
        0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
        0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
        0x00, 0x00, 0x00, 0x00
      ]);
      
      // Write file in chunks to avoid memory issues
      const writeStream = fs.createWriteStream(largeFilePath);
      writeStream.write(wavHeader);
      
      const chunkSize = 1024 * 1024; // 1MB chunks
      const dataSize = largeFileSize - wavHeader.length;
      const numChunks = Math.floor(dataSize / chunkSize);
      
      for (let i = 0; i < numChunks; i++) {
        const chunk = Buffer.alloc(chunkSize, 0);
        writeStream.write(chunk);
      }
      
      // Write remaining bytes
      const remainingBytes = dataSize % chunkSize;
      if (remainingBytes > 0) {
        const finalChunk = Buffer.alloc(remainingBytes, 0);
        writeStream.write(finalChunk);
      }
      
      writeStream.end();
      
      // Wait for file to be written
      await new Promise((resolve) => {
        writeStream.on('finish', resolve);
      });
      
      // Test uploading large file
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(largeFilePath));
      formData.append('name', 'Large File Disk Space Test');
      
      try {
        const response = await axios.post(`${CONFIG.API_BASE_URL}/local-upload`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          timeout: CONFIG.TIMEOUT.LONG * 2,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: () => true
        });
        
        scenarios.largeFileUpload = {
          success: true,
          httpStatus: response.status,
          fileSize: largeFileSize,
          handledProperly: response.status === 413 || response.status === 507 || response.status < 400,
          response: response.data
        };
        
      } catch (error) {
        scenarios.largeFileUpload = {
          success: false,
          error: error.message,
          fileSize: largeFileSize,
          handledProperly: error.code === 'ENOSPC' || error.response?.status === 413 || error.response?.status === 507
        };
      }
      
      // Cleanup large file
      if (fs.existsSync(largeFilePath)) {
        fs.unlinkSync(largeFilePath);
      }
      
      // Test multiple simultaneous uploads
      const simultaneousUploads = 5;
      const uploadPromises = [];
      
      for (let i = 0; i < simultaneousUploads; i++) {
        const testFileName = `simultaneous_${i}_${TestUtils.generateTestId()}.wav`;
        const testFilePath = path.join(testDataDir, testFileName);
        
        // Create 10MB file
        const mediumFileSize = 10 * 1024 * 1024;
        const fileContent = Buffer.concat([
          wavHeader,
          Buffer.alloc(mediumFileSize - wavHeader.length, 0)
        ]);
        fs.writeFileSync(testFilePath, fileContent);
        
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(testFilePath));
        formData.append('name', `Simultaneous Upload Test ${i}`);
        
        uploadPromises.push(
          axios.post(`${CONFIG.API_BASE_URL}/local-upload`, formData, {
            headers: {
              ...formData.getHeaders()
            },
            timeout: CONFIG.TIMEOUT.LONG,
            validateStatus: () => true
          }).catch(error => ({
            error: error.message,
            status: error.response?.status || 0
          })).finally(() => {
            // Cleanup
            if (fs.existsSync(testFilePath)) {
              fs.unlinkSync(testFilePath);
            }
          })
        );
      }
      
      const simultaneousResults = await Promise.all(uploadPromises);
      
      const successfulSimultaneous = simultaneousResults.filter(r => !r.error && r.status < 400).length;
      const diskSpaceErrors = simultaneousResults.filter(r => 
        r.status === 507 || (r.error && r.error.includes('ENOSPC'))
      ).length;
      
      scenarios.simultaneousUploads = {
        totalUploads: simultaneousUploads,
        successfulUploads: successfulSimultaneous,
        diskSpaceErrors,
        results: simultaneousResults
      };
      
    } catch (error) {
      scenarios.error = error.message;
    }
    
    const duration = Date.now() - startTime;
    const handledProperly = Object.values(scenarios)
      .filter(s => s.handledProperly !== undefined)
      .every(s => s.handledProperly);
    
    this.results.diskSpaceHandling = {
      status: handledProperly ? 'healthy' : 'partial',
      message: `Disk space errors handled properly: ${handledProperly ? 'YES' : 'PARTIAL'}`,
      scenarios,
      metrics: {
        handledProperly,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Disk space handling: ${TestUtils.formatDuration(duration)}`);
  }

  async runAllTests() {
    TestUtils.log.info('Starting error handling tests...');
    const startTime = Date.now();
    
    // Run error handling tests
    await this.testServiceOfflineHandling();
    await this.testInvalidFileHandling();
    await this.testNetworkErrorHandling();
    await this.testAuthenticationErrors();
    await this.testRateLimitingHandling();
    await this.testDiskSpaceHandling();
    
    const totalDuration = Date.now() - startTime;
    
    // Generate summary
    const healthyTests = Object.values(this.results).filter(r => r.status === 'healthy' || r.status === 'partial').length;
    const totalTests = Object.keys(this.results).length;
    
    TestUtils.log.info(`\\n=== Error Handling Test Results ===`);
    TestUtils.log.info(`Total Duration: ${TestUtils.formatDuration(totalDuration)}`);
    TestUtils.log.info(`Robust Error Handling: ${healthyTests}/${totalTests}`);
    
    Object.entries(this.results).forEach(([test, result]) => {
      const statusIcon = result.status === 'healthy' ? '✓' : result.status === 'partial' ? '⚠' : '✗';
      
      console.log(`${statusIcon} ${test.toUpperCase()}: ${result.message}`);
    });
    
    return {
      summary: {
        totalDuration,
        healthyTests,
        totalTests,
        robustErrorHandling: healthyTests >= totalTests * 0.8
      },
      results: this.results
    };
  }
}

// CLI execution
if (require.main === module) {
  const tester = new ErrorHandlingTester();
  tester.runAllTests()
    .then(results => {
      if (results.summary.robustErrorHandling) {
        TestUtils.log.success('Error handling is robust!');
        process.exit(0);
      } else {
        TestUtils.log.warning('Error handling needs improvement!');
        process.exit(1);
      }
    })
    .catch(error => {
      TestUtils.log.error(`Error handling test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = ErrorHandlingTester;
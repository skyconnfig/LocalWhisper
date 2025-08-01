// Performance tests
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { CONFIG, TestUtils } = require('../config');

class PerformanceTester {
  constructor() {
    this.results = {
      apiResponseTime: { status: 'unknown', message: '', metrics: {} },
      fileUploadPerformance: { status: 'unknown', message: '', metrics: {} },
      databaseQueryPerformance: { status: 'unknown', message: '', metrics: {} },
      aiModelPerformance: { status: 'unknown', message: '', metrics: {} },
      memoryUsage: { status: 'unknown', message: '', metrics: {} },
      concurrentUsers: { status: 'unknown', message: '', metrics: {} }
    };
  }

  async createTestAudioFile(sizeInMB = 1) {
    const testFileName = `perf_test_${sizeInMB}mb_${TestUtils.generateTestId()}.wav`;
    const testFilePath = path.join(__dirname, '..', 'test-data', testFileName);
    
    // Ensure test-data directory exists
    const testDataDir = path.dirname(testFilePath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    // Create WAV file with specified size
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x00, 0x00, 0x00, 0x00, // File size (will be updated)
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Chunk size
      0x01, 0x00,             // Audio format (PCM)
      0x01, 0x00,             // Number of channels
      0x44, 0xac, 0x00, 0x00, // Sample rate (44100)
      0x88, 0x58, 0x01, 0x00, // Byte rate
      0x02, 0x00,             // Block align
      0x10, 0x00,             // Bits per sample
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Data size (will be updated)
    ]);
    
    const targetDataSize = (sizeInMB * 1024 * 1024) - wavHeader.length;
    const silenceData = Buffer.alloc(targetDataSize, 0);
    
    // Update file size and data size in header
    const totalSize = wavHeader.length + silenceData.length - 8;
    wavHeader.writeUInt32LE(totalSize, 4);
    wavHeader.writeUInt32LE(silenceData.length, 40);
    
    const testFileContent = Buffer.concat([wavHeader, silenceData]);
    fs.writeFileSync(testFilePath, testFileContent);
    
    return testFilePath;
  }

  async testAPIResponseTimes() {
    const startTime = Date.now();
    TestUtils.log.test('Testing API response times...');
    
    const endpoints = [
      { name: 'health', url: `${CONFIG.API_BASE_URL}/health`, method: 'GET' },
      { name: 'files', url: `${CONFIG.API_BASE_URL}/files`, method: 'GET' }
    ];
    
    const responseTimes = {};
    const errors = [];
    
    for (const endpoint of endpoints) {
      const measurements = [];
      
      // Run 10 requests for each endpoint
      for (let i = 0; i < 10; i++) {
        try {
          const requestStart = performance.now();
          
          const config = {
            timeout: CONFIG.TIMEOUT.MEDIUM,
            validateStatus: (status) => status < 500 // Accept 4xx as valid responses
          };
          
          if (endpoint.method === 'GET') {
            await axios.get(endpoint.url, config);
          } else {
            await axios.post(endpoint.url, {}, config);
          }
          
          const requestEnd = performance.now();
          measurements.push(requestEnd - requestStart);
          
          // Small delay between requests
          await TestUtils.delay(100);
          
        } catch (error) {
          errors.push(`${endpoint.name}: ${error.message}`);
        }
      }
      
      if (measurements.length > 0) {
        responseTimes[endpoint.name] = {
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
          p95: measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)],
          count: measurements.length
        };
      }
    }
    
    const duration = Date.now() - startTime;
    const avgResponseTime = Object.values(responseTimes).reduce((acc, curr) => acc + curr.avg, 0) / Object.keys(responseTimes).length;
    const withinThreshold = avgResponseTime <= CONFIG.PERFORMANCE.API_RESPONSE_TIME;
    
    this.results.apiResponseTime = {
      status: withinThreshold ? 'healthy' : 'unhealthy',
      message: `Average response time: ${avgResponseTime.toFixed(2)}ms (threshold: ${CONFIG.PERFORMANCE.API_RESPONSE_TIME}ms). Errors: ${errors.length}`,
      metrics: {
        averageResponseTime: avgResponseTime,
        threshold: CONFIG.PERFORMANCE.API_RESPONSE_TIME,
        withinThreshold,
        responseTimes,
        errors,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`API response times: ${TestUtils.formatDuration(duration)}`);
  }

  async testFileUploadPerformance() {
    const startTime = Date.now();
    TestUtils.log.test('Testing file upload performance...');
    
    const fileSizes = [1, 5, 10]; // MB
    const uploadMetrics = {};
    
    for (const sizeInMB of fileSizes) {
      try {
        TestUtils.log.info(`Testing ${sizeInMB}MB file upload...`);
        
        const testFilePath = await this.createTestAudioFile(sizeInMB);
        const fileStats = fs.statSync(testFilePath);
        
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(testFilePath));
        formData.append('name', `Performance Test ${sizeInMB}MB`);
        
        const uploadStart = performance.now();
        
        try {
          const response = await axios.post(`${CONFIG.API_BASE_URL}/local-upload`, formData, {
            headers: {
              ...formData.getHeaders()
            },
            timeout: CONFIG.TIMEOUT.LONG,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: (status) => status < 500
          });
          
          const uploadEnd = performance.now();
          const uploadTime = uploadEnd - uploadStart;
          const throughput = (fileStats.size / 1024 / 1024) / (uploadTime / 1000); // MB/s
          
          uploadMetrics[`${sizeInMB}MB`] = {
            fileSize: fileStats.size,
            uploadTime,
            throughput,
            success: response.status < 400,
            httpStatus: response.status
          };
          
        } catch (uploadError) {
          const uploadEnd = performance.now();
          const uploadTime = uploadEnd - uploadStart;
          
          uploadMetrics[`${sizeInMB}MB`] = {
            fileSize: fileStats.size,
            uploadTime,
            throughput: 0,
            success: false,
            error: uploadError.message
          };
        }
        
        // Cleanup test file
        fs.unlinkSync(testFilePath);
        
      } catch (error) {
        uploadMetrics[`${sizeInMB}MB`] = {
          success: false,
          error: error.message
        };
      }
    }
    
    const duration = Date.now() - startTime;
    const successfulUploads = Object.values(uploadMetrics).filter(m => m.success).length;
    const avgThroughput = Object.values(uploadMetrics)
      .filter(m => m.success && m.throughput > 0)
      .reduce((acc, curr) => acc + curr.throughput, 0) / successfulUploads || 0;
    
    this.results.fileUploadPerformance = {
      status: successfulUploads > 0 ? 'healthy' : 'unhealthy',
      message: `Successful uploads: ${successfulUploads}/${fileSizes.length}. Average throughput: ${avgThroughput.toFixed(2)} MB/s`,
      metrics: {
        uploadMetrics,
        successfulUploads,
        totalTests: fileSizes.length,
        averageThroughput: avgThroughput,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`File upload performance: ${TestUtils.formatDuration(duration)}`);
  }

  async testDatabaseQueryPerformance() {
    const startTime = Date.now();
    TestUtils.log.test('Testing database query performance...');
    
    const queryMetrics = {};
    
    try {
      // Test basic health endpoint which should include DB queries
      const measurements = [];
      
      for (let i = 0; i < 20; i++) {
        const queryStart = performance.now();
        
        try {
          await axios.get(`${CONFIG.API_BASE_URL}/health`, {
            timeout: CONFIG.TIMEOUT.SHORT
          });
          
          const queryEnd = performance.now();
          measurements.push(queryEnd - queryStart);
          
        } catch (error) {
          // Continue testing even if some queries fail
        }
        
        await TestUtils.delay(50);
      }
      
      if (measurements.length > 0) {
        queryMetrics.healthEndpoint = {
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
          p95: measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)],
          count: measurements.length
        };
      }
      
      // Test files endpoint (likely involves database queries)
      const fileQueryMeasurements = [];
      
      for (let i = 0; i < 10; i++) {
        const queryStart = performance.now();
        
        try {
          await axios.get(`${CONFIG.API_BASE_URL}/files`, {
            timeout: CONFIG.TIMEOUT.MEDIUM,
            validateStatus: (status) => status < 500
          });
          
          const queryEnd = performance.now();
          fileQueryMeasurements.push(queryEnd - queryStart);
          
        } catch (error) {
          // Continue testing
        }
        
        await TestUtils.delay(100);
      }
      
      if (fileQueryMeasurements.length > 0) {
        queryMetrics.filesEndpoint = {
          min: Math.min(...fileQueryMeasurements),
          max: Math.max(...fileQueryMeasurements),
          avg: fileQueryMeasurements.reduce((a, b) => a + b, 0) / fileQueryMeasurements.length,
          p95: fileQueryMeasurements.sort((a, b) => a - b)[Math.floor(fileQueryMeasurements.length * 0.95)],
          count: fileQueryMeasurements.length
        };
      }
      
    } catch (error) {
      queryMetrics.error = error.message;
    }
    
    const duration = Date.now() - startTime;
    const avgQueryTime = Object.values(queryMetrics)
      .filter(m => m.avg)
      .reduce((acc, curr) => acc + curr.avg, 0) / Object.keys(queryMetrics).length || 0;
    
    const withinThreshold = avgQueryTime <= CONFIG.PERFORMANCE.DB_QUERY_TIME;
    
    this.results.databaseQueryPerformance = {
      status: withinThreshold ? 'healthy' : 'unhealthy',
      message: `Average query time: ${avgQueryTime.toFixed(2)}ms (threshold: ${CONFIG.PERFORMANCE.DB_QUERY_TIME}ms)`,
      metrics: {
        queryMetrics,
        averageQueryTime: avgQueryTime,
        threshold: CONFIG.PERFORMANCE.DB_QUERY_TIME,
        withinThreshold,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Database query performance: ${TestUtils.formatDuration(duration)}`);
  }

  async testAIModelPerformance() {
    const startTime = Date.now();
    TestUtils.log.test('Testing AI model performance...');
    
    const aiMetrics = {};
    
    try {
      // Test Ollama health and model loading
      const ollamaStart = performance.now();
      
      try {
        const versionResponse = await axios.get(`${CONFIG.OLLAMA_BASE_URL}/api/version`, {
          timeout: CONFIG.TIMEOUT.MEDIUM
        });
        
        const ollamaHealthTime = performance.now() - ollamaStart;
        
        aiMetrics.ollamaHealth = {
          responseTime: ollamaHealthTime,
          success: true,
          version: versionResponse.data.version
        };
        
      } catch (ollamaError) {
        const ollamaHealthTime = performance.now() - ollamaStart;
        
        aiMetrics.ollamaHealth = {
          responseTime: ollamaHealthTime,
          success: false,
          error: ollamaError.message
        };
      }
      
      // Test model list retrieval
      const modelsStart = performance.now();
      
      try {
        const modelsResponse = await axios.get(`${CONFIG.OLLAMA_BASE_URL}/api/tags`, {
          timeout: CONFIG.TIMEOUT.MEDIUM
        });
        
        const modelsTime = performance.now() - modelsStart;
        
        aiMetrics.modelList = {
          responseTime: modelsTime,
          success: true,
          modelCount: modelsResponse.data.models?.length || 0,
          models: modelsResponse.data.models?.map(m => m.name) || []
        };
        
      } catch (modelsError) {
        const modelsTime = performance.now() - modelsStart;
        
        aiMetrics.modelList = {
          responseTime: modelsTime,
          success: false,
          error: modelsError.message
        };
      }
      
      // Test simple text generation (if models available)
      if (aiMetrics.modelList?.success && aiMetrics.modelList.modelCount > 0) {
        const generationStart = performance.now();
        
        try {
          const generationResponse = await axios.post(`${CONFIG.OLLAMA_BASE_URL}/api/generate`, {
            model: aiMetrics.modelList.models[0],
            prompt: 'Hello',
            stream: false
          }, {
            timeout: CONFIG.TIMEOUT.AI_MODEL
          });
          
          const generationTime = performance.now() - generationStart;
          const tokensPerSecond = generationResponse.data.eval_count ? 
            generationResponse.data.eval_count / (generationResponse.data.eval_duration / 1000000000) : 0;
          
          aiMetrics.textGeneration = {
            responseTime: generationTime,
            success: true,
            tokensPerSecond,
            model: aiMetrics.modelList.models[0],
            promptTokens: generationResponse.data.prompt_eval_count,
            responseTokens: generationResponse.data.eval_count
          };
          
        } catch (generationError) {
          const generationTime = performance.now() - generationStart;
          
          aiMetrics.textGeneration = {
            responseTime: generationTime,
            success: false,
            error: generationError.message
          };
        }
      }
      
    } catch (error) {
      aiMetrics.globalError = error.message;
    }
    
    const duration = Date.now() - startTime;
    const successfulTests = Object.values(aiMetrics).filter(m => m.success).length;
    const totalTests = Object.keys(aiMetrics).length;
    
    this.results.aiModelPerformance = {
      status: successfulTests > 0 ? 'healthy' : 'unhealthy',
      message: `AI tests passed: ${successfulTests}/${totalTests}. Average response time: ${duration / totalTests}ms`,
      metrics: {
        aiMetrics,
        successfulTests,
        totalTests,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`AI model performance: ${TestUtils.formatDuration(duration)}`);
  }

  async testMemoryUsage() {
    const startTime = Date.now();
    TestUtils.log.test('Testing memory usage...');
    
    const memoryMetrics = {};
    
    try {
      // Get initial memory usage
      const initialMemory = process.memoryUsage();
      
      // Simulate some load and measure memory
      const measurements = [];
      
      for (let i = 0; i < 10; i++) {
        // Make multiple API calls
        const promises = Array.from({ length: 5 }, () => 
          axios.get(`${CONFIG.API_BASE_URL}/health`, { 
            timeout: CONFIG.TIMEOUT.SHORT,
            validateStatus: () => true 
          }).catch(() => {})
        );
        
        await Promise.all(promises);
        
        const currentMemory = process.memoryUsage();
        measurements.push({
          rss: currentMemory.rss,
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external
        });
        
        await TestUtils.delay(500);
      }
      
      const finalMemory = process.memoryUsage();
      
      memoryMetrics = {
        initial: initialMemory,
        final: finalMemory,
        measurements,
        averageHeapUsed: measurements.reduce((acc, curr) => acc + curr.heapUsed, 0) / measurements.length,
        maxHeapUsed: Math.max(...measurements.map(m => m.heapUsed)),
        memoryIncrease: finalMemory.heapUsed - initialMemory.heapUsed
      };
      
    } catch (error) {
      memoryMetrics.error = error.message;
    }
    
    const duration = Date.now() - startTime;
    const avgMemoryMB = memoryMetrics.averageHeapUsed ? memoryMetrics.averageHeapUsed / 1024 / 1024 : 0;
    const withinThreshold = avgMemoryMB <= CONFIG.PERFORMANCE.MEMORY_USAGE_MB;
    
    this.results.memoryUsage = {
      status: withinThreshold ? 'healthy' : 'unhealthy',
      message: `Average heap usage: ${avgMemoryMB.toFixed(2)}MB (threshold: ${CONFIG.PERFORMANCE.MEMORY_USAGE_MB}MB)`,
      metrics: {
        memoryMetrics,
        averageMemoryMB: avgMemoryMB,
        threshold: CONFIG.PERFORMANCE.MEMORY_USAGE_MB,
        withinThreshold,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Memory usage: ${TestUtils.formatDuration(duration)}`);
  }

  async testConcurrentUsers() {
    const startTime = Date.now();
    TestUtils.log.test('Testing concurrent user simulation...');
    
    const concurrentTests = [5, 10, 20]; // Number of concurrent requests
    const concurrencyMetrics = {};
    
    for (const concurrency of concurrentTests) {
      try {
        TestUtils.log.info(`Testing ${concurrency} concurrent requests...`);
        
        const testStart = performance.now();
        
        // Create array of concurrent requests
        const requests = Array.from({ length: concurrency }, async (_, index) => {
          const requestStart = performance.now();
          
          try {
            await axios.get(`${CONFIG.API_BASE_URL}/health`, {
              timeout: CONFIG.TIMEOUT.MEDIUM,
              validateStatus: () => true
            });
            
            const requestEnd = performance.now();
            return {
              success: true,
              duration: requestEnd - requestStart,
              index
            };
            
          } catch (error) {
            const requestEnd = performance.now();
            return {
              success: false,
              duration: requestEnd - requestStart,
              error: error.message,
              index
            };
          }
        });
        
        const results = await Promise.all(requests);
        const testEnd = performance.now();
        
        const successfulRequests = results.filter(r => r.success).length;
        const averageResponseTime = results.reduce((acc, curr) => acc + curr.duration, 0) / results.length;
        const totalTestTime = testEnd - testStart;
        const requestsPerSecond = concurrency / (totalTestTime / 1000);
        
        concurrencyMetrics[`${concurrency}_users`] = {
          concurrency,
          successfulRequests,
          totalRequests: concurrency,
          successRate: (successfulRequests / concurrency) * 100,
          averageResponseTime,
          totalTestTime,
          requestsPerSecond,
          results
        };
        
      } catch (error) {
        concurrencyMetrics[`${concurrency}_users`] = {
          concurrency,
          success: false,
          error: error.message
        };
      }
      
      // Wait between tests
      await TestUtils.delay(1000);
    }
    
    const duration = Date.now() - startTime;
    const avgSuccessRate = Object.values(concurrencyMetrics)
      .filter(m => m.successRate !== undefined)
      .reduce((acc, curr) => acc + curr.successRate, 0) / Object.keys(concurrencyMetrics).length || 0;
    
    this.results.concurrentUsers = {
      status: avgSuccessRate >= 80 ? 'healthy' : 'unhealthy',
      message: `Average success rate: ${avgSuccessRate.toFixed(1)}% across concurrent user tests`,
      metrics: {
        concurrencyMetrics,
        averageSuccessRate: avgSuccessRate,
        testDuration: duration
      }
    };
    
    TestUtils.log.success(`Concurrent users: ${TestUtils.formatDuration(duration)}`);
  }

  async runAllTests() {
    TestUtils.log.info('Starting performance tests...');
    const startTime = Date.now();
    
    // Run performance tests
    await this.testAPIResponseTimes();
    await this.testFileUploadPerformance();
    await this.testDatabaseQueryPerformance();
    await this.testAIModelPerformance();
    await this.testMemoryUsage();
    await this.testConcurrentUsers();
    
    const totalDuration = Date.now() - startTime;
    
    // Generate summary
    const healthyTests = Object.values(this.results).filter(r => r.status === 'healthy').length;
    const totalTests = Object.keys(this.results).length;
    
    TestUtils.log.info(`\\n=== Performance Test Results ===`);
    TestUtils.log.info(`Total Duration: ${TestUtils.formatDuration(totalDuration)}`);
    TestUtils.log.info(`Healthy Performance: ${healthyTests}/${totalTests}`);
    
    Object.entries(this.results).forEach(([test, result]) => {
      const statusIcon = result.status === 'healthy' ? '✓' : '✗';
      
      console.log(`${statusIcon} ${test.toUpperCase()}: ${result.message}`);
    });
    
    return {
      summary: {
        totalDuration,
        healthyTests,
        totalTests,
        allHealthy: healthyTests === totalTests
      },
      results: this.results
    };
  }
}

// CLI execution
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAllTests()
    .then(results => {
      if (results.summary.allHealthy) {
        TestUtils.log.success('All performance tests passed!');
        process.exit(0);
      } else {
        TestUtils.log.warning('Some performance tests need attention!');
        process.exit(1);
      }
    })
    .catch(error => {
      TestUtils.log.error(`Performance test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = PerformanceTester;
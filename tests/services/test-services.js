// Service connection tests
const { Client } = require('pg');
const Redis = require('redis');
const Minio = require('minio');
const axios = require('axios');
const { CONFIG, TestUtils } = require('../config');

class ServiceTester {
  constructor() {
    this.results = {
      postgres: { status: 'unknown', message: '', duration: 0 },
      redis: { status: 'unknown', message: '', duration: 0 },
      minio: { status: 'unknown', message: '', duration: 0 },
      ollama: { status: 'unknown', message: '', duration: 0 }
    };
  }

  async testPostgreSQL() {
    const startTime = Date.now();
    TestUtils.log.test('Testing PostgreSQL connection...');
    
    try {
      const client = new Client({
        connectionString: CONFIG.POSTGRES_URL
      });
      
      await client.connect();
      
      // Test basic query
      const result = await client.query('SELECT version(), current_database(), current_user');
      const version = result.rows[0].version;
      
      // Test whisper database schema
      const schemaCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      await client.end();
      
      const duration = Date.now() - startTime;
      this.results.postgres = {
        status: 'healthy',
        message: `Connected successfully. Version: ${version.split(' ')[0]}. Tables: ${schemaCheck.rows.length}`,
        duration,
        details: {
          version: version,
          database: result.rows[0].current_database,
          user: result.rows[0].current_user,
          tables: schemaCheck.rows.map(row => row.table_name)
        }
      };
      
      TestUtils.log.success(`PostgreSQL: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.postgres = {
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`PostgreSQL failed: ${error.message}`);
    }
  }

  async testRedis() {
    const startTime = Date.now();
    TestUtils.log.test('Testing Redis connection...');
    
    try {
      const redis = Redis.createClient({
        url: CONFIG.REDIS_URL
      });
      
      await redis.connect();
      
      // Test basic operations
      const testKey = `test_${TestUtils.generateTestId()}`;
      await redis.set(testKey, 'test_value', { EX: 10 });
      const value = await redis.get(testKey);
      await redis.del(testKey);
      
      // Get Redis info
      const info = await redis.info();
      const redisVersion = info.split('\\n').find(line => line.startsWith('redis_version:')).split(':')[1];
      
      await redis.quit();
      
      const duration = Date.now() - startTime;
      this.results.redis = {
        status: 'healthy',
        message: `Connected successfully. Version: ${redisVersion}. Set/Get test: ${value === 'test_value' ? 'PASS' : 'FAIL'}`,
        duration,
        details: {
          version: redisVersion,
          setGetTest: value === 'test_value'
        }
      };
      
      TestUtils.log.success(`Redis: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.redis = {
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Redis failed: ${error.message}`);
    }
  }

  async testMinIO() {
    const startTime = Date.now();
    TestUtils.log.test('Testing MinIO connection...');
    
    try {
      const minioClient = new Minio.Client({
        endPoint: new URL(CONFIG.MINIO_ENDPOINT).hostname,
        port: parseInt(new URL(CONFIG.MINIO_ENDPOINT).port) || 9000,
        useSSL: CONFIG.MINIO_ENDPOINT.startsWith('https'),
        accessKey: CONFIG.MINIO_ACCESS_KEY,
        secretKey: CONFIG.MINIO_SECRET_KEY
      });
      
      // Test bucket existence
      const audioBucketExists = await minioClient.bucketExists(CONFIG.MINIO_BUCKET_NAME);
      const tempBucketExists = await minioClient.bucketExists(CONFIG.MINIO_TEMP_BUCKET_NAME);
      
      // Test file operations
      const testFileName = `test_${TestUtils.generateTestId()}.txt`;
      const testContent = 'This is a test file for MinIO connectivity';
      
      await minioClient.putObject(CONFIG.MINIO_BUCKET_NAME, testFileName, testContent);
      
      const stream = await minioClient.getObject(CONFIG.MINIO_BUCKET_NAME, testFileName);
      let retrievedContent = '';
      
      await new Promise((resolve, reject) => {
        stream.on('data', chunk => retrievedContent += chunk);
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      await minioClient.removeObject(CONFIG.MINIO_BUCKET_NAME, testFileName);
      
      const duration = Date.now() - startTime;
      this.results.minio = {
        status: 'healthy',
        message: `Connected successfully. Buckets: audio(${audioBucketExists}), temp(${tempBucketExists}). Upload/Download test: ${retrievedContent === testContent ? 'PASS' : 'FAIL'}`,
        duration,
        details: {
          audioBucketExists,
          tempBucketExists,
          uploadDownloadTest: retrievedContent === testContent
        }
      };
      
      TestUtils.log.success(`MinIO: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.minio = {
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`MinIO failed: ${error.message}`);
    }
  }

  async testOllama() {
    const startTime = Date.now();
    TestUtils.log.test('Testing Ollama connection...');
    
    try {
      // Test basic connectivity
      const healthResponse = await axios.get(`${CONFIG.OLLAMA_BASE_URL}/api/version`, {
        timeout: CONFIG.TIMEOUT.MEDIUM
      });
      
      // Test available models
      const modelsResponse = await axios.get(`${CONFIG.OLLAMA_BASE_URL}/api/tags`, {
        timeout: CONFIG.TIMEOUT.MEDIUM
      });
      
      const models = modelsResponse.data.models || [];
      const hasWhisper = models.some(model => model.name.includes('whisper'));
      const hasLLM = models.some(model => model.name.includes('llama') || model.name.includes('mistral'));
      
      // Test simple generation (optional, might be slow)
      let generationTest = false;
      try {
        const testResponse = await axios.post(`${CONFIG.OLLAMA_BASE_URL}/api/generate`, {
          model: models[0]?.name || 'llama3.1:8b',
          prompt: 'Hello',
          stream: false
        }, {
          timeout: CONFIG.TIMEOUT.AI_MODEL
        });
        
        generationTest = testResponse.data && testResponse.data.response;
      } catch (genError) {
        TestUtils.log.warning(`Ollama generation test failed: ${genError.message}`);
      }
      
      const duration = Date.now() - startTime;
      this.results.ollama = {
        status: 'healthy',
        message: `Connected successfully. Version: ${healthResponse.data.version || 'unknown'}. Models: ${models.length}. Whisper: ${hasWhisper}, LLM: ${hasLLM}`,
        duration,
        details: {
          version: healthResponse.data.version,
          modelCount: models.length,
          models: models.map(m => m.name),
          hasWhisper,
          hasLLM,
          generationTest
        }
      };
      
      TestUtils.log.success(`Ollama: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.ollama = {
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Ollama failed: ${error.message}`);
    }
  }

  async runAllTests() {
    TestUtils.log.info('Starting service connection tests...');
    const startTime = Date.now();
    
    await Promise.all([
      this.testPostgreSQL(),
      this.testRedis(),
      this.testMinIO(),
      this.testOllama()
    ]);
    
    const totalDuration = Date.now() - startTime;
    
    // Generate summary
    const healthyServices = Object.values(this.results).filter(r => r.status === 'healthy').length;
    const totalServices = Object.keys(this.results).length;
    
    TestUtils.log.info(`\\n=== Service Connection Test Results ===`);
    TestUtils.log.info(`Total Duration: ${TestUtils.formatDuration(totalDuration)}`);
    TestUtils.log.info(`Healthy Services: ${healthyServices}/${totalServices}`);
    
    Object.entries(this.results).forEach(([service, result]) => {
      const statusIcon = result.status === 'healthy' ? '✓' : '✗';
      const statusColor = result.status === 'healthy' ? 'green' : 'red';
      
      console.log(`${statusIcon} ${service.toUpperCase()}: ${result.message} (${TestUtils.formatDuration(result.duration)})`);
    });
    
    return {
      summary: {
        totalDuration,
        healthyServices,
        totalServices,
        allHealthy: healthyServices === totalServices
      },
      results: this.results
    };
  }
}

// CLI execution
if (require.main === module) {
  const tester = new ServiceTester();
  tester.runAllTests()
    .then(results => {
      if (results.summary.allHealthy) {
        TestUtils.log.success('All services are healthy!');
        process.exit(0);
      } else {
        TestUtils.log.error('Some services are unhealthy!');
        process.exit(1);
      }
    })
    .catch(error => {
      TestUtils.log.error(`Test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = ServiceTester;
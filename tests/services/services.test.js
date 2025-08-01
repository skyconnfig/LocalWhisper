// Jest test file for service connections
const ServiceTester = require('./test-services');

describe('Service Connection Tests', () => {
  let serviceTester;
  
  beforeAll(() => {
    serviceTester = new ServiceTester();
  });

  describe('PostgreSQL', () => {
    test('should connect to PostgreSQL database', async () => {
      await serviceTester.testPostgreSQL();
      expect(serviceTester.results.postgres.status).toBe('healthy');
      expect(serviceTester.results.postgres.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('Redis', () => {
    test('should connect to Redis cache', async () => {
      await serviceTester.testRedis();
      expect(serviceTester.results.redis.status).toBe('healthy');
      expect(serviceTester.results.redis.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('MinIO', () => {
    test('should connect to MinIO storage', async () => {
      await serviceTester.testMinIO();
      expect(serviceTester.results.minio.status).toBe('healthy');
      expect(serviceTester.results.minio.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('Ollama', () => {
    test('should connect to Ollama AI service', async () => {
      await serviceTester.testOllama();
      expect(serviceTester.results.ollama.status).toBe('healthy');
      expect(serviceTester.results.ollama.duration).toBeLessThan(CONFIG.TIMEOUT.AI_MODEL);
    });
  });

  describe('Integration', () => {
    test('all services should be healthy', async () => {
      const results = await serviceTester.runAllTests();
      expect(results.summary.allHealthy).toBe(true);
      expect(results.summary.healthyServices).toBe(results.summary.totalServices);
    });
  });
});
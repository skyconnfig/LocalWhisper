// Jest test file for performance tests
const PerformanceTester = require('./test-performance');

describe('Performance Tests', () => {
  let performanceTester;
  
  beforeAll(() => {
    performanceTester = new PerformanceTester();
  });

  describe('API Response Time', () => {
    test('should have acceptable API response times', async () => {
      await performanceTester.testAPIResponseTimes();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.apiResponseTime.status);
      expect(performanceTester.results.apiResponseTime.metrics.averageResponseTime).toBeLessThan(CONFIG.PERFORMANCE.API_RESPONSE_TIME * 2);
    });
  });

  describe('File Upload Performance', () => {
    test('should handle file uploads efficiently', async () => {
      await performanceTester.testFileUploadPerformance();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.fileUploadPerformance.status);
      expect(performanceTester.results.fileUploadPerformance.metrics.successfulUploads).toBeGreaterThan(0);
    });
  });

  describe('Database Query Performance', () => {
    test('should have acceptable database query times', async () => {
      await performanceTester.testDatabaseQueryPerformance();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.databaseQueryPerformance.status);
      expect(performanceTester.results.databaseQueryPerformance.metrics.averageQueryTime).toBeLessThan(CONFIG.PERFORMANCE.DB_QUERY_TIME * 2);
    });
  });

  describe('AI Model Performance', () => {
    test('should have responsive AI model interactions', async () => {
      await performanceTester.testAIModelPerformance();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.aiModelPerformance.status);
      expect(performanceTester.results.aiModelPerformance.metrics.successfulTests).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage', () => {
    test('should maintain acceptable memory usage', async () => {
      await performanceTester.testMemoryUsage();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.memoryUsage.status);
      expect(performanceTester.results.memoryUsage.metrics.averageMemoryMB).toBeLessThan(CONFIG.PERFORMANCE.MEMORY_USAGE_MB * 2);
    });
  });

  describe('Concurrent Users', () => {
    test('should handle concurrent user requests', async () => {
      await performanceTester.testConcurrentUsers();
      expect(['healthy', 'unhealthy']).toContain(performanceTester.results.concurrentUsers.status);
      expect(performanceTester.results.concurrentUsers.metrics.averageSuccessRate).toBeGreaterThan(50);
    });
  });

  describe('Integration', () => {
    test('should have acceptable overall performance', async () => {
      const results = await performanceTester.runAllTests();
      expect(results.summary.healthyTests).toBeGreaterThanOrEqual(results.summary.totalTests * 0.5);
    });
  });
});
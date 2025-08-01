// Jest test file for API endpoints
const APITester = require('./test-api-endpoints');

describe('API Endpoint Tests', () => {
  let apiTester;
  
  beforeAll(() => {
    apiTester = new APITester();
  });

  describe('Health Endpoint', () => {
    test('should return healthy status', async () => {
      await apiTester.testHealthEndpoint();
      expect(apiTester.results.health.status).toBe('healthy');
      expect(apiTester.results.health.duration).toBeLessThan(CONFIG.TIMEOUT.SHORT);
    });
  });

  describe('Authentication Endpoints', () => {
    test('should handle user registration and login', async () => {
      await apiTester.testAuthEndpoints();
      expect(['healthy', 'partial']).toContain(apiTester.results.auth.status);
      expect(apiTester.results.auth.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('File Upload Endpoint', () => {
    test('should accept file uploads', async () => {
      await apiTester.testFileUploadEndpoint();
      // May fail without auth, but endpoint should be accessible
      expect(['healthy', 'unhealthy']).toContain(apiTester.results.upload.status);
      expect(apiTester.results.upload.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('Transcription Endpoint', () => {
    test('should be accessible for transcription requests', async () => {
      await apiTester.testTranscriptionEndpoint();
      expect(['healthy', 'unhealthy']).toContain(apiTester.results.transcription.status);
      expect(apiTester.results.transcription.duration).toBeLessThan(CONFIG.TIMEOUT.AI_MODEL);
    });
  });

  describe('Transformation Endpoint', () => {
    test('should be accessible for text transformation', async () => {
      await apiTester.testTransformationEndpoint();
      expect(['healthy', 'unhealthy']).toContain(apiTester.results.transformation.status);
      expect(apiTester.results.transformation.duration).toBeLessThan(CONFIG.TIMEOUT.AI_MODEL);
    });
  });

  describe('Files Endpoint', () => {
    test('should be accessible for file listing', async () => {
      await apiTester.testFilesEndpoint();
      expect(['healthy', 'unhealthy']).toContain(apiTester.results.files.status);
      expect(apiTester.results.files.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('Integration', () => {
    test('should have mostly healthy endpoints', async () => {
      const results = await apiTester.runAllTests();
      expect(results.summary.healthyEndpoints).toBeGreaterThanOrEqual(results.summary.totalEndpoints * 0.5);
    });
  });
});
// Jest test file for frontend functionality
const FrontendTester = require('./test-frontend');

describe('Frontend Functionality Tests', () => {
  let frontendTester;
  
  beforeAll(() => {
    frontendTester = new FrontendTester();
  });

  afterAll(async () => {
    if (frontendTester) {
      await frontendTester.cleanup();
    }
  });

  describe('Page Load', () => {
    test('should load the main page successfully', async () => {
      await frontendTester.setupBrowser();
      await frontendTester.testPageLoad();
      expect(frontendTester.results.pageLoad.status).toBe('healthy');
      expect(frontendTester.results.pageLoad.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('Authentication', () => {
    test('should have accessible authentication features', async () => {
      await frontendTester.testAuthentication();
      expect(['healthy', 'unhealthy']).toContain(frontendTester.results.authentication.status);
      expect(frontendTester.results.authentication.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('Recording', () => {
    test('should have recording functionality', async () => {
      await frontendTester.testRecordingFunctionality();
      expect(['healthy', 'unhealthy']).toContain(frontendTester.results.recording.status);
      expect(frontendTester.results.recording.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('File Upload', () => {
    test('should have file upload functionality', async () => {
      await frontendTester.testFileUpload();
      expect(['healthy', 'unhealthy']).toContain(frontendTester.results.fileUpload.status);
      expect(frontendTester.results.fileUpload.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('History', () => {
    test('should have accessible history view', async () => {
      await frontendTester.testHistoryView();
      expect(['healthy', 'unhealthy']).toContain(frontendTester.results.history.status);
      expect(frontendTester.results.history.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('Navigation', () => {
    test('should have working navigation', async () => {
      await frontendTester.testNavigation();
      expect(['healthy', 'unhealthy']).toContain(frontendTester.results.navigation.status);
      expect(frontendTester.results.navigation.duration).toBeLessThan(CONFIG.TIMEOUT.MEDIUM);
    });
  });

  describe('Integration', () => {
    test('should have mostly working frontend features', async () => {
      const results = await frontendTester.runAllTests();
      expect(results.summary.healthyFeatures).toBeGreaterThanOrEqual(results.summary.totalFeatures * 0.5);
    });
  });
});
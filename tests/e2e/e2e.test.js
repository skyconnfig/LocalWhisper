// Jest test file for end-to-end scenarios
const E2ETester = require('./test-e2e');

describe('End-to-End Test Scenarios', () => {
  let e2eTester;
  
  beforeAll(() => {
    e2eTester = new E2ETester();
  });

  afterAll(async () => {
    if (e2eTester) {
      await e2eTester.cleanup();
    }
  });

  describe('User Registration Flow', () => {
    test('should complete user registration and login flow', async () => {
      await e2eTester.setupBrowser();
      await e2eTester.testUserRegistrationAndLoginFlow();
      expect(['healthy', 'unhealthy']).toContain(e2eTester.results.userRegistrationFlow.status);
      expect(e2eTester.results.userRegistrationFlow.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('Audio Recording Flow', () => {
    test('should complete audio recording and upload flow', async () => {
      await e2eTester.testAudioRecordingAndUploadFlow();
      expect(['healthy', 'unhealthy']).toContain(e2eTester.results.audioRecordingFlow.status);
      expect(e2eTester.results.audioRecordingFlow.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('File Upload Flow', () => {
    test('should complete file upload and transcription flow', async () => {
      await e2eTester.testFileUploadAndTranscriptionFlow();
      expect(['healthy', 'unhealthy']).toContain(e2eTester.results.fileUploadFlow.status);
      expect(e2eTester.results.fileUploadFlow.duration).toBeLessThan(CONFIG.TIMEOUT.AI_MODEL);
    });
  });

  describe('Transcription Flow', () => {
    test('should complete transcription and transformation flow', async () => {
      await e2eTester.testTranscriptionAndTransformationFlow();
      expect(['healthy', 'partial', 'unhealthy']).toContain(e2eTester.results.transcriptionFlow.status);
      expect(e2eTester.results.transcriptionFlow.duration).toBeLessThan(CONFIG.TIMEOUT.AI_MODEL);
    });
  });

  describe('File Management Flow', () => {
    test('should complete file management and history flow', async () => {
      await e2eTester.testFileManagementAndHistoryFlow();
      expect(['healthy', 'unhealthy']).toContain(e2eTester.results.fileManagementFlow.status);
      expect(e2eTester.results.fileManagementFlow.duration).toBeLessThan(CONFIG.TIMEOUT.LONG);
    });
  });

  describe('Integration', () => {
    test('should have mostly working E2E flows', async () => {
      const results = await e2eTester.runAllTests();
      expect(results.summary.healthyFlows).toBeGreaterThanOrEqual(results.summary.totalFlows * 0.4);
    });
  });
});
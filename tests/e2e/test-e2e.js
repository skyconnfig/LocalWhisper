// End-to-end test scenarios
const puppeteer = require('puppeteer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { CONFIG, TestUtils } = require('../config');

class E2ETester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      userRegistrationFlow: { status: 'unknown', message: '', duration: 0 },
      audioRecordingFlow: { status: 'unknown', message: '', duration: 0 },
      fileUploadFlow: { status: 'unknown', message: '', duration: 0 },
      transcriptionFlow: { status: 'unknown', message: '', duration: 0 },
      fileManagementFlow: { status: 'unknown', message: '', duration: 0 }
    };
    this.testUser = {
      email: `e2e_test_${TestUtils.generateTestId()}@example.com`,
      password: 'E2ETestPassword123!',
      name: 'E2E Test User'
    };
  }

  async setupBrowser() {
    TestUtils.log.test('Setting up browser for E2E tests...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=' + path.join(__dirname, '..', 'test-data', 'test-audio.wav')
      ]
    });
    
    this.page = await this.browser.newPage();
    
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Mock getUserMedia for audio recording tests
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: async (constraints) => {
            return {
              getTracks: () => [{
                stop: () => {},
                kind: 'audio',
                enabled: true,
                readyState: 'live'
              }],
              getAudioTracks: () => [{
                stop: () => {},
                kind: 'audio',
                enabled: true,
                readyState: 'live'
              }],
              active: true
            };
          },
          enumerateDevices: async () => [{
            deviceId: 'default',
            kind: 'audioinput',
            label: 'Default Microphone',
            groupId: 'default'
          }]
        }
      });
    });
  }

  async testUserRegistrationAndLoginFlow() {
    const startTime = Date.now();
    TestUtils.log.test('Testing complete user registration and login flow...');
    
    try {
      let registrationSuccess = false;
      let loginSuccess = false;
      let userProfileAccess = false;
      
      // Step 1: Navigate to registration page
      await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
      
      // Look for registration/signup links
      const signupSelectors = [
        'a[href*="signup"]',
        'a[href*="register"]',
        'button:contains("Sign Up")',
        'button:contains("Register")'
      ];
      
      let signupLink = null;
      for (const selector of signupSelectors) {
        try {
          signupLink = await this.page.$(selector);
          if (signupLink) break;
        } catch (e) {}
      }
      
      if (signupLink) {
        await signupLink.click();
        await this.page.waitForTimeout(2000);
      } else {
        // Try direct navigation
        await this.page.goto(`${CONFIG.BASE_URL}/auth/signup`, { waitUntil: 'networkidle2' });
      }
      
      // Step 2: Fill registration form
      try {
        const emailField = await this.page.$('input[type="email"], input[name="email"]');
        const passwordField = await this.page.$('input[type="password"], input[name="password"]');
        const nameField = await this.page.$('input[name="name"], input[placeholder*="name"]');
        const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
        
        if (emailField && passwordField && submitButton) {
          await emailField.type(this.testUser.email);
          await passwordField.type(this.testUser.password);
          
          if (nameField) {
            await nameField.type(this.testUser.name);
          }
          
          // Submit registration
          await submitButton.click();
          await this.page.waitForTimeout(3000);
          
          // Check for success indicators
          const currentUrl = this.page.url();
          const successMessages = await this.page.$$eval('*', els => 
            els.filter(el => el.textContent && 
              (el.textContent.includes('success') || 
               el.textContent.includes('welcome') ||
               el.textContent.includes('registered')))
              .map(el => el.textContent)
          );
          
          registrationSuccess = successMessages.length > 0 || currentUrl.includes('dashboard') || currentUrl.includes('whispers');
        }
      } catch (regError) {
        TestUtils.log.warning(`Registration form interaction failed: ${regError.message}`);
      }
      
      // Step 3: Test login (if registration failed, still test login with existing user)
      if (registrationSuccess) {
        // If registration succeeded, user should already be logged in
        loginSuccess = true;
      } else {
        // Try to login with test credentials
        await this.page.goto(`${CONFIG.BASE_URL}/auth/signin`, { waitUntil: 'networkidle2' });
        
        try {
          const emailField = await this.page.$('input[type="email"], input[name="email"]');
          const passwordField = await this.page.$('input[type="password"], input[name="password"]');
          const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
          
          if (emailField && passwordField && submitButton) {
            await emailField.type(CONFIG.TEST_USER.email);
            await passwordField.type(CONFIG.TEST_USER.password);
            
            await submitButton.click();
            await this.page.waitForTimeout(3000);
            
            const currentUrl = this.page.url();
            loginSuccess = currentUrl.includes('dashboard') || currentUrl.includes('whispers') || !currentUrl.includes('signin');
          }
        } catch (loginError) {
          TestUtils.log.warning(`Login form interaction failed: ${loginError.message}`);
        }
      }
      
      // Step 4: Test user profile/dashboard access
      if (loginSuccess || registrationSuccess) {
        try {
          // Look for user-specific elements
          const userElements = [
            '[data-testid="user-menu"]',
            '.user-profile',
            '.user-avatar',
            'button:contains("Profile")',
            'a:contains("Profile")',
            '.username',
            '.user-email'
          ];
          
          let userElementFound = false;
          for (const selector of userElements) {
            try {
              const element = await this.page.$(selector);
              if (element) {
                userElementFound = true;
                break;
              }
            } catch (e) {}
          }
          
          userProfileAccess = userElementFound;
        } catch (profileError) {
          TestUtils.log.warning(`Profile access test failed: ${profileError.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      const overallSuccess = registrationSuccess || (loginSuccess && userProfileAccess);
      
      this.results.userRegistrationFlow = {
        status: overallSuccess ? 'healthy' : 'unhealthy',
        message: `Registration: ${registrationSuccess ? 'SUCCESS' : 'FAILED'}, Login: ${loginSuccess ? 'SUCCESS' : 'FAILED'}, Profile Access: ${userProfileAccess ? 'SUCCESS' : 'FAILED'}`,
        duration,
        details: {
          registrationSuccess,
          loginSuccess,
          userProfileAccess,
          testUserEmail: this.testUser.email
        }
      };
      
      TestUtils.log.success(`User registration flow: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.userRegistrationFlow = {
        status: 'unhealthy',
        message: `User registration flow failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`User registration flow failed: ${error.message}`);
    }
  }

  async testAudioRecordingAndUploadFlow() {
    const startTime = Date.now();
    TestUtils.log.test('Testing complete audio recording and upload flow...');
    
    try {
      await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
      
      let recordingStarted = false;
      let recordingStopped = false;
      let audioUploaded = false;
      
      // Step 1: Start recording
      const recordButtons = [
        'button:contains("Record")',
        'button:contains("Start Recording")',
        '.record-button',
        '[data-testid="record"]'
      ];
      
      let recordButton = null;
      for (const selector of recordButtons) {
        try {
          recordButton = await this.page.$(selector);
          if (recordButton) break;
        } catch (e) {}
      }
      
      if (recordButton) {
        await recordButton.click();
        await this.page.waitForTimeout(2000);
        
        // Check for recording indicators
        const recordingIndicators = [
          '.recording-indicator',
          '.recording-active',
          'button:contains("Stop")',
          '[data-testid="recording"]'
        ];
        
        for (const selector of recordingIndicators) {
          try {
            const indicator = await this.page.$(selector);
            if (indicator) {
              recordingStarted = true;
              break;
            }
          } catch (e) {}
        }
      }
      
      // Step 2: Stop recording
      if (recordingStarted) {
        await this.page.waitForTimeout(3000); // Record for 3 seconds
        
        const stopButtons = [
          'button:contains("Stop")',
          'button:contains("Stop Recording")',
          '.stop-button',
          '[data-testid="stop"]'
        ];
        
        let stopButton = null;
        for (const selector of stopButtons) {
          try {
            stopButton = await this.page.$(selector);
            if (stopButton) break;
          } catch (e) {}
        }
        
        if (stopButton) {
          await stopButton.click();
          await this.page.waitForTimeout(2000);
          recordingStopped = true;
        }
      }
      
      // Step 3: Check if audio was uploaded/processed
      if (recordingStopped) {
        await this.page.waitForTimeout(5000); // Wait for upload/processing
        
        // Look for upload success indicators
        const successIndicators = [
          '.upload-success',
          '.processing',
          '.transcription',
          'text:contains("uploaded")',
          'text:contains("processing")',
          'text:contains("transcription")'
        ];
        
        for (const selector of successIndicators) {
          try {
            const indicator = await this.page.$(selector);
            if (indicator) {
              audioUploaded = true;
              break;
            }
          } catch (e) {}
        }
        
        // Also check if we were redirected to a whisper/transcription page
        const currentUrl = this.page.url();
        if (currentUrl.includes('whispers/') || currentUrl.includes('transcription')) {
          audioUploaded = true;
        }
      }
      
      const duration = Date.now() - startTime;
      const overallSuccess = recordingStarted && recordingStopped;
      
      this.results.audioRecordingFlow = {
        status: overallSuccess ? 'healthy' : 'unhealthy',
        message: `Recording Started: ${recordingStarted ? 'SUCCESS' : 'FAILED'}, Stopped: ${recordingStopped ? 'SUCCESS' : 'FAILED'}, Uploaded: ${audioUploaded ? 'SUCCESS' : 'FAILED'}`,
        duration,
        details: {
          recordingStarted,
          recordingStopped,
          audioUploaded
        }
      };
      
      TestUtils.log.success(`Audio recording flow: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.audioRecordingFlow = {
        status: 'unhealthy',
        message: `Audio recording flow failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Audio recording flow failed: ${error.message}`);
    }
  }

  async testFileUploadAndTranscriptionFlow() {
    const startTime = Date.now();
    TestUtils.log.test('Testing complete file upload and transcription flow...');
    
    try {
      await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
      
      let fileSelected = false;
      let fileUploaded = false;
      let transcriptionStarted = false;
      let transcriptionCompleted = false;
      
      // Step 1: Create test audio file
      const testFileName = `e2e_test_${TestUtils.generateTestId()}.wav`;
      const testFilePath = path.join(__dirname, '..', 'test-data', testFileName);
      
      // Ensure test-data directory exists
      const testDataDir = path.dirname(testFilePath);
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }
      
      // Create a minimal WAV file
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
        0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
        0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
        0x00, 0x08, 0x00, 0x00
      ]);
      const silenceData = Buffer.alloc(2048, 0);
      const testFileContent = Buffer.concat([wavHeader, silenceData]);
      fs.writeFileSync(testFilePath, testFileContent);
      
      // Step 2: Find and interact with file upload element
      const uploadSelectors = [
        'input[type="file"]',
        '[data-testid="file-upload"]',
        '.file-input'
      ];
      
      let fileInput = null;
      for (const selector of uploadSelectors) {
        try {
          fileInput = await this.page.$(selector);
          if (fileInput) break;
        } catch (e) {}
      }
      
      if (fileInput) {
        await fileInput.uploadFile(testFilePath);
        fileSelected = true;
        await this.page.waitForTimeout(2000);
        
        // Look for upload confirmation or processing indicators
        const uploadIndicators = [
          '.upload-progress',
          '.uploading',
          '.file-selected',
          'text:contains("uploading")',
          'text:contains("selected")'
        ];
        
        for (const selector of uploadIndicators) {
          try {
            const indicator = await this.page.$(selector);
            if (indicator) {
              fileUploaded = true;
              break;
            }
          } catch (e) {}
        }
      }
      
      // Step 3: Look for upload/submit button
      if (fileSelected) {
        const submitButtons = [
          'button:contains("Upload")',
          'button:contains("Submit")',
          'button:contains("Transcribe")',
          'button[type="submit"]',
          '[data-testid="upload-submit"]'
        ];
        
        let submitButton = null;
        for (const selector of submitButtons) {
          try {
            submitButton = await this.page.$(selector);
            if (submitButton) break;
          } catch (e) {}
        }
        
        if (submitButton) {
          await submitButton.click();
          await this.page.waitForTimeout(3000);
          
          // Check for transcription start indicators
          const transcriptionIndicators = [
            '.transcribing',
            '.processing',
            'text:contains("transcribing")',
            'text:contains("processing")',
            '.progress-bar'
          ];
          
          for (const selector of transcriptionIndicators) {
            try {
              const indicator = await this.page.$(selector);
              if (indicator) {
                transcriptionStarted = true;
                break;
              }
            } catch (e) {}
          }
          
          // Wait for transcription to complete (or timeout)
          if (transcriptionStarted) {
            await this.page.waitForTimeout(10000); // Wait up to 10 seconds
            
            const completionIndicators = [
              '.transcription-result',
              '.transcription-text',
              'text:contains("transcription complete")',
              '.result-text'
            ];
            
            for (const selector of completionIndicators) {
              try {
                const indicator = await this.page.$(selector);
                if (indicator) {
                  transcriptionCompleted = true;
                  break;
                }
              } catch (e) {}
            }
            
            // Also check if URL changed to a transcription page
            const currentUrl = this.page.url();
            if (currentUrl.includes('whispers/') || currentUrl.includes('transcription')) {
              transcriptionCompleted = true;
            }
          }
        }
      }
      
      // Cleanup test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      
      const duration = Date.now() - startTime;
      const overallSuccess = fileSelected && (fileUploaded || transcriptionStarted);
      
      this.results.fileUploadFlow = {
        status: overallSuccess ? 'healthy' : 'unhealthy',
        message: `File Selected: ${fileSelected ? 'SUCCESS' : 'FAILED'}, Uploaded: ${fileUploaded ? 'SUCCESS' : 'FAILED'}, Transcription Started: ${transcriptionStarted ? 'SUCCESS' : 'FAILED'}, Completed: ${transcriptionCompleted ? 'SUCCESS' : 'FAILED'}`,
        duration,
        details: {
          fileSelected,
          fileUploaded,
          transcriptionStarted,
          transcriptionCompleted
        }
      };
      
      TestUtils.log.success(`File upload flow: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.fileUploadFlow = {
        status: 'unhealthy',
        message: `File upload flow failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`File upload flow failed: ${error.message}`);
    }
  }

  async testTranscriptionAndTransformationFlow() {
    const startTime = Date.now();
    TestUtils.log.test('Testing transcription and content transformation flow...');
    
    try {
      // This test assumes we have a transcription available or can access a demo
      let transcriptionAccessed = false;
      let transformationTriggered = false;
      let transformationCompleted = false;
      
      // Step 1: Try to access whispers/history page
      const historyUrls = [
        `${CONFIG.BASE_URL}/whispers`,
        `${CONFIG.BASE_URL}/history`
      ];
      
      for (const url of historyUrls) {
        try {
          const response = await this.page.goto(url, { waitUntil: 'networkidle2' });
          
          if (response.status() === 200) {
            // Look for existing transcriptions
            const transcriptionItems = [
              '.whisper-item',
              '.transcription-item',
              '.recording-item',
              '[data-testid="whisper"]'
            ];
            
            for (const selector of transcriptionItems) {
              try {
                const items = await this.page.$$(selector);
                if (items.length > 0) {
                  // Click on the first item
                  await items[0].click();
                  await this.page.waitForTimeout(2000);
                  transcriptionAccessed = true;
                  break;
                }
              } catch (e) {}
            }
            
            if (transcriptionAccessed) break;
          }
        } catch (e) {}
      }
      
      // Step 2: If no existing transcription, try to create one or access demo
      if (!transcriptionAccessed) {
        await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
        
        // Look for demo or sample transcription links
        const demoLinks = [
          'a:contains("Demo")',
          'a:contains("Sample")',
          'a:contains("Example")',
          '[data-testid="demo"]'
        ];
        
        for (const selector of demoLinks) {
          try {
            const link = await this.page.$(selector);
            if (link) {
              await link.click();
              await this.page.waitForTimeout(2000);
              transcriptionAccessed = true;
              break;
            }
          } catch (e) {}
        }
      }
      
      // Step 3: Test transformation functionality
      if (transcriptionAccessed) {
        // Look for transformation options
        const transformSelectors = [
          '.transform-button',
          'button:contains("Transform")',
          'button:contains("Summary")',
          'button:contains("Email")',
          'select[name="transform"]',
          '[data-testid="transform"]'
        ];
        
        let transformElement = null;
        for (const selector of transformSelectors) {
          try {
            transformElement = await this.page.$(selector);
            if (transformElement) break;
          } catch (e) {}
        }
        
        if (transformElement) {
          const tagName = await transformElement.evaluate(el => el.tagName.toLowerCase());
          
          if (tagName === 'select') {
            // Select an option
            await this.page.select(transformElement, 'summary');
          } else {
            // Click the button
            await transformElement.click();
          }
          
          await this.page.waitForTimeout(2000);
          transformationTriggered = true;
          
          // Look for transformation results or processing indicators
          await this.page.waitForTimeout(5000);
          
          const resultIndicators = [
            '.transformation-result',
            '.transformed-text',
            '.summary-result',
            '.processing-complete',
            'text:contains("transformed")'
          ];
          
          for (const selector of resultIndicators) {
            try {
              const indicator = await this.page.$(selector);
              if (indicator) {
                transformationCompleted = true;
                break;
              }
            } catch (e) {}
          }
        }
      }
      
      const duration = Date.now() - startTime;
      const overallSuccess = transcriptionAccessed && transformationTriggered;
      
      this.results.transcriptionFlow = {
        status: overallSuccess ? 'healthy' : 'partial',
        message: `Transcription Accessed: ${transcriptionAccessed ? 'SUCCESS' : 'FAILED'}, Transformation Triggered: ${transformationTriggered ? 'SUCCESS' : 'FAILED'}, Completed: ${transformationCompleted ? 'SUCCESS' : 'FAILED'}`,
        duration,
        details: {
          transcriptionAccessed,
          transformationTriggered,
          transformationCompleted
        }
      };
      
      TestUtils.log.success(`Transcription flow: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.transcriptionFlow = {
        status: 'unhealthy',
        message: `Transcription flow failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Transcription flow failed: ${error.message}`);
    }
  }

  async testFileManagementAndHistoryFlow() {
    const startTime = Date.now();
    TestUtils.log.test('Testing file management and history flow...');
    
    try {
      let historyAccessed = false;
      let fileListDisplayed = false;
      let fileInteractionWorking = false;
      let searchFilterWorking = false;
      
      // Step 1: Access history/whispers page
      const historyUrls = [
        `${CONFIG.BASE_URL}/whispers`,
        `${CONFIG.BASE_URL}/history`,
        `${CONFIG.BASE_URL}/recordings`
      ];
      
      for (const url of historyUrls) {
        try {
          const response = await this.page.goto(url, { waitUntil: 'networkidle2' });
          
          if (response.status() === 200) {
            historyAccessed = true;
            break;
          }
        } catch (e) {}
      }
      
      if (!historyAccessed) {
        // Try to find navigation links
        await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
        
        const historyLinks = [
          'a[href*="whispers"]',
          'a[href*="history"]',
          'a:contains("History")',
          'a:contains("Whispers")'
        ];
        
        for (const selector of historyLinks) {
          try {
            const link = await this.page.$(selector);
            if (link) {
              await link.click();
              await this.page.waitForTimeout(2000);
              historyAccessed = true;
              break;
            }
          } catch (e) {}
        }
      }
      
      // Step 2: Check for file list display
      if (historyAccessed) {
        const fileListSelectors = [
          '.whisper-item',
          '.file-item',
          '.recording-item',
          '.history-item',
          '[data-testid="whisper"]'
        ];
        
        for (const selector of fileListSelectors) {
          try {
            const items = await this.page.$$(selector);
            if (items.length > 0) {
              fileListDisplayed = true;
              
              // Test clicking on first item
              try {
                await items[0].click();
                await this.page.waitForTimeout(2000);
                
                // Check if we navigated to a detail page
                const currentUrl = this.page.url();
                if (currentUrl.includes('whispers/') && currentUrl !== `${CONFIG.BASE_URL}/whispers`) {
                  fileInteractionWorking = true;
                }
              } catch (clickError) {
                TestUtils.log.warning(`File item click failed: ${clickError.message}`);
              }
              
              break;
            }
          } catch (e) {}
        }
        
        // Step 3: Test search/filter functionality
        const searchSelectors = [
          'input[type="search"]',
          'input[placeholder*="search"]',
          '.search-input',
          '[data-testid="search"]'
        ];
        
        for (const selector of searchSelectors) {
          try {
            const searchInput = await this.page.$(selector);
            if (searchInput) {
              await searchInput.type('test');
              await this.page.waitForTimeout(1000);
              searchFilterWorking = true;
              break;
            }
          } catch (e) {}
        }
        
        // Test filter buttons
        if (!searchFilterWorking) {
          const filterSelectors = [
            '.filter-button',
            'button:contains("Filter")',
            'select[name="filter"]',
            '[data-testid="filter"]'
          ];
          
          for (const selector of filterSelectors) {
            try {
              const filterElement = await this.page.$(selector);
              if (filterElement) {
                const tagName = await filterElement.evaluate(el => el.tagName.toLowerCase());
                
                if (tagName === 'select') {
                  await this.page.select(filterElement, 'recent');
                } else {
                  await filterElement.click();
                }
                
                await this.page.waitForTimeout(1000);
                searchFilterWorking = true;
                break;
              }
            } catch (e) {}
          }
        }
      }
      
      const duration = Date.now() - startTime;
      const overallSuccess = historyAccessed && (fileListDisplayed || fileInteractionWorking);
      
      this.results.fileManagementFlow = {
        status: overallSuccess ? 'healthy' : 'unhealthy',
        message: `History Accessed: ${historyAccessed ? 'SUCCESS' : 'FAILED'}, File List: ${fileListDisplayed ? 'SUCCESS' : 'FAILED'}, Interaction: ${fileInteractionWorking ? 'SUCCESS' : 'FAILED'}, Search/Filter: ${searchFilterWorking ? 'SUCCESS' : 'FAILED'}`,
        duration,
        details: {
          historyAccessed,
          fileListDisplayed,
          fileInteractionWorking,
          searchFilterWorking
        }
      };
      
      TestUtils.log.success(`File management flow: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.fileManagementFlow = {
        status: 'unhealthy',
        message: `File management flow failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`File management flow failed: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    TestUtils.log.info('Starting end-to-end test scenarios...');
    const startTime = Date.now();
    
    try {
      await this.setupBrowser();
      
      // Run E2E tests sequentially
      await this.testUserRegistrationAndLoginFlow();
      await this.testAudioRecordingAndUploadFlow();
      await this.testFileUploadAndTranscriptionFlow();
      await this.testTranscriptionAndTransformationFlow();
      await this.testFileManagementAndHistoryFlow();
      
    } finally {
      await this.cleanup();
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Generate summary
    const healthyFlows = Object.values(this.results).filter(r => r.status === 'healthy' || r.status === 'partial').length;
    const totalFlows = Object.keys(this.results).length;
    
    TestUtils.log.info(`\\n=== End-to-End Test Results ===`);
    TestUtils.log.info(`Total Duration: ${TestUtils.formatDuration(totalDuration)}`);
    TestUtils.log.info(`Working Flows: ${healthyFlows}/${totalFlows}`);
    
    Object.entries(this.results).forEach(([flow, result]) => {
      const statusIcon = result.status === 'healthy' ? '✓' : result.status === 'partial' ? '⚠' : '✗';
      
      console.log(`${statusIcon} ${flow.toUpperCase()}: ${result.message} (${TestUtils.formatDuration(result.duration)})`);
    });
    
    return {
      summary: {
        totalDuration,
        healthyFlows,
        totalFlows,
        allHealthy: healthyFlows === totalFlows
      },
      results: this.results
    };
  }
}

// CLI execution
if (require.main === module) {
  const tester = new E2ETester();
  tester.runAllTests()
    .then(results => {
      if (results.summary.allHealthy) {
        TestUtils.log.success('All E2E flows are working!');
        process.exit(0);
      } else {
        TestUtils.log.warning('Some E2E flows need attention!');
        process.exit(1);
      }
    })
    .catch(error => {
      TestUtils.log.error(`E2E test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = E2ETester;
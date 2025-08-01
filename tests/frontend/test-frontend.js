// Frontend functionality tests using Puppeteer
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { CONFIG, TestUtils } = require('../config');

class FrontendTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      pageLoad: { status: 'unknown', message: '', duration: 0 },
      authentication: { status: 'unknown', message: '', duration: 0 },
      recording: { status: 'unknown', message: '', duration: 0 },
      fileUpload: { status: 'unknown', message: '', duration: 0 },
      history: { status: 'unknown', message: '', duration: 0 },
      navigation: { status: 'unknown', message: '', duration: 0 }
    };
  }

  async setupBrowser() {
    TestUtils.log.test('Setting up browser...');
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport and user agent
    await this.page.setViewport({
      width: 1280,
      height: 720
    });
    
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Enable request interception for monitoring
    await this.page.setRequestInterception(true);
    
    this.page.on('request', (request) => {
      request.continue();
    });
    
    // Handle console logs and errors
    this.page.on('console', (message) => {
      if (message.type() === 'error') {
        TestUtils.log.warning(`Console error: ${message.text()}`);
      }
    });
    
    this.page.on('pageerror', (error) => {
      TestUtils.log.error(`Page error: ${error.message}`);
    });
  }

  async testPageLoad() {
    const startTime = Date.now();
    TestUtils.log.test('Testing page load...');
    
    try {
      const response = await this.page.goto(CONFIG.BASE_URL, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUT.LONG
      });
      
      const pageTitle = await this.page.title();
      const isPageLoaded = response.status() === 200 && pageTitle.length > 0;
      
      // Check for essential elements
      const hasHeader = await this.page.$('header') !== null;
      const hasMainContent = await this.page.$('main') !== null || await this.page.$('[role="main"]') !== null;
      
      // Take screenshot for verification
      const screenshotPath = path.join(__dirname, '..', 'screenshots', `page-load-${Date.now()}.png`);
      const screenshotDir = path.dirname(screenshotPath);
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      await this.page.screenshot({ path: screenshotPath });
      
      const duration = Date.now() - startTime;
      this.results.pageLoad = {
        status: isPageLoaded ? 'healthy' : 'unhealthy',
        message: `Page loaded with status ${response.status()}. Title: "${pageTitle}". Header: ${hasHeader}, Main: ${hasMainContent}`,
        duration,
        details: {
          httpStatus: response.status(),
          title: pageTitle,
          hasHeader,
          hasMainContent,
          screenshot: screenshotPath
        }
      };
      
      TestUtils.log.success(`Page load: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.pageLoad = {
        status: 'unhealthy',
        message: `Page load failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Page load failed: ${error.message}`);
    }
  }

  async testAuthentication() {
    const startTime = Date.now();
    TestUtils.log.test('Testing authentication flow...');
    
    try {
      let authSuccess = false;
      let signInFound = false;
      let signUpFound = false;
      
      // Look for sign in/up buttons or forms
      const signInSelectors = [
        'a[href*="signin"]',
        'button:contains("Sign In")',
        'button:contains("Login")',
        '.auth-button',
        '[data-testid="signin"]'
      ];
      
      const signUpSelectors = [
        'a[href*="signup"]',
        'button:contains("Sign Up")',
        'button:contains("Register")',
        '.signup-button',
        '[data-testid="signup"]'
      ];
      
      // Check for authentication elements
      for (const selector of signInSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            signInFound = true;
            break;
          }
        } catch (e) {
          // Selector might not be valid, continue
        }
      }
      
      for (const selector of signUpSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            signUpFound = true;
            break;
          }
        } catch (e) {
          // Selector might not be valid, continue
        }
      }
      
      // Try to navigate to auth pages
      let signInPageAccessible = false;
      let signUpPageAccessible = false;
      
      try {
        const signInResponse = await this.page.goto(`${CONFIG.BASE_URL}/auth/signin`, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.TIMEOUT.MEDIUM
        });
        signInPageAccessible = signInResponse.status() === 200;
      } catch (e) {
        TestUtils.log.warning(`Sign in page not accessible: ${e.message}`);
      }
      
      try {
        const signUpResponse = await this.page.goto(`${CONFIG.BASE_URL}/auth/signup`, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.TIMEOUT.MEDIUM
        });
        signUpPageAccessible = signUpResponse.status() === 200;
      } catch (e) {
        TestUtils.log.warning(`Sign up page not accessible: ${e.message}`);
      }
      
      // Test form submission (if forms are found)
      let formSubmissionTest = false;
      if (signInPageAccessible) {
        try {
          // Look for email and password fields
          const emailField = await this.page.$('input[type="email"], input[name="email"]');
          const passwordField = await this.page.$('input[type="password"], input[name="password"]');
          const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
          
          if (emailField && passwordField && submitButton) {
            // Fill in test credentials (don't actually submit to avoid creating test accounts)
            await this.page.type('input[type="email"], input[name="email"]', 'test@example.com');
            await this.page.type('input[type="password"], input[name="password"]', 'testpassword');
            
            formSubmissionTest = true;
          }
        } catch (e) {
          TestUtils.log.warning(`Form interaction test failed: ${e.message}`);
        }
      }
      
      authSuccess = signInFound || signUpFound || signInPageAccessible || signUpPageAccessible;
      
      const duration = Date.now() - startTime;
      this.results.authentication = {
        status: authSuccess ? 'healthy' : 'unhealthy',
        message: `Auth elements: SignIn(${signInFound}), SignUp(${signUpFound}). Pages: SignIn(${signInPageAccessible}), SignUp(${signUpPageAccessible}). Forms: ${formSubmissionTest}`,
        duration,
        details: {
          signInFound,
          signUpFound,
          signInPageAccessible,
          signUpPageAccessible,
          formSubmissionTest
        }
      };
      
      TestUtils.log.success(`Authentication: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.authentication = {
        status: 'unhealthy',
        message: `Authentication test failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Authentication failed: ${error.message}`);
    }
  }

  async testRecordingFunctionality() {
    const startTime = Date.now();
    TestUtils.log.test('Testing recording functionality...');
    
    try {
      // Go back to main page
      await this.page.goto(CONFIG.BASE_URL, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.TIMEOUT.MEDIUM
      });
      
      let recordingElementsFound = false;
      let recordingButtonWorking = false;
      
      // Look for recording-related elements
      const recordingSelectors = [
        'button:contains("Record")',
        'button:contains("Start Recording")',
        '.record-button',
        '.microphone-button',
        '[data-testid="record"]',
        'button[aria-label*="record"]'
      ];
      
      let recordButton = null;
      for (const selector of recordingSelectors) {
        try {
          recordButton = await this.page.$(selector);
          if (recordButton) {
            recordingElementsFound = true;
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }
      
      // If no button found by text, look for buttons with microphone icons or similar
      if (!recordButton) {
        const buttons = await this.page.$$('button');
        for (const button of buttons) {
          try {
            const buttonText = await button.evaluate(el => el.textContent || el.getAttribute('aria-label') || '');
            if (buttonText.toLowerCase().includes('record') || buttonText.toLowerCase().includes('mic')) {
              recordButton = button;
              recordingElementsFound = true;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }
      
      // Test recording button interaction
      if (recordButton) {
        try {
          // Mock getUserMedia for testing
          await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'mediaDevices', {
              writable: true,
              value: {
                getUserMedia: async () => {
                  // Return a mock MediaStream
                  return {
                    getTracks: () => [{
                      stop: () => {},
                      kind: 'audio',
                      enabled: true
                    }],
                    getAudioTracks: () => [{
                      stop: () => {},
                      kind: 'audio',
                      enabled: true
                    }]
                  };
                }
              }
            });
          });
          
          // Click the record button
          await recordButton.click();
          
          // Wait a moment and check if any recording UI appeared
          await this.page.waitForTimeout(2000);
          
          // Look for recording indicators
          const recordingIndicators = [
            '.recording-indicator',
            '.recording-active',
            '[data-testid="recording"]',
            'button:contains("Stop")',
            'button:contains("Stop Recording")'
          ];
          
          let recordingActive = false;
          for (const selector of recordingIndicators) {
            try {
              const indicator = await this.page.$(selector);
              if (indicator) {
                recordingActive = true;
                break;
              }
            } catch (e) {
              // Continue
            }
          }
          
          recordingButtonWorking = recordingActive;
          
        } catch (e) {
          TestUtils.log.warning(`Recording button interaction failed: ${e.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      this.results.recording = {
        status: recordingElementsFound ? 'healthy' : 'unhealthy',
        message: `Recording elements found: ${recordingElementsFound}. Button working: ${recordingButtonWorking}`,
        duration,
        details: {
          recordingElementsFound,
          recordingButtonWorking
        }
      };
      
      TestUtils.log.success(`Recording: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.recording = {
        status: 'unhealthy',
        message: `Recording test failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Recording failed: ${error.message}`);
    }
  }

  async testFileUpload() {
    const startTime = Date.now();
    TestUtils.log.test('Testing file upload functionality...');
    
    try {
      let uploadElementsFound = false;
      let uploadInteractionWorking = false;
      
      // Look for upload-related elements
      const uploadSelectors = [
        'input[type="file"]',
        'button:contains("Upload")',
        '.upload-button',
        '.file-upload',
        '[data-testid="upload"]',
        '.dropzone'
      ];
      
      let uploadElement = null;
      for (const selector of uploadSelectors) {
        try {
          uploadElement = await this.page.$(selector);
          if (uploadElement) {
            uploadElementsFound = true;
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }
      
      // Test file upload interaction
      if (uploadElement) {
        try {
          const tagName = await uploadElement.evaluate(el => el.tagName.toLowerCase());
          
          if (tagName === 'input') {
            // Create a test file
            const testFileName = 'test-audio.wav';
            const testFilePath = path.join(__dirname, '..', 'test-data', testFileName);
            
            // Create test file if it doesn't exist
            const testDataDir = path.dirname(testFilePath);
            if (!fs.existsSync(testDataDir)) {
              fs.mkdirSync(testDataDir, { recursive: true });
            }
            
            if (!fs.existsSync(testFilePath)) {
              // Create a minimal WAV file
              const wavHeader = Buffer.from([
                0x52, 0x49, 0x46, 0x46, // "RIFF"
                0x24, 0x08, 0x00, 0x00, // File size - 8
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
                0x00, 0x08, 0x00, 0x00  // Data size
              ]);
              
              const silenceData = Buffer.alloc(2048, 0);
              const testFileContent = Buffer.concat([wavHeader, silenceData]);
              fs.writeFileSync(testFilePath, testFileContent);
            }
            
            // Upload the file
            await uploadElement.uploadFile(testFilePath);
            uploadInteractionWorking = true;
            
            // Wait for any upload feedback
            await this.page.waitForTimeout(2000);
            
          } else {
            // Try clicking the upload button/area
            await uploadElement.click();
            uploadInteractionWorking = true;
            
            // Wait for any response
            await this.page.waitForTimeout(2000);
          }
          
        } catch (e) {
          TestUtils.log.warning(`File upload interaction failed: ${e.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      this.results.fileUpload = {
        status: uploadElementsFound ? 'healthy' : 'unhealthy',
        message: `Upload elements found: ${uploadElementsFound}. Interaction working: ${uploadInteractionWorking}`,
        duration,
        details: {
          uploadElementsFound,
          uploadInteractionWorking
        }
      };
      
      TestUtils.log.success(`File upload: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.fileUpload = {
        status: 'unhealthy',
        message: `File upload test failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`File upload failed: ${error.message}`);
    }
  }

  async testHistoryView() {
    const startTime = Date.now();
    TestUtils.log.test('Testing history/whispers view...');
    
    try {
      let historyAccessible = false;
      let historyElementsFound = false;
      
      // Try to navigate to whispers/history page
      const historyUrls = [
        `${CONFIG.BASE_URL}/whispers`,
        `${CONFIG.BASE_URL}/history`,
        `${CONFIG.BASE_URL}/recordings`
      ];
      
      for (const url of historyUrls) {
        try {
          const response = await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.TIMEOUT.MEDIUM
          });
          
          if (response.status() === 200) {
            historyAccessible = true;
            
            // Look for history-related elements
            const historySelectors = [
              '.whisper-item',
              '.recording-item',
              '.history-item',
              '[data-testid="whisper"]',
              '.transcription'
            ];
            
            for (const selector of historySelectors) {
              try {
                const element = await this.page.$(selector);
                if (element) {
                  historyElementsFound = true;
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
            
            break;
          }
        } catch (e) {
          // Continue to next URL
        }
      }
      
      // Also check for navigation links to history
      if (!historyAccessible) {
        await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
        
        const historyLinks = [
          'a[href*="whispers"]',
          'a[href*="history"]',
          'a:contains("History")',
          'a:contains("Whispers")',
          'a:contains("Recordings")'
        ];
        
        for (const selector of historyLinks) {
          try {
            const link = await this.page.$(selector);
            if (link) {
              historyAccessible = true;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this.results.history = {
        status: historyAccessible ? 'healthy' : 'unhealthy',
        message: `History accessible: ${historyAccessible}. Elements found: ${historyElementsFound}`,
        duration,
        details: {
          historyAccessible,
          historyElementsFound
        }
      };
      
      TestUtils.log.success(`History view: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.history = {
        status: 'unhealthy',
        message: `History test failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`History failed: ${error.message}`);
    }
  }

  async testNavigation() {
    const startTime = Date.now();
    TestUtils.log.test('Testing navigation...');
    
    try {
      await this.page.goto(CONFIG.BASE_URL, { waitUntil: 'networkidle2' });
      
      let navigationElementsFound = false;
      let navigationWorking = false;
      
      // Look for navigation elements
      const navSelectors = [
        'nav',
        '.navbar',
        '.navigation',
        'header nav',
        '[role="navigation"]'
      ];
      
      let navElement = null;
      for (const selector of navSelectors) {
        try {
          navElement = await this.page.$(selector);
          if (navElement) {
            navigationElementsFound = true;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      // Test navigation links
      if (navElement) {
        try {
          const links = await navElement.$$('a');
          if (links.length > 0) {
            // Click the first link and see if navigation occurs
            const firstLink = links[0];
            const href = await firstLink.evaluate(el => el.getAttribute('href'));
            
            if (href && href !== '#') {
              await firstLink.click();
              await this.page.waitForTimeout(2000);
              
              const currentUrl = this.page.url();
              navigationWorking = currentUrl !== CONFIG.BASE_URL;
            }
          }
        } catch (e) {
          TestUtils.log.warning(`Navigation interaction failed: ${e.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      this.results.navigation = {
        status: navigationElementsFound ? 'healthy' : 'unhealthy',
        message: `Navigation elements found: ${navigationElementsFound}. Navigation working: ${navigationWorking}`,
        duration,
        details: {
          navigationElementsFound,
          navigationWorking
        }
      };
      
      TestUtils.log.success(`Navigation: ${TestUtils.formatDuration(duration)}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.navigation = {
        status: 'unhealthy',
        message: `Navigation test failed: ${error.message}`,
        duration,
        error: error.message
      };
      
      TestUtils.log.error(`Navigation failed: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    TestUtils.log.info('Starting frontend functionality tests...');
    const startTime = Date.now();
    
    try {
      await this.setupBrowser();
      
      // Run tests sequentially
      await this.testPageLoad();
      await this.testAuthentication();
      await this.testRecordingFunctionality();
      await this.testFileUpload();
      await this.testHistoryView();
      await this.testNavigation();
      
    } finally {
      await this.cleanup();
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Generate summary
    const healthyFeatures = Object.values(this.results).filter(r => r.status === 'healthy').length;
    const totalFeatures = Object.keys(this.results).length;
    
    TestUtils.log.info(`\\n=== Frontend Functionality Test Results ===`);
    TestUtils.log.info(`Total Duration: ${TestUtils.formatDuration(totalDuration)}`);
    TestUtils.log.info(`Healthy Features: ${healthyFeatures}/${totalFeatures}`);
    
    Object.entries(this.results).forEach(([feature, result]) => {
      const statusIcon = result.status === 'healthy' ? '✓' : '✗';
      
      console.log(`${statusIcon} ${feature.toUpperCase()}: ${result.message} (${TestUtils.formatDuration(result.duration)})`);
    });
    
    return {
      summary: {
        totalDuration,
        healthyFeatures,
        totalFeatures,
        allHealthy: healthyFeatures === totalFeatures
      },
      results: this.results
    };
  }
}

// CLI execution
if (require.main === module) {
  const tester = new FrontendTester();
  tester.runAllTests()
    .then(results => {
      if (results.summary.allHealthy) {
        TestUtils.log.success('All frontend features are working!');
        process.exit(0);
      } else {
        TestUtils.log.warning('Some frontend features need attention!');
        process.exit(1);
      }
    })
    .catch(error => {
      TestUtils.log.error(`Frontend test execution failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = FrontendTester;
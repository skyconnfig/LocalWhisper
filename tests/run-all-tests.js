#!/usr/bin/env node
// Main test runner script
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { CONFIG, TestUtils } = require('./config');
const TestReportGenerator = require('./utils/generate-report');

// Import test classes
const ServiceTester = require('./services/test-services');
const APITester = require('./api/test-api-endpoints');
const FrontendTester = require('./frontend/test-frontend');
const E2ETester = require('./e2e/test-e2e');
const PerformanceTester = require('./performance/test-performance');
const ErrorHandlingTester = require('./error-handling/test-error-handling');

class TestRunner {
  constructor() {
    this.reportGenerator = new TestReportGenerator();
    this.results = {};
    this.options = {
      skipServices: false,
      skipAPI: false,
      skipFrontend: false,
      skipE2E: false,
      skipPerformance: false,
      skipErrorHandling: false,
      generateReport: true,
      verbose: false,
      parallel: false
    };
  }

  parseCommandLineArgs() {
    const args = process.argv.slice(2);
    
    args.forEach(arg => {
      switch (arg) {
        case '--skip-services':
          this.options.skipServices = true;
          break;
        case '--skip-api':
          this.options.skipAPI = true;
          break;
        case '--skip-frontend':
          this.options.skipFrontend = true;
          break;
        case '--skip-e2e':
          this.options.skipE2E = true;
          break;
        case '--skip-performance':
          this.options.skipPerformance = true;
          break;
        case '--skip-error-handling':
          this.options.skipErrorHandling = true;
          break;
        case '--no-report':
          this.options.generateReport = false;
          break;
        case '--verbose':
          this.options.verbose = true;
          process.env.VERBOSE_TESTS = 'true';
          break;
        case '--parallel':
          this.options.parallel = true;
          break;
        case '--help':
          this.showHelp();
          process.exit(0);
          break;
      }
    });
  }

  showHelp() {
    console.log(`
🎙️ Whisper Local Deployment Test Runner

Usage: node run-all-tests.js [options]

Options:
  --skip-services        Skip service connection tests
  --skip-api            Skip API endpoint tests  
  --skip-frontend       Skip frontend functionality tests
  --skip-e2e            Skip end-to-end tests
  --skip-performance    Skip performance tests
  --skip-error-handling Skip error handling tests
  --no-report           Don't generate test reports
  --verbose             Show detailed test output
  --parallel            Run tests in parallel (experimental)
  --help                Show this help message

Examples:
  node run-all-tests.js                    # Run all tests
  node run-all-tests.js --skip-e2e         # Skip E2E tests
  node run-all-tests.js --verbose          # Show detailed output
  node run-all-tests.js --skip-performance --skip-error-handling

Test Categories:
  1. Services       - Database, Redis, MinIO, Ollama connectivity
  2. API            - REST API endpoints and responses
  3. Frontend       - UI functionality and user interactions  
  4. E2E            - Complete user workflows
  5. Performance    - Response times, throughput, resource usage
  6. Error Handling - Resilience and error recovery

Reports will be generated in ./test-reports/ directory.
    `);
  }

  async runServiceTests() {
    if (this.options.skipServices) {
      TestUtils.log.info('Skipping service tests...');
      return null;
    }

    TestUtils.log.info('🔧 Running service connection tests...');
    const tester = new ServiceTester();
    const results = await tester.runAllTests();
    this.results.services = results;
    return results;
  }

  async runAPITests() {
    if (this.options.skipAPI) {
      TestUtils.log.info('Skipping API tests...');
      return null;
    }

    TestUtils.log.info('🌐 Running API endpoint tests...');
    const tester = new APITester();
    const results = await tester.runAllTests();
    this.results.api = results;
    return results;
  }

  async runFrontendTests() {
    if (this.options.skipFrontend) {
      TestUtils.log.info('Skipping frontend tests...');
      return null;
    }

    TestUtils.log.info('🖥️ Running frontend functionality tests...');
    const tester = new FrontendTester();
    const results = await tester.runAllTests();
    this.results.frontend = results;
    return results;
  }

  async runE2ETests() {
    if (this.options.skipE2E) {
      TestUtils.log.info('Skipping E2E tests...');
      return null;
    }

    TestUtils.log.info('🔄 Running end-to-end tests...');
    const tester = new E2ETester();
    const results = await tester.runAllTests();
    this.results.e2e = results;
    return results;
  }

  async runPerformanceTests() {
    if (this.options.skipPerformance) {
      TestUtils.log.info('Skipping performance tests...');
      return null;
    }

    TestUtils.log.info('⚡ Running performance tests...');
    const tester = new PerformanceTester();
    const results = await tester.runAllTests();
    this.results.performance = results;
    return results;
  }

  async runErrorHandlingTests() {
    if (this.options.skipErrorHandling) {
      TestUtils.log.info('Skipping error handling tests...');
      return null;
    }

    TestUtils.log.info('🛡️ Running error handling tests...');
    const tester = new ErrorHandlingTester();
    const results = await tester.runAllTests();
    this.results.errorHandling = results;
    return results;
  }

  async runTestsSequentially() {
    const testFunctions = [
      this.runServiceTests.bind(this),
      this.runAPITests.bind(this),
      this.runFrontendTests.bind(this),
      this.runE2ETests.bind(this),
      this.runPerformanceTests.bind(this),
      this.runErrorHandlingTests.bind(this)
    ];

    for (const testFunction of testFunctions) {
      try {
        await testFunction();
      } catch (error) {
        TestUtils.log.error(`Test category failed: ${error.message}`);
      }
    }
  }

  async runTestsInParallel() {
    TestUtils.log.warning('Running tests in parallel - some tests may interfere with each other!');
    
    const testPromises = [
      this.runServiceTests().catch(error => ({ error: error.message })),
      this.runAPITests().catch(error => ({ error: error.message })),
      this.runFrontendTests().catch(error => ({ error: error.message })),
      this.runE2ETests().catch(error => ({ error: error.message })),
      this.runPerformanceTests().catch(error => ({ error: error.message })),
      this.runErrorHandlingTests().catch(error => ({ error: error.message }))
    ];

    await Promise.all(testPromises);
  }

  async generateReports() {
    if (!this.options.generateReport) {
      TestUtils.log.info('Report generation skipped.');
      return;
    }

    TestUtils.log.info('📊 Generating test reports...');

    // Add results to report generator
    Object.entries(this.results).forEach(([category, results]) => {
      if (results && !results.error) {
        this.reportGenerator.addCategoryResults(category, results);
      }
    });

    try {
      const reportPaths = await this.reportGenerator.saveReports('./test-reports');
      
      TestUtils.log.success('Reports generated successfully:');
      TestUtils.log.info(`📄 HTML Report: ${reportPaths.html}`);
      TestUtils.log.info(`📋 JSON Report: ${reportPaths.json}`);
      TestUtils.log.info(`📝 Markdown Report: ${reportPaths.markdown}`);
      TestUtils.log.info('');
      TestUtils.log.info('📍 Latest reports (always up-to-date):');
      TestUtils.log.info(`📄 HTML: ${reportPaths.latest.html}`);
      TestUtils.log.info(`📋 JSON: ${reportPaths.latest.json}`);
      TestUtils.log.info(`📝 Markdown: ${reportPaths.latest.md}`);

    } catch (error) {
      TestUtils.log.error(`Report generation failed: ${error.message}`);
    }
  }

  printSummary() {
    TestUtils.log.info('\\n' + '='.repeat(60));
    TestUtils.log.info('🎙️ WHISPER LOCAL DEPLOYMENT TEST SUMMARY');
    TestUtils.log.info('='.repeat(60));

    const categoryResults = Object.entries(this.results).filter(([_, results]) => results && !results.error);
    const totalCategories = categoryResults.length;
    const healthyCategories = categoryResults.filter(([_, results]) => results.summary?.allHealthy).length;

    TestUtils.log.info(`📊 Categories Tested: ${totalCategories}`);
    TestUtils.log.info(`✅ Healthy Categories: ${healthyCategories}`);
    TestUtils.log.info(`❌ Unhealthy Categories: ${totalCategories - healthyCategories}`);

    const overallHealthPercentage = totalCategories > 0 ? (healthyCategories / totalCategories) * 100 : 0;
    const overallHealth = overallHealthPercentage >= 75 ? 'GOOD' : overallHealthPercentage >= 50 ? 'FAIR' : 'POOR';
    const healthEmoji = overallHealthPercentage >= 75 ? '🟢' : overallHealthPercentage >= 50 ? '🟡' : '🔴';

    TestUtils.log.info(`${healthEmoji} Overall Health: ${overallHealth} (${overallHealthPercentage.toFixed(1)}%)`);

    TestUtils.log.info('\\n📋 Category Details:');
    categoryResults.forEach(([category, results]) => {
      const status = results.summary?.allHealthy ? '✅' : '❌';
      const duration = results.summary?.totalDuration ? TestUtils.formatDuration(results.summary.totalDuration) : 'N/A';
      const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      TestUtils.log.info(`${status} ${categoryName}: ${duration}`);
    });

    if (overallHealthPercentage < 100) {
      TestUtils.log.info('\\n💡 Recommendations:');
      TestUtils.log.info('- Check failed test details in the generated reports');
      TestUtils.log.info('- Verify all services are running: docker-compose ps');
      TestUtils.log.info('- Check service logs: docker-compose logs [service-name]');
      TestUtils.log.info('- Review configuration files and environment variables');
    }

    TestUtils.log.info('\\n🏁 Test run completed!');
    
    return overallHealthPercentage >= 75;
  }

  async run() {
    const startTime = Date.now();
    
    TestUtils.log.info('🚀 Starting Whisper Local Deployment Test Suite...');
    TestUtils.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    TestUtils.log.info(`Base URL: ${CONFIG.BASE_URL}`);
    TestUtils.log.info(`Timestamp: ${new Date().toISOString()}`);
    TestUtils.log.info('');

    this.parseCommandLineArgs();

    if (this.options.parallel) {
      await this.runTestsInParallel();
    } else {
      await this.runTestsSequentially();
    }

    await this.generateReports();

    const totalDuration = Date.now() - startTime;
    TestUtils.log.info(`\\n⏱️ Total test execution time: ${TestUtils.formatDuration(totalDuration)}`);

    const success = this.printSummary();
    
    process.exit(success ? 0 : 1);
  }
}

// CLI execution
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(error => {
    TestUtils.log.error(`Test runner failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = TestRunner;
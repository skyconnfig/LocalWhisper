// Test report generator
const fs = require('fs');
const path = require('path');
const { CONFIG, TestUtils } = require('../config');

class TestReportGenerator {
  constructor() {
    this.reportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        baseUrl: CONFIG.BASE_URL,
        testVersion: '1.0.0'
      },
      summary: {
        totalDuration: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        overallHealth: 'unknown'
      },
      categories: {}
    };
  }

  addCategoryResults(categoryName, results) {
    this.reportData.categories[categoryName] = {
      name: categoryName,
      status: results.summary?.allHealthy ? 'passed' : 'failed',
      duration: results.summary?.totalDuration || 0,
      results: results.results || {},
      summary: results.summary || {},
      timestamp: new Date().toISOString()
    };

    // Update overall summary
    this.reportData.summary.totalDuration += results.summary?.totalDuration || 0;
    this.reportData.summary.totalTests += Object.keys(results.results || {}).length;
    
    if (results.summary?.allHealthy) {
      this.reportData.summary.passedTests += Object.keys(results.results || {}).length;
    } else {
      this.reportData.summary.failedTests += Object.keys(results.results || {}).length;
    }
  }

  calculateOverallHealth() {
    const totalCategories = Object.keys(this.reportData.categories).length;
    const passedCategories = Object.values(this.reportData.categories).filter(c => c.status === 'passed').length;
    
    const healthPercentage = totalCategories > 0 ? (passedCategories / totalCategories) * 100 : 0;
    
    if (healthPercentage >= 90) {
      this.reportData.summary.overallHealth = 'excellent';
    } else if (healthPercentage >= 75) {
      this.reportData.summary.overallHealth = 'good';
    } else if (healthPercentage >= 50) {
      this.reportData.summary.overallHealth = 'fair';
    } else {
      this.reportData.summary.overallHealth = 'poor';
    }

    return this.reportData.summary.overallHealth;
  }

  generateHTMLReport() {
    const overallHealth = this.calculateOverallHealth();
    const healthColor = {
      'excellent': '#10b981',
      'good': '#3b82f6',
      'fair': '#f59e0b',
      'poor': '#ef4444'
    }[overallHealth] || '#6b7280';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Whisper Local Deployment Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #374151;
            background-color: #f9fafb;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid ${healthColor};
        }
        .summary-card h3 {
            color: #1f2937;
            margin-bottom: 0.5rem;
        }
        .summary-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: ${healthColor};
        }
        .category-section {
            background: white;
            margin-bottom: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .category-header {
            background: #f3f4f6;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .category-header h2 {
            color: #1f2937;
            font-size: 1.25rem;
        }
        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .status-passed {
            background: #d1fae5;
            color: #065f46;
        }
        .status-failed {
            background: #fee2e2;
            color: #991b1b;
        }
        .category-content {
            padding: 1.5rem;
        }
        .test-grid {
            display: grid;
            gap: 1rem;
        }
        .test-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 3px solid #e5e7eb;
        }
        .test-item.healthy {
            border-left-color: #10b981;
        }
        .test-item.unhealthy {
            border-left-color: #ef4444;
        }
        .test-item.partial {
            border-left-color: #f59e0b;
        }
        .test-name {
            font-weight: 500;
            color: #1f2937;
        }
        .test-message {
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 0.25rem;
        }
        .test-metrics {
            text-align: right;
            font-size: 0.875rem;
            color: #6b7280;
        }
        .footer {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
            font-size: 0.875rem;
        }
        .chart-container {
            margin: 1rem 0;
            height: 200px;
            display: flex;
            align-items: end;
            justify-content: space-around;
            background: #f9fafb;
            border-radius: 6px;
            padding: 1rem;
        }
        .chart-bar {
            background: ${healthColor};
            border-radius: 4px 4px 0 0;
            min-height: 20px;
            width: 60px;
            position: relative;
        }
        .chart-label {
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.75rem;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎙️ Whisper Local Deployment Test Report</h1>
            <p>Generated on ${new Date(this.reportData.metadata.timestamp).toLocaleString()}</p>
            <p>Environment: ${this.reportData.metadata.environment} | Base URL: ${this.reportData.metadata.baseUrl}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Overall Health</h3>
                <div class="value">${overallHealth.toUpperCase()}</div>
            </div>
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${this.reportData.summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Passed Tests</h3>
                <div class="value">${this.reportData.summary.passedTests}</div>
            </div>
            <div class="summary-card">
                <h3>Total Duration</h3>
                <div class="value">${TestUtils.formatDuration(this.reportData.summary.totalDuration)}</div>
            </div>
        </div>

        ${Object.entries(this.reportData.categories).map(([categoryName, category]) => `
        <div class="category-section">
            <div class="category-header">
                <h2>${category.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h2>
                <span class="status-badge status-${category.status}">${category.status.toUpperCase()}</span>
            </div>
            <div class="category-content">
                <div class="test-grid">
                    ${Object.entries(category.results).map(([testName, result]) => `
                    <div class="test-item ${result.status}">
                        <div>
                            <div class="test-name">${testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
                            <div class="test-message">${result.message}</div>
                        </div>
                        <div class="test-metrics">
                            ${result.duration ? TestUtils.formatDuration(result.duration) : 'N/A'}
                        </div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
        `).join('')}

        <div class="footer">
            <p>Report generated by Whisper Local Deployment Test Suite v${this.reportData.metadata.testVersion}</p>
            <p>For more information, check the detailed logs or run individual test scripts</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
  }

  generateJSONReport() {
    return JSON.stringify(this.reportData, null, 2);
  }

  generateMarkdownReport() {
    const overallHealth = this.calculateOverallHealth();
    const healthEmoji = {
      'excellent': '🟢',
      'good': '🔵', 
      'fair': '🟡',
      'poor': '🔴'
    }[overallHealth] || '⚪';

    let markdown = `# 🎙️ Whisper Local Deployment Test Report

**Generated:** ${new Date(this.reportData.metadata.timestamp).toLocaleString()}  
**Environment:** ${this.reportData.metadata.environment}  
**Base URL:** ${this.reportData.metadata.baseUrl}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Overall Health | ${healthEmoji} ${overallHealth.toUpperCase()} |
| Total Tests | ${this.reportData.summary.totalTests} |
| Passed Tests | ✅ ${this.reportData.summary.passedTests} |
| Failed Tests | ❌ ${this.reportData.summary.failedTests} |
| Total Duration | ⏱️ ${TestUtils.formatDuration(this.reportData.summary.totalDuration)} |

## 📋 Test Categories

`;

    Object.entries(this.reportData.categories).forEach(([categoryName, category]) => {
      const statusEmoji = category.status === 'passed' ? '✅' : '❌';
      const categoryTitle = category.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      markdown += `### ${statusEmoji} ${categoryTitle}

**Status:** ${category.status.toUpperCase()}  
**Duration:** ${TestUtils.formatDuration(category.duration)}

| Test | Status | Message | Duration |
|------|--------|---------|----------|
`;

      Object.entries(category.results).forEach(([testName, result]) => {
        const testEmoji = result.status === 'healthy' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
        const testTitle = testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const duration = result.duration ? TestUtils.formatDuration(result.duration) : 'N/A';
        
        markdown += `| ${testEmoji} ${testTitle} | ${result.status.toUpperCase()} | ${result.message} | ${duration} |\\n`;
      });

      markdown += '\\n';
    });

    markdown += `## 🔍 Recommendations

Based on the test results, here are some recommendations:

`;

    // Generate recommendations based on test results
    const failedCategories = Object.values(this.reportData.categories).filter(c => c.status === 'failed');
    
    if (failedCategories.length === 0) {
      markdown += `- ✅ All test categories passed! Your Whisper deployment is healthy.
- 🔧 Consider running performance optimization if response times are slower than expected.
- 📊 Monitor system resources during peak usage.
`;
    } else {
      failedCategories.forEach(category => {
        const categoryTitle = category.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        markdown += `- ❌ **${categoryTitle}**: Review the failed tests and check service configurations.\\n`;
      });
    }

    markdown += `
## 📞 Support

If you encounter issues:

1. Check the detailed logs in the test output
2. Verify all services are running: \`docker-compose ps\`
3. Check service logs: \`docker-compose logs [service-name]\`
4. Review the configuration files
5. Run individual test scripts for more detailed debugging

---
*Report generated by Whisper Local Deployment Test Suite v${this.reportData.metadata.testVersion}*
`;

    return markdown;
  }

  async saveReports(outputDir = './test-reports') {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save HTML report
    const htmlPath = path.join(outputDir, `test-report-${timestamp}.html`);
    fs.writeFileSync(htmlPath, this.generateHTMLReport());
    
    // Save JSON report
    const jsonPath = path.join(outputDir, `test-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, this.generateJSONReport());
    
    // Save Markdown report
    const mdPath = path.join(outputDir, `test-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, this.generateMarkdownReport());
    
    // Also save as latest reports (overwrite)
    fs.writeFileSync(path.join(outputDir, 'latest-report.html'), this.generateHTMLReport());
    fs.writeFileSync(path.join(outputDir, 'latest-report.json'), this.generateJSONReport());
    fs.writeFileSync(path.join(outputDir, 'latest-report.md'), this.generateMarkdownReport());

    return {
      html: htmlPath,
      json: jsonPath,
      markdown: mdPath,
      latest: {
        html: path.join(outputDir, 'latest-report.html'),
        json: path.join(outputDir, 'latest-report.json'),
        markdown: path.join(outputDir, 'latest-report.md')
      }
    };
  }
}

module.exports = TestReportGenerator;
# 🧪 Whisper Local Deployment Testing

This directory contains a comprehensive test suite for validating your Whisper local deployment.

## Quick Start

### 1. Check System Health
```bash
npm run test:health
```

### 2. Run Quick Tests
```bash
npm run test:quick
```

### 3. Run All Tests
```bash
npm run test
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test:health` | Check if all services are running |
| `npm run test:quick` | Quick test (services, API only) |
| `npm run test:services` | Test service connections only |
| `npm run test` | Full test suite with reports |
| `npm run test:verbose` | Full tests with detailed output |
| `npm run test:all` | Direct test runner (advanced) |

## Manual Test Scripts

```bash
# Make scripts executable (if needed)
chmod +x quick-test.sh
chmod +x tests/run-all-tests.js
chmod +x tests/health-check.js

# Run individual test categories
cd tests
node services/test-services.js      # Service connections
node api/test-api-endpoints.js      # API endpoints
node frontend/test-frontend.js      # Frontend functionality
node e2e/test-e2e.js                # End-to-end scenarios
node performance/test-performance.js # Performance tests
node error-handling/test-error-handling.js # Error handling
```

## Test Reports

After running tests, reports are generated in `tests/test-reports/`:
- **HTML Report**: `latest-report.html` (visual dashboard)
- **JSON Report**: `latest-report.json` (machine-readable)
- **Markdown Report**: `latest-report.md` (documentation)

## Prerequisites

1. **Services Running**: Ensure all services are up
   ```bash
   docker-compose up -d
   docker-compose ps  # Check status
   ```

2. **Node.js**: Version 16+ required
   ```bash
   node --version
   ```

3. **Test Dependencies**: Auto-installed on first run
   ```bash
   cd tests && npm install
   ```

## Test Categories

- **🔧 Services**: Database, Redis, MinIO, Ollama connectivity
- **🌐 API**: REST endpoints, authentication, file operations
- **🖥️ Frontend**: UI functionality, user interactions
- **🔄 E2E**: Complete user workflows and scenarios
- **⚡ Performance**: Response times, throughput, scalability
- **🛡️ Error Handling**: Resilience, error recovery, edge cases

## Troubleshooting

**Tests failing?**
1. Check service status: `docker-compose ps`
2. Check service logs: `docker-compose logs [service-name]`
3. Run health check: `npm run test:health`
4. Run with verbose output: `npm run test:verbose`

**Common issues:**
- Services not running → `docker-compose up -d`
- Port conflicts → Check port availability
- Permission errors → `chmod +x quick-test.sh`

## Documentation

See [`tests/README.md`](tests/README.md) for detailed documentation, including:
- Complete test suite overview
- Individual test category descriptions
- Configuration options
- Custom test development
- CI/CD integration examples

---

*Run `npm run test:health` first to ensure your system is ready for testing!*
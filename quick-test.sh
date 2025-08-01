#!/bin/bash

# Quick test setup and execution script for Whisper Local Deployment
# This script sets up the test environment and runs the tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if service is running
check_service() {
    local service=$1
    local port=$2
    if nc -z localhost $port 2>/dev/null; then
        print_success "$service is running on port $port"
        return 0
    else
        print_warning "$service is not accessible on port $port"
        return 1
    fi
}

print_status "🎙️ Whisper Local Deployment Test Setup"
echo "========================================"

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "Node.js and npm are available"

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_warning "Node.js version is $NODE_VERSION. Version 16+ is recommended."
else
    print_success "Node.js version is compatible ($NODE_VERSION)"
fi

# Navigate to tests directory
if [ ! -d "tests" ]; then
    print_error "Tests directory not found. Please run this script from the project root."
    exit 1
fi

cd tests

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing test dependencies..."
    npm install
    print_success "Dependencies installed"
else
    print_status "Dependencies already installed"
fi

# Check if main application is running
print_status "Checking Whisper application services..."

APP_RUNNING=false
POSTGRES_RUNNING=false
REDIS_RUNNING=false
MINIO_RUNNING=false
OLLAMA_RUNNING=false

if check_service "Whisper App" 3000; then
    APP_RUNNING=true
fi

if check_service "PostgreSQL" 5432; then
    POSTGRES_RUNNING=true
fi

if check_service "Redis" 6379; then
    REDIS_RUNNING=true
fi

if check_service "MinIO" 9000; then
    MINIO_RUNNING=true
fi

if check_service "Ollama" 11434; then
    OLLAMA_RUNNING=true
fi

# Count running services
SERVICES_COUNT=0
if [ "$APP_RUNNING" = true ]; then ((SERVICES_COUNT++)); fi
if [ "$POSTGRES_RUNNING" = true ]; then ((SERVICES_COUNT++)); fi
if [ "$REDIS_RUNNING" = true ]; then ((SERVICES_COUNT++)); fi
if [ "$MINIO_RUNNING" = true ]; then ((SERVICES_COUNT++)); fi
if [ "$OLLAMA_RUNNING" = true ]; then ((SERVICES_COUNT++)); fi

print_status "Services running: $SERVICES_COUNT/5"

if [ "$SERVICES_COUNT" -lt 3 ]; then
    print_warning "Many services are not running. Tests may fail."
    print_status "To start services, run: docker-compose up -d"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Exiting. Start services first and try again."
        exit 0
    fi
fi

# Parse command line arguments
SKIP_SERVICES=false
SKIP_API=false
SKIP_FRONTEND=false
SKIP_E2E=false
SKIP_PERFORMANCE=false
SKIP_ERROR_HANDLING=false
VERBOSE=false
QUICK_MODE=false
SERVICES_ONLY=false

for arg in "$@"; do
    case $arg in
        --skip-services)
            SKIP_SERVICES=true
            shift
            ;;
        --skip-api)
            SKIP_API=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-e2e)
            SKIP_E2E=true
            shift
            ;;
        --skip-performance)
            SKIP_PERFORMANCE=true
            shift
            ;;
        --skip-error-handling)
            SKIP_ERROR_HANDLING=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --quick)
            QUICK_MODE=true
            # In quick mode, skip longer tests
            SKIP_E2E=true
            SKIP_PERFORMANCE=true
            SKIP_ERROR_HANDLING=true
            shift
            ;;
        --services-only)
            SERVICES_ONLY=true
            # Only run service tests
            SKIP_API=true
            SKIP_FRONTEND=true
            SKIP_E2E=true
            SKIP_PERFORMANCE=true
            SKIP_ERROR_HANDLING=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-services       Skip service connection tests"
            echo "  --skip-api           Skip API endpoint tests"
            echo "  --skip-frontend      Skip frontend tests"
            echo "  --skip-e2e           Skip end-to-end tests"
            echo "  --skip-performance   Skip performance tests"
            echo "  --skip-error-handling Skip error handling tests"
            echo "  --verbose            Enable verbose output"
            echo "  --quick              Quick mode (skip slower tests)"
            echo "  --services-only      Only run service connection tests"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Run all tests"
            echo "  $0 --quick           # Quick test run"
            echo "  $0 --services-only   # Test only service connections"
            echo "  $0 --verbose         # Verbose output"
            exit 0
            ;;
        *)
            print_warning "Unknown argument: $arg"
            ;;
    esac
done

# Build command line arguments for the test runner
TEST_ARGS=""

if [ "$SKIP_SERVICES" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-services"
fi

if [ "$SKIP_API" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-api"
fi

if [ "$SKIP_FRONTEND" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-frontend"
fi

if [ "$SKIP_E2E" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-e2e"
fi

if [ "$SKIP_PERFORMANCE" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-performance"
fi

if [ "$SKIP_ERROR_HANDLING" = true ]; then
    TEST_ARGS="$TEST_ARGS --skip-error-handling"
fi

if [ "$VERBOSE" = true ]; then
    TEST_ARGS="$TEST_ARGS --verbose"
fi

# Show test configuration
print_status "Test Configuration:"
echo "  Services: $([ "$SKIP_SERVICES" = true ] && echo "SKIP" || echo "RUN")"
echo "  API: $([ "$SKIP_API" = true ] && echo "SKIP" || echo "RUN")"
echo "  Frontend: $([ "$SKIP_FRONTEND" = true ] && echo "SKIP" || echo "RUN")"
echo "  E2E: $([ "$SKIP_E2E" = true ] && echo "SKIP" || echo "RUN")"
echo "  Performance: $([ "$SKIP_PERFORMANCE" = true ] && echo "SKIP" || echo "RUN")"
echo "  Error Handling: $([ "$SKIP_ERROR_HANDLING" = true ] && echo "SKIP" || echo "RUN")"

if [ "$QUICK_MODE" = true ]; then
    print_status "Running in QUICK mode"
elif [ "$SERVICES_ONLY" = true ]; then
    print_status "Running SERVICES ONLY mode"
fi

echo ""

# Run the tests
print_status "🚀 Starting test execution..."
echo ""

if node run-all-tests.js $TEST_ARGS; then
    echo ""
    print_success "✅ All tests completed successfully!"
    
    # Show report locations
    if [ -f "test-reports/latest-report.html" ]; then
        print_status "📊 Test reports generated:"
        echo "  HTML: $(pwd)/test-reports/latest-report.html"
        echo "  JSON: $(pwd)/test-reports/latest-report.json"
        echo "  Markdown: $(pwd)/test-reports/latest-report.md"
        
        # Try to open HTML report in browser (Linux)
        if command_exists xdg-open; then
            print_status "Opening HTML report in browser..."
            xdg-open test-reports/latest-report.html 2>/dev/null || true
        fi
    fi
    
    echo ""
    print_success "🎉 Test run completed successfully!"
    exit 0
else
    echo ""
    print_error "❌ Some tests failed!"
    
    if [ -f "test-reports/latest-report.html" ]; then
        print_status "📊 Check the test reports for details:"
        echo "  HTML: $(pwd)/test-reports/latest-report.html"
        echo "  JSON: $(pwd)/test-reports/latest-report.json"
        echo "  Markdown: $(pwd)/test-reports/latest-report.md"
    fi
    
    echo ""
    print_status "💡 Troubleshooting tips:"
    echo "  1. Check if all services are running: docker-compose ps"
    echo "  2. Check service logs: docker-compose logs [service-name]"
    echo "  3. Verify configuration in config.js"
    echo "  4. Run with --verbose for detailed output"
    echo "  5. Run individual test categories to isolate issues"
    
    exit 1
fi
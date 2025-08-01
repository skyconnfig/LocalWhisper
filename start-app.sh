#!/bin/bash

# Start Whisper App with Local Storage
echo "🎙️ Starting Whisper App with Local Storage..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run ./setup-storage.sh first."
    exit 1
fi

# Start Docker services if not already running
echo "🐳 Ensuring Docker services are running..."
docker-compose up -d

# Wait a moment for services to be ready
sleep 5

# Check services
echo "🔍 Checking service health..."

# Check MinIO
if curl -f http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo "✅ MinIO is running"
else
    echo "⚠️ MinIO may not be ready yet"
fi

# Check Redis
if docker exec whisper-redis redis-cli -a redis123 ping >/dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️ Redis may not be ready yet"
fi

# Start the Next.js application
echo "🚀 Starting Next.js application..."
npm run dev
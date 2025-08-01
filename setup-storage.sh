#!/bin/bash

# Whisper Local Storage Setup Script
echo "🎙️ Setting up Whisper Local Storage Solution..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file from example if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update the configuration as needed."
else
    echo "✅ .env file already exists."
fi

# Create uploads directory for filesystem storage
mkdir -p uploads/temp
echo "📁 Created uploads directory structure."

# Start MinIO and Redis services
echo "🐳 Starting MinIO and Redis services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if MinIO is healthy
echo "🔍 Checking MinIO health..."
for i in {1..30}; do
    if curl -f http://localhost:9000/minio/health/live >/dev/null 2>&1; then
        echo "✅ MinIO is healthy!"
        break
    fi
    echo "Waiting for MinIO... (attempt $i/30)"
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis health..."
if docker exec whisper-redis redis-cli -a redis123 ping | grep -q PONG; then
    echo "✅ Redis is healthy!"
else
    echo "⚠️ Redis might not be ready, but continuing..."
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with the correct configuration"
echo "2. Start the development server: npm run dev"
echo "3. Access MinIO Console at: http://localhost:9001 (minioadmin/minioadmin123)"
echo "4. Your app will be available at: http://localhost:3000"
echo ""
echo "🔧 Useful commands:"
echo "- View logs: docker-compose logs -f"
echo "- Stop services: docker-compose down"
echo "- Restart services: docker-compose restart"
echo ""
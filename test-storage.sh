#!/bin/bash

# Test Local Storage Solution
echo "🧪 Testing Local Storage Solution..."

# Check if services are running
echo "📋 Checking service status..."

# Test MinIO health
echo -n "MinIO: "
if curl -f -s http://localhost:9000/minio/health/live >/dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not accessible"
fi

# Test Redis
echo -n "Redis: "
if docker exec whisper-redis redis-cli -a redis123 ping 2>/dev/null | grep -q PONG; then
    echo "✅ Running"
else
    echo "❌ Not accessible"
fi

# Test Next.js app
echo -n "Next.js App: "
if curl -f -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not accessible (may not be started yet)"
fi

echo ""
echo "📊 Service URLs:"
echo "- MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)"
echo "- Redis: localhost:6379"
echo "- Next.js App: http://localhost:3000"

echo ""
echo "🔧 Testing API endpoints..."

# Test file upload endpoint (requires authentication)
echo -n "Upload endpoint: "
if curl -f -s -X POST http://localhost:3000/api/s3-upload >/dev/null 2>&1; then
    echo "✅ Accessible"
else
    echo "⚠️ Requires authentication (expected)"
fi

# Test file management endpoint
echo -n "File management: "
if curl -f -s http://localhost:3000/api/files >/dev/null 2>&1; then
    echo "✅ Accessible"
else
    echo "⚠️ Requires authentication (expected)"
fi

# Test cleanup endpoint
echo -n "Cleanup endpoint: "
if curl -f -s http://localhost:3000/api/cleanup >/dev/null 2>&1; then
    echo "✅ Accessible"
else
    echo "⚠️ Requires authentication (expected)"
fi

echo ""
echo "📁 Checking filesystem structure..."

# Check if uploads directory exists
if [ -d "uploads" ]; then
    echo "✅ Uploads directory exists"
    if [ -d "uploads/temp" ]; then
        echo "✅ Temp directory exists"
    else
        echo "❌ Temp directory missing"
    fi
else
    echo "❌ Uploads directory missing"
fi

echo ""
echo "🐳 Docker services status:"
docker-compose ps

echo ""
echo "💾 Disk usage:"
df -h . | tail -1

echo ""
echo "📝 Configuration check:"
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    echo "📋 Storage strategy: $(grep STORAGE_STRATEGY .env | cut -d'=' -f2 || echo 'not set')"
    echo "📋 Max file size: $(grep MAX_FILE_SIZE .env | cut -d'=' -f2 || echo 'not set')"
else
    echo "❌ .env file missing - run ./setup-storage.sh"
fi

echo ""
echo "🎉 Test completed!"
echo ""
echo "💡 Next steps:"
echo "1. Start the app: npm run dev (or ./start-app.sh)"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Test file upload functionality"
echo "4. Check MinIO console at http://localhost:9001"
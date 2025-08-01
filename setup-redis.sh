#!/bin/bash

# Redis Migration and Setup Script
# This script helps migrate from Upstash Redis to local Redis

echo "🔄 Starting Redis migration process..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi

echo "✅ docker-compose is available"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cp .env.redis.example .env.local
    echo "✅ Created .env.local from .env.redis.example"
    echo "⚠️  Please review and update .env.local with your specific settings"
else
    echo "✅ .env.local already exists"
fi

# Install new dependencies
echo "📦 Installing Redis dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ Neither pnpm nor npm found. Please install one of them."
    exit 1
fi

echo "✅ Dependencies installed"

# Start Redis container
echo "🚀 Starting Redis container..."
docker-compose up -d redis

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 10

# Test Redis connection
echo "🧪 Testing Redis connection..."
if docker exec whisper_redis redis-cli -a redis123 ping > /dev/null 2>&1; then
    echo "✅ Redis is running and accessible"
else
    echo "❌ Redis connection failed"
    echo "📋 Redis container logs:"
    docker logs whisper_redis
    exit 1
fi

# Test Redis with Node.js
echo "🧪 Testing Redis with Node.js..."
cat > test-redis.js << 'EOF'
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'redis123',
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (error) => {
  console.error('❌ Redis error:', error);
  process.exit(1);
});

async function testRedis() {
  try {
    // Test basic operations
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    
    if (value === 'test-value') {
      console.log('✅ Redis read/write test passed');
    } else {
      console.log('❌ Redis read/write test failed');
      process.exit(1);
    }
    
    // Test rate limiting data structure (sorted set)
    const key = 'test-rate-limit';
    const now = Date.now();
    
    await redis.zadd(key, now, `request-${now}`);
    const count = await redis.zcard(key);
    
    if (count >= 1) {
      console.log('✅ Redis sorted set operations working');
    } else {
      console.log('❌ Redis sorted set operations failed');
      process.exit(1);
    }
    
    // Clean up
    await redis.del('test-key', key);
    console.log('✅ All Redis tests passed');
    
    redis.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
EOF

node test-redis.js
TEST_RESULT=$?

# Clean up test file
rm test-redis.js

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo "🎉 Redis migration completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Review your .env.local file and adjust settings as needed"
    echo "2. Start your application: npm run dev or pnpm dev"
    echo "3. Test the rate limiting functionality in your app"
    echo ""
    echo "📊 Redis container info:"
    echo "- Container name: whisper_redis"
    echo "- Port: 6379"
    echo "- Password: redis123"
    echo "- Dashboard: redis-cli -h localhost -p 6379 -a redis123"
    echo ""
    echo "🔧 Useful commands:"
    echo "- View Redis logs: docker logs whisper_redis"
    echo "- Connect to Redis CLI: docker exec -it whisper_redis redis-cli -a redis123"
    echo "- Stop Redis: docker-compose stop redis"
    echo "- Restart Redis: docker-compose restart redis"
else
    echo "❌ Redis tests failed. Please check the logs above."
    exit 1
fi
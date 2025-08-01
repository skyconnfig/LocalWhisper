# Redis Migration Guide: From Upstash to Local Redis

This guide explains the migration from Upstash Redis to a local Redis instance for rate limiting and caching.

## 📋 Migration Overview

The migration includes:
- Replacing `@upstash/redis` and `@upstash/ratelimit` with standard Redis clients
- Implementing custom rate limiting logic compatible with the existing API
- Setting up local Redis with Docker
- Maintaining backward compatibility with existing rate limiting functions

## 🔧 Files Modified

### 1. Package Dependencies (`/home/lixinsi/whisper/package.json`)
- **Removed**: `@upstash/redis`, `@upstash/ratelimit`
- **Added**: `redis`, `ioredis`

### 2. Redis Client Configuration (`/home/lixinsi/whisper/lib/redis.ts`)
- New file containing local Redis client setup
- Custom `LocalRateLimit` class that mimics `@upstash/ratelimit` API
- Automatic fallback when Redis is unavailable
- Connection management and error handling

### 3. Rate Limiting Logic (`/home/lixinsi/whisper/lib/limits.ts`)
- Updated imports to use local Redis client
- Replaced `Ratelimit` with `LocalRateLimit`
- Maintained existing API compatibility

### 4. Docker Configuration (`/home/lixinsi/whisper/docker-compose.yml`)
- Enhanced Redis service configuration
- Added memory management and persistence
- Improved health checks
- Performance optimizations

## 🚀 Quick Setup

1. **Run the setup script:**
   ```bash
   ./setup-redis.sh
   ```

2. **Or manual setup:**
   ```bash
   # Install dependencies
   pnpm install
   
   # Start Redis
   docker-compose up -d redis
   
   # Copy environment config
   cp .env.redis.example .env.local
   ```

## ⚙️ Configuration

### Environment Variables

Create or update your `.env.local` file:

```env
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123
REDIS_ENABLED=true

# Optional: Alternative URL format
# REDIS_URL=redis://:redis123@localhost:6379
```

### Docker Redis Service

The Redis container includes:
- **Image**: `redis:7-alpine`
- **Port**: `6379`
- **Password**: `redis123`
- **Persistence**: Enabled with AOF
- **Memory limit**: 256MB with LRU eviction
- **Health checks**: Every 30 seconds

## 🧪 Testing

### Test Redis Connection
```bash
# Using Docker CLI
docker exec -it whisper_redis redis-cli -a redis123 ping

# Using redis-cli (if installed locally)
redis-cli -h localhost -p 6379 -a redis123 ping
```

### Test Rate Limiting
The rate limiting functions maintain the same API:

```typescript
import { limitMinutes, limitTransformations } from './lib/limits';

// Test minutes limit
const result = await limitMinutes({
  clerkUserId: 'user123',
  minutes: 10
});

console.log('Rate limit result:', result);
// { success: boolean, remaining: number, limit: number, reset: Date | null }
```

## 🔄 API Compatibility

The migration maintains full API compatibility:

| Function | Input | Output | Status |
|----------|-------|--------|---------|
| `limitMinutes()` | `{ clerkUserId, isBringingKey, minutes }` | `RateLimitResult` | ✅ Compatible |
| `getMinutes()` | `{ clerkUserId, isBringingKey }` | `RateLimitResult` | ✅ Compatible |
| `limitTransformations()` | `{ clerkUserId, isBringingKey }` | `RateLimitResult` | ✅ Compatible |
| `getTransformations()` | `{ clerkUserId, isBringingKey }` | `RateLimitResult` | ✅ Compatible |

## 🛠️ Troubleshooting

### Redis Connection Issues
```bash
# Check Redis container status
docker ps | grep redis

# View Redis logs
docker logs whisper_redis

# Restart Redis
docker-compose restart redis
```

### Rate Limiting Issues
- **Development Mode**: Rate limiting is disabled by default in development
- **Redis Unavailable**: Functions fall back to default limits
- **Memory Issues**: Check Redis memory usage and adjust `maxmemory` setting

### Performance Monitoring
```bash
# Monitor Redis operations
docker exec -it whisper_redis redis-cli -a redis123 monitor

# Check Redis info
docker exec -it whisper_redis redis-cli -a redis123 info
```

## 📊 Redis Data Structure

Rate limiting uses Redis sorted sets:

```
Key Pattern: "{prefix}:{userId}"
Value: Timestamp-based entries
TTL: Matches the rate limit window (24 hours default)

Example:
minutes-limiter:user123 -> [(timestamp1, "request1"), (timestamp2, "request2")]
```

## 🔒 Security Considerations

- Redis password authentication enabled
- Network isolation via Docker networks
- Memory limits to prevent resource exhaustion
- Connection timeouts and retry logic

## 📈 Performance Benefits

- **Local Redis**: Reduced latency compared to external service
- **Connection pooling**: Efficient connection management
- **Memory optimization**: LRU eviction policy
- **Persistence**: AOF for data durability

## 🌟 Migration Benefits

1. **Cost**: No external Redis service fees
2. **Performance**: Local Redis with lower latency
3. **Control**: Full control over Redis configuration
4. **Development**: Easier local development setup
5. **Reliability**: No dependency on external services
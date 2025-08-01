import Redis from "ioredis";

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || "redis123",
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Create Redis client instance
let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  // In local development, skip Redis if not available
  if (process.env.NODE_ENV !== "production" && !process.env.REDIS_ENABLED) {
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(redisConfig);
      
      redis.on("error", (error) => {
        console.error("Redis connection error:", error);
      });

      redis.on("connect", () => {
        console.log("Connected to Redis");
      });

      redis.on("ready", () => {
        console.log("Redis client ready");
      });

      redis.on("close", () => {
        console.log("Redis connection closed");
      });

    } catch (error) {
      console.error("Failed to create Redis client:", error);
      return null;
    }
  }

  return redis;
}

// Simple rate limiter implementation
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: Date | null;
}

export class LocalRateLimit {
  private redis: Redis | null;
  private prefix: string;
  private limit: number;
  private window: number; // in milliseconds

  constructor(options: {
    redis?: Redis | null;
    prefix: string;
    limit: number;
    window: string; // e.g., "1440 m" for 1440 minutes
  }) {
    this.redis = options.redis || null;
    this.prefix = options.prefix;
    this.limit = options.limit;
    this.window = this.parseWindow(options.window);
  }

  private parseWindow(window: string): number {
    const match = window.match(/(\d+)\s*([smhd])/);
    if (!match) return 24 * 60 * 60 * 1000; // default 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value * 60 * 1000; // default to minutes
    }
  }

  async limit(identifier: string, options?: { rate?: number }): Promise<RateLimitResult> {
    const currentLimit = options?.rate || this.limit;
    
    if (!this.redis) {
      // Fallback when Redis is not available
      return {
        success: true,
        remaining: currentLimit,
        limit: currentLimit,
        reset: null,
      };
    }

    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.window;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove expired entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Count current requests in window
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(this.window / 1000));
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error("Pipeline execution failed");
      }

      const count = (results[1][1] as number) + 1; // +1 for the current request
      const success = count <= currentLimit;
      const remaining = Math.max(0, currentLimit - count);
      const reset = new Date(now + this.window);

      if (!success) {
        // Remove the request we just added if limit exceeded
        await this.redis.zrem(key, `${now}-${Math.random()}`);
      }

      return {
        success,
        remaining,
        limit: currentLimit,
        reset,
      };

    } catch (error) {
      console.error("Rate limit check failed:", error);
      // Fallback to allow request if Redis fails
      return {
        success: true,
        remaining: currentLimit,
        limit: currentLimit,
        reset: null,
      };
    }
  }

  async getRemaining(identifier: string): Promise<RateLimitResult> {
    if (!this.redis) {
      return {
        success: true,
        remaining: this.limit,
        limit: this.limit,
        reset: null,
      };
    }

    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.window;

    try {
      // Remove expired entries and count current
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zcard(key);
      
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error("Pipeline execution failed");
      }

      const count = results[1][1] as number;
      const remaining = Math.max(0, this.limit - count);
      const reset = new Date(now + this.window);

      return {
        success: remaining > 0,
        remaining,
        limit: this.limit,
        reset,
      };

    } catch (error) {
      console.error("Get remaining failed:", error);
      return {
        success: true,
        remaining: this.limit,
        limit: this.limit,
        reset: null,
      };
    }
  }
}

// Export a singleton instance
export const redisClient = getRedisClient();
# Whisper App 配置选项说明

本文档详细说明了 Whisper App 的所有配置选项，帮助用户和管理员根据需求定制系统行为。

## 📋 目录

1. [环境变量配置](#环境变量配置)
2. [应用配置](#应用配置)
3. [数据库配置](#数据库配置)
4. [AI服务配置](#AI服务配置)
5. [存储配置](#存储配置)
6. [安全配置](#安全配置)
7. [性能配置](#性能配置)
8. [日志配置](#日志配置)

## 🔧 环境变量配置

### 核心配置

```bash
# 应用基础配置
NODE_ENV=production                    # 运行环境: development, production
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # 应用访问URL
PORT=3000                             # 应用端口
HOSTNAME=0.0.0.0                      # 绑定地址

# 数据库连接
DATABASE_URL="postgresql://whisper_user:password@localhost:5432/whisper_db"

# Redis缓存
REDIS_URL="redis://:password@localhost:6379"

# NextAuth认证
NEXTAUTH_SECRET="your-secret-key-32-chars-minimum"
NEXTAUTH_URL="http://localhost:3000"
```

### AI服务配置

```bash
# Ollama服务
OLLAMA_BASE_URL="http://localhost:11434"
LOCAL_WHISPER_ENABLED=true
LOCAL_LLM_ENABLED=true
WHISPER_MODEL="whisper:latest"
LOCAL_LLM_MODEL="llama3.1:8b"

# AI处理超时和限制
LLM_TIMEOUT=300000                    # 5分钟超时
MAX_PROMPT_LENGTH=8000                # 最大提示长度
AI_CONCURRENCY_LIMIT=3                # 并发AI任务限制
```

### 存储配置

```bash
# MinIO对象存储
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_REGION="us-east-1"
MINIO_BUCKET_NAME="audio-files"
MINIO_TEMP_BUCKET_NAME="temp-files"

# 存储策略
STORAGE_STRATEGY="minio"              # local, minio, s3
MAX_FILE_SIZE="100MB"                 # 最大文件大小
ALLOWED_AUDIO_FORMATS="mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4"
```

## ⚙️ 应用配置

### 文件处理设置

| 配置项 | 默认值 | 说明 | 可选值 |
|--------|--------|------|--------|
| `MAX_FILE_SIZE` | 100MB | 单文件最大大小 | 1MB-1GB |
| `TEMP_FILE_CLEANUP_INTERVAL` | 3600000 | 临时文件清理间隔(ms) | 300000-86400000 |
| `AUTO_DELETE_AFTER_DAYS` | 30 | 自动删除文件天数 | 1-365 |
| `MAX_CONCURRENT_UPLOADS` | 5 | 最大并发上传数 | 1-20 |

```bash
# 文件处理配置示例
MAX_FILE_SIZE="200MB"
TEMP_FILE_CLEANUP_INTERVAL="1800000"   # 30分钟
AUTO_DELETE_AFTER_DAYS="60"
MAX_CONCURRENT_UPLOADS="10"
```

### 用户限制设置

```bash
# 用户使用限制
MONTHLY_MINUTES_LIMIT=100             # 每月转录分钟限制
RATE_LIMIT_REQUESTS_PER_HOUR=100      # 每小时请求限制
MAX_TRANSFORMATIONS_PER_DAY=50        # 每日AI处理限制
MAX_STORED_WHISPERS=1000              # 最大存储转录数量
```

### 界面和体验设置

```bash
# 前端配置
NEXT_PUBLIC_APP_NAME="Whisper App"     # 应用名称
NEXT_PUBLIC_SUPPORT_EMAIL="support@example.com"  # 支持邮箱
NEXT_PUBLIC_MAX_DISPLAY_TRANSCRIPTIONS=50  # 列表页最大显示数量
NEXT_PUBLIC_DEFAULT_LANGUAGE="zh"      # 默认界面语言
NEXT_PUBLIC_THEME="auto"               # 默认主题: light, dark, auto
```

## 🗄️ 数据库配置

### PostgreSQL设置

```bash
# 基础连接配置
DATABASE_URL="postgresql://username:password@host:port/database"
DATABASE_POOL_SIZE=20                  # 连接池大小
DATABASE_TIMEOUT=30000                 # 连接超时(ms)
DATABASE_SSL=false                     # 是否启用SSL

# 性能优化配置
DATABASE_STATEMENT_TIMEOUT=30000       # 语句执行超时
DATABASE_QUERY_TIMEOUT=15000          # 查询超时
DATABASE_POOL_TIMEOUT=10000           # 连接池获取超时
```

### Prisma配置

```javascript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../lib/generated/prisma"
  binaryTargets = ["native", "linux-musl"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // 连接池配置
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

### 数据库性能参数

```sql
-- postgresql.conf 优化建议
shared_buffers = 256MB                 -- 共享缓冲区
effective_cache_size = 1GB             -- 有效缓存大小
maintenance_work_mem = 64MB            -- 维护操作内存
wal_buffers = 16MB                     -- WAL缓冲区
checkpoint_completion_target = 0.9     -- 检查点完成目标
random_page_cost = 1.1                -- 随机页面代价
max_connections = 100                  -- 最大连接数
```

## 🤖 AI服务配置

### Whisper模型配置

```bash
# 模型选择
WHISPER_MODEL="whisper:base"           # tiny, base, small, medium, large-v3
WHISPER_LANGUAGE="auto"                # 默认转录语言
WHISPER_TASK="transcribe"              # transcribe, translate
WHISPER_TEMPERATURE=0.1                # 温度参数(0-1)

# 质量和性能平衡
WHISPER_NO_SPEECH_THRESHOLD=0.6        # 静音检测阈值
WHISPER_LOGPROB_THRESHOLD=-1.0         # 置信度阈值
WHISPER_COMPRESSION_RATIO_THRESHOLD=2.4 # 压缩比阈值
```

### LLM模型配置

```bash
# 模型选择和参数
LOCAL_LLM_MODEL="llama3.1:8b"         # 默认LLM模型
LLM_TEMPERATURE=0.7                    # 创造性参数
LLM_TOP_P=0.9                         # Top-p采样
LLM_MAX_TOKENS=2000                    # 最大输出长度
LLM_CONTEXT_LENGTH=4096                # 上下文长度

# 性能优化
LLM_BATCH_SIZE=512                     # 批处理大小
LLM_NUM_THREAD=4                       # CPU线程数
LLM_NUM_GPU_LAYERS=33                  # GPU层数(如果支持)
```

### 模型缓存配置

```bash
# 模型缓存策略
MODEL_CACHE_SIZE=5                     # 缓存模型数量
MODEL_CACHE_TTL=3600                   # 缓存生存时间(秒)
MODEL_PRELOAD=true                     # 启动时预加载模型
MODEL_OFFLOAD_DELAY=300                # 模型卸载延迟(秒)
```

## 💾 存储配置

### 本地存储配置

```bash
# 本地文件存储
LOCAL_STORAGE_PATH="/app/public/uploads"
LOCAL_STORAGE_MAX_SIZE="10GB"          # 本地存储总大小限制
LOCAL_STORAGE_CLEANUP_ENABLED=true     # 自动清理
LOCAL_STORAGE_PERMISSIONS=755          # 文件权限
```

### MinIO配置

```bash
# MinIO服务配置
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_REGION="us-east-1"
MINIO_BUCKET_NAME="audio-files"
MINIO_TEMP_BUCKET_NAME="temp-files"

# MinIO高级配置
MINIO_USE_SSL=false                    # 是否使用HTTPS
MINIO_PART_SIZE=5242880               # 分片大小(5MB)
MINIO_MAX_PARTS=1000                  # 最大分片数
MINIO_PRESIGNED_URL_EXPIRY=3600       # 预签名URL过期时间
```

### S3兼容存储配置

```bash
# AWS S3或兼容服务
S3_ENDPOINT="https://s3.amazonaws.com"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_REGION="us-west-2"
S3_BUCKET_NAME="my-whisper-bucket"

# S3高级配置
S3_FORCE_PATH_STYLE=false             # 路径风格
S3_SIGNATURE_VERSION="v4"             # 签名版本
S3_MAX_ATTEMPTS=3                     # 最大重试次数
```

## 🔒 安全配置

### 认证安全

```bash
# NextAuth.js安全配置
NEXTAUTH_SECRET="very-long-random-string-32-chars-minimum"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SESSION_MAXAGE=604800         # 7天会话有效期
NEXTAUTH_SESSION_UPDATE_AGE=86400      # 1天会话更新间隔

# JWT配置
JWT_SIGNING_KEY="your-jwt-signing-key"
JWT_ENCRYPTION_KEY="your-jwt-encryption-key"
JWT_ISSUER="whisper-app"
JWT_AUDIENCE="whisper-users"
```

### API安全

```bash
# API访问控制
API_RATE_LIMIT_ENABLED=true            # 启用API限流
API_RATE_LIMIT_WINDOW=3600000         # 限流窗口(1小时)
API_RATE_LIMIT_MAX=1000               # 窗口内最大请求数
CLEANUP_API_KEY="strong-cleanup-key"   # 清理API密钥

# CORS配置
CORS_ORIGIN="http://localhost:3000"    # 允许的源
CORS_METHODS="GET,POST,PUT,DELETE"     # 允许的方法
CORS_CREDENTIALS=true                  # 允许凭据
```

### 数据加密

```bash
# 数据库加密
DATABASE_ENCRYPTION_KEY="32-char-encryption-key"
ENCRYPT_SENSITIVE_FIELDS=true         # 加密敏感字段

# 文件加密
FILE_ENCRYPTION_ENABLED=false         # 文件存储加密
FILE_ENCRYPTION_ALGORITHM="aes-256-gcm"
FILE_ENCRYPTION_KEY="file-encryption-key"
```

## ⚡ 性能配置

### 缓存策略

```bash
# Redis缓存配置
REDIS_URL="redis://:password@localhost:6379"
REDIS_PREFIX="whisper:"               # 键前缀
REDIS_DEFAULT_TTL=3600                # 默认过期时间(秒)
REDIS_MAX_MEMORY="256mb"              # 最大内存使用

# 缓存分层配置
ENABLE_MEMORY_CACHE=true              # 启用内存缓存
MEMORY_CACHE_SIZE=100                 # 内存缓存条目数
MEMORY_CACHE_TTL=300                  # 内存缓存TTL(秒)
```

### 并发和队列

```bash
# 任务队列配置
TASK_QUEUE_ENABLED=true               # 启用任务队列
MAX_CONCURRENT_TRANSCRIPTIONS=3       # 最大并发转录数  
MAX_CONCURRENT_AI_TASKS=2             # 最大并发AI任务数
QUEUE_RETRY_ATTEMPTS=3                # 任务重试次数
QUEUE_RETRY_DELAY=5000                # 重试延迟(ms)

# 请求处理
MAX_REQUEST_SIZE="110mb"              # 最大请求大小
REQUEST_TIMEOUT=120000                # 请求超时(ms)
KEEP_ALIVE_TIMEOUT=65000              # Keep-Alive超时
```

### 资源限制

```bash
# 内存使用限制
NODE_MAX_MEMORY=4096                  # Node.js最大内存(MB)
V8_MAX_OLD_SPACE_SIZE=4096           # V8最大堆内存(MB)

# CPU使用配置
UV_THREADPOOL_SIZE=16                 # libuv线程池大小
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
```

## 📝 日志配置

### 日志级别和格式

```bash
# 日志配置
LOG_LEVEL="info"                      # trace, debug, info, warn, error
LOG_FORMAT="json"                     # json, pretty, simple
LOG_TIMESTAMP=true                    # 包含时间戳
LOG_CALLER=false                      # 包含调用者信息

# 日志输出
LOG_TO_FILE=true                      # 输出到文件
LOG_FILE_PATH="/var/log/whisper/app.log"
LOG_FILE_MAX_SIZE="50MB"              # 单文件最大大小
LOG_FILE_MAX_FILES=5                  # 保留文件数量
```

### 特定组件日志

```bash
# 数据库日志
DATABASE_LOG_LEVEL="warn"            # 数据库日志级别
DATABASE_LOG_QUERIES=false           # 记录查询语句

# AI服务日志
AI_LOG_LEVEL="info"                   # AI服务日志级别
AI_LOG_REQUESTS=true                  # 记录AI请求
AI_LOG_RESPONSES=false                # 记录AI响应(可能很大)

# 性能日志
PERFORMANCE_LOG_ENABLED=true         # 启用性能日志
SLOW_QUERY_THRESHOLD=1000            # 慢查询阈值(ms)
```

## 🔧 Docker配置映射

### 环境文件映射

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env.local
      - .env.production
    environment:
      # 覆盖特定配置
      NODE_ENV: production
      LOG_LEVEL: info
```

### 配置文件挂载

```yaml
volumes:
  # 配置文件挂载
  - ./config/app.json:/app/config/app.json:ro
  - ./config/ai-models.json:/app/config/ai-models.json:ro
  - ./logs:/var/log/whisper
```

## 📊 监控和健康检查配置

```bash
# 健康检查配置
HEALTH_CHECK_ENABLED=true             # 启用健康检查
HEALTH_CHECK_INTERVAL=30000           # 检查间隔(ms)
HEALTH_CHECK_TIMEOUT=10000            # 检查超时(ms)
HEALTH_CHECK_RETRIES=3                # 失败重试次数

# 指标收集
METRICS_ENABLED=true                  # 启用指标收集
METRICS_PORT=9090                     # 指标端口
METRICS_PATH="/metrics"               # 指标路径
```

## 🔄 配置验证和测试

### 配置验证脚本

```bash
#!/bin/bash
# scripts/validate-config.sh

echo "验证Whisper App配置..."

# 检查必需环境变量
required_vars=(
    "DATABASE_URL"
    "REDIS_URL"
    "NEXTAUTH_SECRET"
    "OLLAMA_BASE_URL"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 缺少必需配置: $var"
        exit 1
    else
        echo "✅ $var 已配置"
    fi
done

# 测试服务连接
echo "测试数据库连接..."
docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db || exit 1

echo "测试Redis连接..."
docker exec whisper_redis redis-cli -a redis123 ping || exit 1

echo "测试MinIO连接..."
curl -f http://localhost:9000/minio/health/live || exit 1

echo "测试Ollama连接..."
curl -f http://localhost:11434/api/tags || exit 1

echo "✅ 所有配置验证通过！"
```

---

**这份配置文档为系统定制提供了全面的选项说明。** ⚙️

如需了解具体配置场景，请查看 [最佳实践建议](./BEST_PRACTICES.md) 或 [部署指南](../main/LOCAL_DEPLOYMENT_GUIDE.md)。
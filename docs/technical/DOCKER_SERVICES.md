# Whisper App Docker服务配置文档

本文档详细介绍了 Whisper App 的 Docker 容器化架构、服务配置和部署策略，帮助运维人员理解和管理整个服务栈。

## 📋 目录

1. [Docker架构概览](#Docker架构概览)
2. [服务配置详解](#服务配置详解)
3. [网络和卷管理](#网络和卷管理)
4. [环境变量配置](#环境变量配置)
5. [健康检查机制](#健康检查机制)
6. [资源限制和优化](#资源限制和优化)
7. [日志管理](#日志管理)
8. [备份和恢复](#备份和恢复)
9. [生产环境优化](#生产环境优化)

## 🐳 Docker架构概览

### 服务拓扑图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Network: whisper_network              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Next.js   │  │ PostgreSQL  │  │    Redis    │  │   MinIO     ││
│  │     App     │  │  Database   │  │   Cache     │  │  Storage    ││
│  │   :3000     │  │   :5432     │  │   :6379     │  │ :9000/:9001 ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Ollama    │  │ MinIO Init  │  │ Ollama Init │                │
│  │  AI Service │  │   Helper    │  │   Helper    │                │
│  │   :11434    │  │ (one-time)  │  │ (one-time)  │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 核心服务概览

| 服务名 | 镜像 | 端口 | 作用 | 依赖关系 |
|--------|------|------|------|----------|
| `app` | Custom Next.js | 3000 | Web应用 | postgres, redis, minio, ollama |
| `postgres` | postgres:16-alpine | 5432 | 主数据库 | 无 |
| `redis` | redis:7-alpine | 6379 | 缓存/会话 | 无 |
| `minio` | minio/minio:latest | 9000,9001 | 对象存储 | 无 |
| `ollama` | ollama/ollama:latest | 11434 | AI服务 | 无 |
| `minio_init` | minio/mc:latest | - | 存储初始化 | minio |
| `ollama_init` | ollama/ollama:latest | - | AI模型初始化 | ollama |

## ⚙️ 服务配置详解

### 1. Next.js 应用服务

```yaml
# docker-compose.yml
app:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: whisper_app
  restart: unless-stopped
  ports:
    - "3000:3000"
  environment:
    # 数据库连接
    DATABASE_URL: postgresql://whisper_user:whisper_password@postgres:5432/whisper_db
    
    # Redis缓存
    REDIS_URL: redis://:redis123@redis:6379
    
    # MinIO对象存储
    MINIO_ENDPOINT: http://minio:9000
    MINIO_ACCESS_KEY: minioadmin
    MINIO_SECRET_KEY: minioadmin123
    MINIO_REGION: us-east-1
    MINIO_BUCKET_NAME: audio-files
    MINIO_TEMP_BUCKET_NAME: temp-files
    STORAGE_STRATEGY: minio
    
    # 文件处理配置
    MAX_FILE_SIZE: 100MB
    ALLOWED_AUDIO_FORMATS: mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4
    TEMP_FILE_CLEANUP_INTERVAL: 3600000
    AUTO_DELETE_AFTER_DAYS: 30
    
    # 应用配置
    NODE_ENV: production
    NEXT_PUBLIC_BASE_URL: http://localhost:3000
    
    # AI服务配置
    OLLAMA_BASE_URL: http://ollama:11434
    LOCAL_WHISPER_ENABLED: true
    LOCAL_LLM_ENABLED: true
    
    # 性能配置
    NEXT_TELEMETRY_DISABLED: 1
  volumes:
    - app_uploads:/app/public/uploads
  networks:
    - whisper_network
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    minio:
      condition: service_healthy
    ollama:
      condition: service_started
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
```

**Dockerfile配置**:
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib/generated ./lib/generated

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 2. PostgreSQL 数据库服务

```yaml
postgres:
  image: postgres:16-alpine
  container_name: whisper_postgres
  restart: unless-stopped
  environment:
    POSTGRES_DB: whisper_db
    POSTGRES_USER: whisper_user
    POSTGRES_PASSWORD: whisper_password
    PGDATA: /var/lib/postgresql/data/pgdata
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./database/init:/docker-entrypoint-initdb.d
  networks:
    - whisper_network
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U whisper_user -d whisper_db"]
    interval: 10s
    timeout: 5s
    retries: 5
  command: >
    postgres 
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=64MB
    -c wal_buffers=16MB
    -c max_connections=100
    -c log_statement=all
    -c log_duration=on
```

**数据库初始化脚本**:
```bash
#!/bin/bash
# database/init/01-init.sh
set -e

echo "初始化数据库配置..."

# 创建扩展
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 启用UUID扩展
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- 启用全文搜索扩展
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    
    -- 创建应用专用角色（如果需要）
    -- CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
    -- GRANT CONNECT ON DATABASE whisper_db TO app_user;
EOSQL

echo "数据库初始化完成"
```

### 3. Redis 缓存服务

```yaml
redis:
  image: redis:7-alpine
  container_name: whisper_redis
  restart: unless-stopped
  command: >
    redis-server 
    --requirepass redis123
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --tcp-keepalive 300
    --timeout 0
    --save 900 1
    --save 300 10
    --save 60 10000
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  networks:
    - whisper_network
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "redis123", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
  sysctls:
    - net.core.somaxconn=65535
```

**Redis配置说明**:
- `--requirepass`: 设置密码保护
- `--appendonly yes`: 启用AOF持久化
- `--maxmemory 256mb`: 限制最大内存使用
- `--maxmemory-policy allkeys-lru`: 内存不足时的淘汰策略
- `--save`: RDB快照保存策略

### 4. MinIO 对象存储服务

```yaml
minio:
  image: minio/minio:latest
  container_name: whisper_minio
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
    MINIO_REGION: us-east-1
  ports:
    - "9000:9000"  # MinIO API
    - "9001:9001"  # MinIO Console
  volumes:
    - minio_data:/data
  networks:
    - whisper_network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3

# MinIO存储桶初始化
minio_init:
  image: minio/mc:latest
  container_name: whisper_minio_init
  depends_on:
    minio:
      condition: service_healthy
  entrypoint: >
    /bin/sh -c "
    echo 'Waiting for MinIO to be ready...';
    sleep 10;
    /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin123;
    /usr/bin/mc mb myminio/audio-files --ignore-existing;
    /usr/bin/mc mb myminio/temp-files --ignore-existing;
    /usr/bin/mc policy set public myminio/audio-files;
    /usr/bin/mc policy set public myminio/temp-files;
    echo 'MinIO buckets initialized successfully';
    exit 0;
    "
  networks:
    - whisper_network
```

### 5. Ollama AI 服务

```yaml
ollama:
  image: ollama/ollama:latest
  container_name: whisper_ollama
  restart: unless-stopped
  ports:
    - "11434:11434"
  environment:
    - OLLAMA_HOST=0.0.0.0
    - OLLAMA_ORIGINS=*
  volumes:
    - ollama_data:/root/.ollama
  networks:
    - whisper_network
  deploy:
    resources:
      limits:
        memory: 8G
      reservations:
        devices:
          - capabilities: [gpu]
            count: all
  # GPU支持配置（如果有NVIDIA GPU）
  # runtime: nvidia
  # environment:
  #   - NVIDIA_VISIBLE_DEVICES=all

# AI模型初始化
ollama_init:
  image: ollama/ollama:latest
  container_name: whisper_ollama_init
  depends_on:
    ollama:
      condition: service_started
  entrypoint: >
    /bin/sh -c "
    echo 'Waiting for Ollama to be ready...';
    sleep 30;
    echo 'Pulling Whisper model...';
    ollama pull whisper:latest || echo 'Whisper model pull failed or already exists';
    echo 'Pulling LLM model (llama3.1:8b)...';
    ollama pull llama3.1:8b || echo 'LLM model pull failed or already exists';
    echo 'Ollama models initialized successfully';
    exit 0;
    "
  environment:
    - OLLAMA_HOST=http://ollama:11434
  networks:
    - whisper_network
  volumes:
    - ollama_data:/root/.ollama
```

## 🌐 网络和卷管理

### 网络配置

```yaml
networks:
  whisper_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
    driver_opts:
      com.docker.network.bridge.name: br-whisper
      com.docker.network.bridge.enable_icc: "true"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

**网络特性**:
- 隔离的桥接网络
- 容器间可以通过服务名通信
- 自定义子网范围
- 启用容器间通信

### 数据卷配置

```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/whisper/data/postgres
  
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/whisper/data/redis
  
  minio_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/whisper/data/minio
  
  ollama_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/whisper/data/ollama
  
  app_uploads:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/whisper/data/uploads
```

**卷管理脚本**:
```bash
#!/bin/bash
# scripts/manage-volumes.sh

VOLUME_BASE="/opt/whisper/data"

# 创建卷目录
create_volumes() {
    echo "创建数据卷目录..."
    sudo mkdir -p "$VOLUME_BASE"/{postgres,redis,minio,ollama,uploads}
    sudo chown -R 1000:1000 "$VOLUME_BASE"
    sudo chmod -R 755 "$VOLUME_BASE"
    echo "数据卷目录创建完成"
}

# 备份卷数据
backup_volumes() {
    local backup_date=$(date +%Y%m%d_%H%M%S)
    local backup_dir="/backup/whisper_volumes_$backup_date"
    
    echo "备份数据卷到: $backup_dir"
    sudo mkdir -p "$backup_dir"
    
    # 停止服务
    docker-compose stop
    
    # 创建备份
    sudo cp -r "$VOLUME_BASE"/* "$backup_dir/"
    sudo tar -czf "$backup_dir.tar.gz" "$backup_dir"
    sudo rm -rf "$backup_dir"
    
    # 重启服务
    docker-compose start
    
    echo "备份完成: $backup_dir.tar.gz"
}

# 恢复卷数据
restore_volumes() {
    local backup_file=$1
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        echo "请指定有效的备份文件"
        return 1
    fi
    
    echo "从备份恢复数据卷: $backup_file"
    
    # 停止服务
    docker-compose stop
    
    # 备份当前数据
    sudo mv "$VOLUME_BASE" "$VOLUME_BASE.old.$(date +%Y%m%d_%H%M%S)"
    
    # 恢复数据
    sudo mkdir -p "$VOLUME_BASE"
    sudo tar -xzf "$backup_file" -C /tmp/
    sudo cp -r /tmp/whisper_volumes_*/* "$VOLUME_BASE/"
    sudo chown -R 1000:1000 "$VOLUME_BASE"
    
    # 重启服务
    docker-compose start
    
    echo "数据恢复完成"
}

case "$1" in
    "create") create_volumes ;;
    "backup") backup_volumes ;;
    "restore") restore_volumes "$2" ;;
    *) echo "用法: $0 [create|backup|restore <backup_file>]" ;;
esac
```

## 🔧 环境变量配置

### 生产环境配置

```bash
# config/env.production
# 数据库配置
DATABASE_URL="postgresql://whisper_user:STRONG_PASSWORD@postgres:5432/whisper_db"

# Redis配置
REDIS_URL="redis://:STRONG_REDIS_PASSWORD@redis:6379"

# MinIO配置
MINIO_ENDPOINT="http://minio:9000"
MINIO_ACCESS_KEY="STRONG_ACCESS_KEY"
MINIO_SECRET_KEY="VERY_STRONG_SECRET_KEY"
MINIO_REGION="us-east-1"
MINIO_BUCKET_NAME="audio-files"
MINIO_TEMP_BUCKET_NAME="temp-files"

# NextAuth配置
NEXTAUTH_SECRET="VERY_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
NEXTAUTH_URL="https://your-domain.com"

# AI服务配置
OLLAMA_BASE_URL="http://ollama:11434"
LOCAL_WHISPER_ENABLED=true
LOCAL_LLM_ENABLED=true

# 安全配置
CLEANUP_API_KEY="STRONG_CLEANUP_API_KEY"

# 性能配置
MAX_FILE_SIZE="200MB"
TEMP_FILE_CLEANUP_INTERVAL="1800000"
AUTO_DELETE_AFTER_DAYS="60"

# 监控配置
ENABLE_METRICS=true
LOG_LEVEL="info"
```

### 开发环境配置

```bash
# config/env.development
# 数据库配置
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"

# Redis配置
REDIS_URL="redis://:redis123@localhost:6379"

# MinIO配置
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"

# NextAuth配置
NEXTAUTH_SECRET="development-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# 调试配置
NODE_ENV="development"
ENABLE_DEBUG_LOGS=true
LOG_LEVEL="debug"

# 开发工具
NEXT_TELEMETRY_DISABLED=1
```

## 🏥 健康检查机制

### 应用健康检查

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMinIO(),
    checkOllama()
  ]);

  const overall = checks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy';

  return Response.json({
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      database: checks[0].status,
      redis: checks[1].status,
      minio: checks[2].status,
      ollama: checks[3].status
    },
    details: checks.reduce((acc, check) => {
      acc[check.service] = check.details;
      return acc;
    }, {} as Record<string, any>)
  });
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { service: 'database', status: 'healthy', details: { connected: true } };
  } catch (error) {
    return { 
      service: 'database', 
      status: 'unhealthy', 
      details: { error: error.message } 
    };
  }
}
```

### 自定义健康检查脚本

```bash
#!/bin/bash
# scripts/health-check.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务健康状态
check_service_health() {
    local service_name=$1
    local health_url=$2
    
    if curl -f -s "$health_url" > /dev/null; then
        echo -e "${GREEN}✓${NC} $service_name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is unhealthy"
        return 1
    fi
}

# 检查容器状态
check_container_status() {
    local container_name=$1
    local status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)
    
    case "$status" in
        "healthy")
            echo -e "${GREEN}✓${NC} $container_name is healthy"
            return 0
            ;;
        "unhealthy")
            echo -e "${RED}✗${NC} $container_name is unhealthy"
            return 1
            ;;
        "starting")
            echo -e "${YELLOW}⧗${NC} $container_name is starting"
            return 2
            ;;
        *)
            echo -e "${RED}✗${NC} $container_name status unknown"
            return 1
            ;;
    esac
}

echo "=== Whisper App 健康检查 ==="
echo

# 检查所有容器
containers=("whisper_app" "whisper_postgres" "whisper_redis" "whisper_minio" "whisper_ollama")
all_healthy=true

for container in "${containers[@]}"; do
    if ! check_container_status "$container"; then
        all_healthy=false
    fi
done

echo

# 检查应用接口
if check_service_health "Application API" "http://localhost:3000/api/health"; then
    # 检查各个服务组件
    response=$(curl -s "http://localhost:3000/api/health")
    
    db_status=$(echo "$response" | jq -r '.services.database')
    redis_status=$(echo "$response" | jq -r '.services.redis')
    minio_status=$(echo "$response" | jq -r '.services.minio')
    ollama_status=$(echo "$response" | jq -r '.services.ollama')
    
    echo "  - Database: $db_status"
    echo "  - Redis: $redis_status"
    echo "  - MinIO: $minio_status"
    echo "  - Ollama: $ollama_status"
else
    all_healthy=false
fi

echo

if $all_healthy; then
    echo -e "${GREEN}🎉 All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some services are unhealthy${NC}"
    exit 1
fi
```

## 📊 资源限制和优化

### 生产环境资源配置

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
      restart_policy:
        condition: on-failure
        max_attempts: 3
        delay: 10s
    
  postgres:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    
  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    
  minio:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    
  ollama:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 16G
        reservations:
          cpus: '2.0'
          memory: 8G
          devices:
            - capabilities: [gpu]
              count: all
```

### 性能监控脚本

```bash
#!/bin/bash
# scripts/monitor-resources.sh

echo "=== Whisper App 资源监控 ==="
echo

# 显示容器资源使用情况
echo "容器资源使用情况："
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo

# 显示主机资源使用情况
echo "主机资源使用情况："
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "内存: $(free -h | awk '/^Mem:/ {printf "%.1f/%.1fGB (%.1f%%)\n", $3/1024, $2/1024, $3*100/$2}')"
echo "磁盘: $(df -h / | awk 'NR==2 {printf "%s/%s (%s)\n", $3, $2, $5}')"

echo

# 检查GPU使用情况（如果有）
if command -v nvidia-smi &> /dev/null; then
    echo "GPU使用情况："
    nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits | \
    while IFS=, read -r name mem_used mem_total gpu_util; do
        echo "  $name: GPU $gpu_util%, Memory ${mem_used}MB/${mem_total}MB"
    done
fi

echo

# 检查Docker系统资源
echo "Docker系统信息："
docker system df

echo

# 显示活跃连接数
echo "网络连接统计："
netstat -an | grep :3000 | wc -l | xargs echo "端口3000连接数:"
netstat -an | grep :5432 | wc -l | xargs echo "PostgreSQL连接数:"
netstat -an | grep :6379 | wc -l | xargs echo "Redis连接数:"
```

## 📝 日志管理

### 日志配置

```yaml
# 日志驱动配置
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
    
  postgres:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
        
  redis:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 日志收集脚本

```bash
#!/bin/bash
# scripts/collect-logs.sh

LOG_DIR="/var/log/whisper"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建日志目录
mkdir -p "$LOG_DIR"

echo "收集Whisper App日志..."

# 收集各服务日志
services=("whisper_app" "whisper_postgres" "whisper_redis" "whisper_minio" "whisper_ollama")

for service in "${services[@]}"; do
    echo "收集 $service 日志..."
    docker logs "$service" --since 24h > "$LOG_DIR/${service}_${DATE}.log" 2>&1
done

# 收集系统日志
echo "收集系统日志..."
dmesg > "$LOG_DIR/dmesg_${DATE}.log"
journalctl --since "24 hours ago" > "$LOG_DIR/journal_${DATE}.log"

# 收集Docker事件
docker events --since 24h --until 1s > "$LOG_DIR/docker_events_${DATE}.log" &
EVENTS_PID=$!
sleep 1
kill $EVENTS_PID 2>/dev/null

# 打包日志
echo "打包日志文件..."
cd /var/log
tar -czf "whisper_logs_${DATE}.tar.gz" whisper/

echo "日志收集完成: /var/log/whisper_logs_${DATE}.tar.gz"

# 清理7天前的日志
find /var/log -name "whisper_logs_*.tar.gz" -mtime +7 -delete
```

## 💾 备份和恢复

### 自动备份脚本

```bash
#!/bin/bash
# scripts/backup-system.sh

BACKUP_BASE="/backup/whisper"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE/backup_$DATE"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "开始系统备份: $BACKUP_DIR"

# 1. 备份数据库
echo "备份数据库..."
docker exec whisper_postgres pg_dump -U whisper_user -d whisper_db --no-owner --no-privileges | gzip > "$BACKUP_DIR/database.sql.gz"

# 2. 备份Redis数据
echo "备份Redis数据..."
docker exec whisper_redis redis-cli -a redis123 --rdb /data/dump.rdb
docker cp whisper_redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# 3. 备份MinIO数据
echo "备份MinIO数据..."
docker exec whisper_minio tar -czf /tmp/minio_backup.tar.gz -C /data .
docker cp whisper_minio:/tmp/minio_backup.tar.gz "$BACKUP_DIR/"

# 4. 备份Ollama模型
echo "备份Ollama模型..."
docker exec whisper_ollama tar -czf /tmp/ollama_backup.tar.gz -C /root/.ollama .
docker cp whisper_ollama:/tmp/ollama_backup.tar.gz "$BACKUP_DIR/"

# 5. 备份配置文件
echo "备份配置文件..."
cp -r ./config "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"
cp .env.local "$BACKUP_DIR/"

# 6. 生成备份元数据
cat > "$BACKUP_DIR/backup_info.txt" << EOF
备份时间: $(date)
备份版本: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
Docker Compose版本: $(docker-compose --version)
备份大小: $(du -sh "$BACKUP_DIR" | cut -f1)
EOF

# 7. 压缩整个备份
echo "压缩备份..."
cd "$BACKUP_BASE"
tar -czf "whisper_backup_$DATE.tar.gz" "backup_$DATE"
rm -rf "backup_$DATE"

echo "备份完成: $BACKUP_BASE/whisper_backup_$DATE.tar.gz"

# 清理30天前的备份
find "$BACKUP_BASE" -name "whisper_backup_*.tar.gz" -mtime +30 -delete

# 发送备份通知（可选）
# echo "Whisper App backup completed: whisper_backup_$DATE.tar.gz" | mail -s "Backup Notification" admin@example.com
```

### 系统恢复脚本

```bash
#!/bin/bash
# scripts/restore-system.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "用法: $0 <backup_file.tar.gz>"
    exit 1
fi

echo "开始系统恢复: $BACKUP_FILE"

# 解压备份文件
TEMP_DIR="/tmp/whisper_restore_$(date +%s)"
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

RESTORE_DIR=$(find "$TEMP_DIR" -name "backup_*" -type d | head -1)

if [ -z "$RESTORE_DIR" ]; then
    echo "备份文件格式错误"
    exit 1
fi

# 停止所有服务
echo "停止服务..."
docker-compose down

# 1. 恢复数据库
echo "恢复数据库..."
docker-compose up -d postgres
sleep 10
gunzip -c "$RESTORE_DIR/database.sql.gz" | docker exec -i whisper_postgres psql -U whisper_user -d whisper_db

# 2. 恢复Redis数据
echo "恢复Redis数据..."
docker-compose up -d redis
sleep 5
docker cp "$RESTORE_DIR/redis.rdb" whisper_redis:/data/dump.rdb
docker-compose restart redis

# 3. 恢复MinIO数据
echo "恢复MinIO数据..."
docker-compose up -d minio
sleep 10
docker cp "$RESTORE_DIR/minio_backup.tar.gz" whisper_minio:/tmp/
docker exec whisper_minio tar -xzf /tmp/minio_backup.tar.gz -C /data

# 4. 恢复Ollama模型
echo "恢复Ollama模型..."
docker-compose up -d ollama
sleep 10
docker cp "$RESTORE_DIR/ollama_backup.tar.gz" whisper_ollama:/tmp/
docker exec whisper_ollama tar -xzf /tmp/ollama_backup.tar.gz -C /root/.ollama

# 5. 恢复配置文件
echo "恢复配置文件..."
cp -r "$RESTORE_DIR/config" ./
cp "$RESTORE_DIR/docker-compose.yml" ./
cp "$RESTORE_DIR/.env.local" ./

# 6. 启动所有服务
echo "启动所有服务..."
docker-compose up -d

# 7. 等待服务就绪
echo "等待服务启动..."
sleep 30

# 8. 验证恢复
echo "验证服务状态..."
./scripts/health-check.sh

# 清理临时文件
rm -rf "$TEMP_DIR"

echo "系统恢复完成！"
```

## 🚀 生产环境优化

### 安全加固配置

```yaml
# docker-compose.prod.yml
services:
  app:
    # 移除不必要的权限
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    
    # 只读根文件系统
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache
    
    # 非root用户运行
    user: "1001:1001"
    
    # 安全选项
    security_opt:
      - no-new-privileges:true
    
    # 限制系统调用
    sysctls:
      - net.ipv4.ip_unprivileged_port_start=0
```

### 监控和告警配置

```yaml
# 添加监控服务（可选）
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: whisper_prometheus
    ports:
      - "9090:9090"
    volumes:
      - "./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml"
      - prometheus_data:/prometheus
    networks:
      - whisper_network
  
  grafana:
    image: grafana/grafana:latest
    container_name: whisper_grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - whisper_network
```

### 性能调优参数

```bash
# 系统内核参数优化
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 20

# Docker daemon优化
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 5,
  "userland-proxy": false,
  "experimental": true
}
```

---

**这份Docker服务配置文档为系统的容器化部署提供了全面的指导。** 🐳

如需了解更多部署细节，请查看 [完整本地部署指南](../main/LOCAL_DEPLOYMENT_GUIDE.md) 或 [架构设计文档](./ARCHITECTURE.md)。
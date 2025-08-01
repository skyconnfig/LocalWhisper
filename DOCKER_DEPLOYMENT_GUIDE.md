# Docker 部署指南

本项目提供了完整的 Docker Compose 配置，支持开发和生产环境的一键部署。

## 快速开始

### 开发环境

```bash
# 启动开发环境
./docker-start.sh dev

# 或使用传统方式
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

### 生产环境

```bash
# 配置生产环境变量
cp .env.production.example .env.production
# 编辑 .env.production 填入真实配置

# 启动生产环境
./docker-start.sh prod

# 或使用传统方式
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 服务架构

### 核心服务

- **app**: Next.js 应用容器
- **postgres**: PostgreSQL 16 数据库
- **redis**: Redis 7 缓存服务
- **minio**: MinIO 对象存储服务
- **ollama**: Ollama AI 服务

### 初始化服务

- **minio_init**: 自动创建 MinIO 存储桶
- **ollama_init**: 自动下载 AI 模型

### 生产环境额外服务

- **nginx**: 反向代理和负载均衡
- **postgres_backup**: 自动数据库备份
- **watchtower**: 自动容器更新

## 端口映射

### 开发环境
- `3000`: Next.js 应用
- `5432`: PostgreSQL 数据库
- `6379`: Redis 缓存
- `9000`: MinIO API
- `9001`: MinIO 控制台
- `11434`: Ollama API

### 生产环境
- `80`: HTTP (重定向到 HTTPS)
- `443`: HTTPS 主应用
- 其他服务仅在内网访问

## 数据持久化

所有重要数据都通过 Docker 卷进行持久化存储：

```yaml
volumes:
  postgres_data:     # 数据库数据
  redis_data:        # Redis 缓存数据
  minio_data:        # 文件存储数据
  ollama_data:       # AI 模型文件
  app_uploads:       # 应用上传文件
```

## 环境变量配置

### 开发环境
复制并编辑 `.env.local.example` 为 `.env.local`

### 生产环境
复制并编辑 `.env.production.example` 为 `.env.production`

**重要**: 生产环境必须设置以下安全变量：
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `NEXTAUTH_SECRET`
- `MINIO_ROOT_PASSWORD`

## 常用命令

### 使用启动脚本 (推荐)

```bash
# 查看帮助
./docker-start.sh --help

# 启动开发环境
./docker-start.sh dev

# 启动生产环境
./docker-start.sh prod

# 停止所有服务
./docker-start.sh stop

# 重启服务
./docker-start.sh restart

# 查看日志
./docker-start.sh logs [service_name]

# 查看服务状态
./docker-start.sh status

# 备份数据
./docker-start.sh backup

# 清理容器和卷
./docker-start.sh clean --volumes
```

### 直接使用 Docker Compose

```bash
# 开发环境
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# 生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 查看日志
docker-compose logs -f [service_name]

# 重新构建
docker-compose up --build -d
```

## 健康检查

### 应用健康检查
访问 `http://localhost:3000/api/health` 查看应用状态

### 服务健康检查
```bash
# 检查所有服务状态
./docker-start.sh status

# 检查特定服务日志
./docker-start.sh logs app
./docker-start.sh logs postgres
```

## 数据备份与恢复

### 自动备份 (生产环境)
生产环境自动配置了数据库备份，备份文件存储在 `./database/backups/` 目录

### 手动备份
```bash
# 使用启动脚本
./docker-start.sh backup

# 手动备份数据库
docker-compose exec postgres pg_dump -U whisper_user whisper_db > backup.sql

# 手动备份 MinIO 数据
docker cp whisper_minio:/data ./minio-backup
```

### 恢复数据
```bash
# 恢复数据库
docker-compose exec -T postgres psql -U whisper_user whisper_db < backup.sql

# 恢复 MinIO 数据
docker cp ./minio-backup whisper_minio:/data
```

## 性能优化

### 生产环境优化
- 启用 Nginx gzip 压缩
- 配置静态文件缓存
- 设置服务资源限制
- 启用 Redis 持久化
- 配置数据库连接池

### 开发环境优化
- 启用热重载
- 使用轻量化 AI 模型
- 减少内存限制
- 简化日志级别

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep :3000
   
   # 停止冲突服务
   ./docker-start.sh stop
   ```

2. **权限问题**
   ```bash
   # 给脚本执行权限
   chmod +x docker-start.sh
   
   # 检查 Docker 权限
   sudo usermod -aG docker $USER
   ```

3. **磁盘空间不足**
   ```bash
   # 清理无用镜像和容器
   docker system prune -af
   
   # 清理无用卷
   docker volume prune -f
   ```

4. **服务启动失败**
   ```bash
   # 查看详细日志
   ./docker-start.sh logs
   
   # 重新构建镜像
   ./docker-start.sh dev --no-cache
   ```

### 日志查看
```bash
# 查看所有服务日志
./docker-start.sh logs

# 查看特定服务日志
./docker-start.sh logs app
./docker-start.sh logs postgres
./docker-start.sh logs redis
./docker-start.sh logs minio
./docker-start.sh logs ollama
```

## SSL/HTTPS 配置 (生产环境)

1. 获取 SSL 证书 (Let's Encrypt 推荐)
2. 将证书文件放置在 `./nginx/ssl/` 目录
3. 更新 `nginx/nginx.conf` 中的域名配置
4. 重启 Nginx 服务

```bash
# 重启 Nginx
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## 监控和维护

### 资源监控
```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h
docker system df
```

### 日志轮转
生产环境建议配置日志轮转，防止日志文件过大。

### 定期维护
- 定期清理旧的 Docker 镜像
- 定期备份重要数据
- 监控磁盘空间使用
- 更新容器镜像到最新版本

## 安全建议

1. **更改默认密码**: 所有服务的默认密码都应该在生产环境中更改
2. **网络隔离**: 生产环境只暴露必要的端口
3. **HTTPS**: 生产环境强制使用 HTTPS
4. **定期更新**: 定期更新容器镜像和依赖
5. **访问控制**: 配置防火墙和访问控制列表
6. **日志监控**: 配置日志监控和告警
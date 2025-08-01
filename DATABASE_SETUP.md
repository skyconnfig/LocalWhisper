# 本地 PostgreSQL 数据库配置指南

本指南将帮助您配置本地 PostgreSQL 数据库来替换云端数据库，包括 Docker 配置、数据迁移和测试数据创建。

## 📋 目录结构

```
whisper/
├── docker-compose.yml              # Docker 服务配置
├── .env.local                     # 本地环境变量
├── database/
│   └── init/
│       ├── 01-init.sh            # 数据库初始化脚本
│       └── 02-performance.sql    # 性能优化配置
└── scripts/
    ├── setup-local-db.sh         # 本地数据库设置脚本
    ├── migrate-db.sh             # 数据库迁移工具
    └── test-data.js              # 测试数据创建脚本
```

## 🚀 快速开始

### 1. 环境要求

- Docker 和 Docker Compose
- Node.js (版本 18+)
- npm 或 yarn

### 2. 启动本地数据库环境

```bash
# 运行设置脚本（推荐）
./scripts/setup-local-db.sh

# 或者手动启动服务
docker-compose up -d
```

### 3. 配置应用程序

确保 `.env.local` 文件包含正确的数据库连接信息：

```env
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"
```

### 4. 应用数据库架构

```bash
# 生成 Prisma 客户端并推送架构
npx prisma db push

# 可选：打开 Prisma Studio 查看数据
npm run studio
```

## 🔧 服务配置

### PostgreSQL
- **端口**: 5432
- **数据库**: whisper_db
- **用户名**: whisper_user
- **密码**: whisper_password
- **连接URL**: `postgresql://whisper_user:whisper_password@localhost:5432/whisper_db`

### Redis
- **端口**: 6379
- **密码**: redis123
- **连接URL**: `redis://:redis123@localhost:6379`

### MinIO
- **API端口**: 9000
- **控制台端口**: 9001
- **用户名**: minioadmin
- **密码**: minioadmin123
- **控制台**: http://localhost:9001

## 📊 数据迁移

### 从云端数据库迁移

```bash
# 方法1: 直接迁移
./scripts/migrate-db.sh migrate "postgresql://user:pass@host:5432/db"

# 方法2: 先备份再恢复
./scripts/migrate-db.sh backup "postgresql://user:pass@host:5432/db"
./scripts/migrate-db.sh restore backup_2024-01-01.sql
```

### 创建测试数据

```bash
# 创建测试数据
node scripts/test-data.js create

# 清理测试数据
node scripts/test-data.js clear
```

## 🛠️ 常用命令

### Docker 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs postgres
docker-compose logs redis
docker-compose logs minio

# 停止服务
docker-compose down

# 删除数据卷（谨慎使用）
docker-compose down -v
```

### 数据库操作

```bash
# 连接到 PostgreSQL
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db

# 查看数据库表
docker exec whisper_postgres psql -U whisper_user -d whisper_db -c "\dt"

# 重置本地数据库
./scripts/migrate-db.sh reset

# 比较架构差异
./scripts/migrate-db.sh schema-diff
```

### Prisma 操作

```bash
# 推送架构到数据库
npx prisma db push

# 生成 Prisma 客户端
npx prisma generate

# 打开 Prisma Studio
npx prisma studio

# 创建迁移文件
npx prisma migrate dev --name init
```

## 🔍 故障排除

### 数据库连接问题

1. 检查 Docker 服务是否运行：
   ```bash
   docker-compose ps
   ```

2. 检查数据库连接：
   ```bash
   docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db
   ```

3. 查看数据库日志：
   ```bash
   docker-compose logs postgres
   ```

### 端口冲突

如果默认端口被占用，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
services:
  postgres:
    ports:
      - "15432:5432"  # 使用不同的主机端口
```

然后更新 `.env.local` 中的连接URL：
```env
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:15432/whisper_db"
```

### 数据持久化

数据存储在 Docker 卷中，即使容器重启数据也会保留。如需完全清理数据：

```bash
docker-compose down -v
docker volume prune
```

## 📈 性能优化

数据库已配置了基本的性能优化设置，包括：

- 共享缓冲区: 256MB
- 有效缓存大小: 1GB
- 维护工作内存: 64MB
- WAL 缓冲区: 16MB

对于生产环境，建议根据服务器资源调整这些参数。

## 🔒 安全注意事项

- 默认密码仅用于开发环境
- 生产环境请使用强密码
- 考虑使用 SSL 连接
- 定期备份数据

## 📝 环境变量参考

完整的环境变量配置请参考 `.env.local` 文件，包括：

- 数据库连接配置
- Redis 缓存配置
- MinIO 对象存储配置
- NextAuth.js 认证配置
- 文件存储配置

## 🆘 获取帮助

如果遇到问题，请检查：

1. Docker 和 Docker Compose 版本
2. 端口是否被其他服务占用
3. 环境变量配置是否正确
4. 数据库服务日志信息
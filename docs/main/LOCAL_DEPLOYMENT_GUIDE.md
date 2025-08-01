# Whisper App 完整本地部署指南

本指南将详细介绍如何在本地环境中部署完整的 Whisper App 系统，包括所有必要的服务和配置。

## 📋 目录

1. [系统要求](#系统要求)
2. [预安装准备](#预安装准备)
3. [快速部署](#快速部署)
4. [详细部署步骤](#详细部署步骤)
5. [服务配置](#服务配置)
6. [环境变量配置](#环境变量配置)
7. [验证部署](#验证部署)
8. [常见问题](#常见问题)
9. [升级和维护](#升级和维护)

## 🖥️ 系统要求

### 最低配置要求
- **操作系统**: 
  - Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
  - macOS 11.0+
  - Windows 10/11 with WSL2
- **内存**: 8GB RAM
- **存储**: 20GB 可用空间
- **CPU**: 4核心处理器
- **网络**: 稳定的互联网连接（用于下载依赖）

### 推荐配置
- **内存**: 16GB+ RAM
- **存储**: 50GB+ SSD
- **CPU**: 8核心处理器
- **GPU**: NVIDIA GPU（可选，用于AI模型加速）

### 软件依赖
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18.0+
- **Python**: 3.8+
- **Git**: 2.0+

## 🛠️ 预安装准备

### 1. 安装 Docker 和 Docker Compose

#### Linux (Ubuntu/Debian)
```bash
# 更新包索引
sudo apt update

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加用户到docker组
sudo usermod -aG docker $USER
newgrp docker
```

#### macOS
```bash
# 使用Homebrew安装
brew install docker docker-compose

# 或下载Docker Desktop
# https://www.docker.com/products/docker-desktop
```

#### Windows WSL2
```bash
# 在WSL2中安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. 安装 Node.js 和 npm

#### 使用 Node Version Manager (推荐)
```bash
# 安装nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

#### 直接安装
```bash
# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18
```

### 3. 安装 Python 和 pip

```bash
# Linux
sudo apt update
sudo apt install python3 python3-pip python3-venv

# macOS
brew install python@3.11

# 验证安装
python3 --version
pip3 --version
```

### 4. 验证安装

```bash
# 验证Docker
docker --version
docker-compose --version

# 验证Node.js
node --version
npm --version

# 验证Python
python3 --version
pip3 --version
```

## 🚀 快速部署

如果您希望快速部署而不关心详细步骤，可以使用一键部署脚本：

```bash
# 1. 克隆项目
git clone <your-repository-url>
cd whisper

# 2. 运行一键部署脚本
chmod +x deploy.sh
./deploy.sh

# 3. 等待部署完成并访问应用
# 打开浏览器访问: http://localhost:3000
```

部署脚本将自动完成：
- ✅ 环境检查
- ✅ 依赖安装
- ✅ 配置文件生成
- ✅ Docker 服务启动
- ✅ 数据库初始化
- ✅ AI 模型下载
- ✅ 应用构建和启动
- ✅ 健康检查

## 📋 详细部署步骤

如果您希望了解部署的详细过程或需要自定义配置，请按照以下步骤操作：

### 步骤 1: 获取源代码

```bash
# 克隆项目
git clone <your-repository-url>
cd whisper

# 检查项目结构
ls -la
```

### 步骤 2: 环境配置

```bash
# 复制环境变量模板
cp config/env.template .env.local

# 编辑环境变量文件
nano .env.local
```

必要的环境变量配置：

```bash
# 数据库配置
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"

# Redis配置  
REDIS_URL="redis://:redis123@localhost:6379"

# MinIO对象存储配置
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_BUCKET_NAME="audio-files"
STORAGE_STRATEGY="minio"

# 本地AI服务配置
LOCAL_WHISPER_ENABLED=true
LOCAL_LLM_ENABLED=true
OLLAMA_BASE_URL="http://localhost:11434"

# NextAuth配置
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# 应用配置
NODE_ENV="production"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 步骤 3: 安装应用依赖

```bash
# 安装Node.js依赖
npm install

# 或使用pnpm (推荐)
npm install -g pnpm
pnpm install
```

### 步骤 4: 启动基础服务

```bash
# 启动Docker服务
docker-compose up -d postgres redis minio ollama

# 查看服务状态
docker-compose ps
```

### 步骤 5: 初始化数据库

```bash
# 推送数据库模式
npx prisma db push

# 生成Prisma客户端
npx prisma generate

# 可选：创建测试数据
node scripts/test-data.js create
```

### 步骤 6: 配置对象存储

MinIO 服务启动后，需要创建必要的存储桶：

```bash
# 等待MinIO服务完全启动
sleep 30

# 运行存储初始化脚本
./scripts/init-local-storage.js
```

或手动配置：
1. 访问 http://localhost:9001
2. 使用 `minioadmin` / `minioadmin123` 登录
3. 创建 `audio-files` 和 `temp-files` 存储桶

### 步骤 7: 下载AI模型

```bash
# 等待Ollama服务启动
sleep 60

# 下载Whisper模型
docker exec whisper_ollama ollama pull whisper:latest

# 下载LLM模型
docker exec whisper_ollama ollama pull llama3.1:8b

# 验证模型
docker exec whisper_ollama ollama list
```

### 步骤 8: 构建和启动应用

```bash
# 构建应用
npm run build

# 启动应用
npm start

# 或使用PM2进行生产部署
npm install -g pm2
pm2 start npm --name "whisper-app" -- start
```

### 步骤 9: 验证部署

```bash
# 检查应用健康状态
curl http://localhost:3000/api/health

# 检查各服务状态
./scripts/management/health-check.sh
```

## ⚙️ 服务配置

### PostgreSQL 数据库
- **端口**: 5432
- **数据库**: whisper_db
- **用户**: whisper_user
- **密码**: whisper_password
- **数据持久化**: Docker volume `postgres_data`

### Redis 缓存
- **端口**: 6379
- **密码**: redis123
- **最大内存**: 256MB
- **淘汰策略**: allkeys-lru

### MinIO 对象存储
- **API端口**: 9000
- **控制台端口**: 9001
- **访问密钥**: minioadmin
- **秘密密钥**: minioadmin123
- **数据持久化**: Docker volume `minio_data`

### Ollama AI 服务
- **端口**: 11434
- **模型存储**: Docker volume `ollama_data`
- **支持模型**: whisper, llama3.1:8b
- **GPU加速**: 可选配置

### Next.js 应用
- **端口**: 3000
- **环境**: production
- **文件上传**: Docker volume `app_uploads`

## 🔧 环境变量配置

### 必需变量

```bash
# 数据库连接
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"

# Redis连接
REDIS_URL="redis://:redis123@localhost:6379"

# NextAuth认证
NEXTAUTH_SECRET="your-very-secret-key-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

### 可选变量

```bash
# 文件处理配置
MAX_FILE_SIZE="100MB"
ALLOWED_AUDIO_FORMATS="mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4"
AUTO_DELETE_AFTER_DAYS="30"

# AI服务配置
WHISPER_MODEL="base"
LOCAL_LLM_MODEL="llama3.1:8b"

# 性能配置
TEMP_FILE_CLEANUP_INTERVAL="3600000"
```

### 高级配置

```bash
# 日志配置
LOG_LEVEL="info"
ENABLE_DEBUG_LOGS="false"

# 安全配置
CLEANUP_API_KEY="your-cleanup-api-key"
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="3600"

# 监控配置
ENABLE_METRICS="true"
METRICS_PORT="9090"
```

## ✅ 验证部署

### 1. 基础健康检查

```bash
# 检查所有Docker容器状态
docker-compose ps

# 应该看到所有服务都是 "Up" 状态：
# whisper_app        Up      0.0.0.0:3000->3000/tcp
# whisper_postgres   Up      0.0.0.0:5432->5432/tcp
# whisper_redis      Up      0.0.0.0:6379->6379/tcp
# whisper_minio      Up      0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
# whisper_ollama     Up      0.0.0.0:11434->11434/tcp
```

### 2. 服务连接测试

```bash
# 测试数据库连接
docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db

# 测试Redis连接
docker exec whisper_redis redis-cli -a redis123 ping

# 测试MinIO连接
curl -f http://localhost:9000/minio/health/live

# 测试Ollama连接
curl http://localhost:11434/api/tags
```

### 3. 应用功能测试

```bash
# 测试应用健康接口
curl http://localhost:3000/api/health

# 测试文件上传接口
curl -X POST http://localhost:3000/api/files

# 打开浏览器测试完整功能
open http://localhost:3000
```

### 4. AI服务测试

```bash
# 测试本地Whisper服务
node test-local-whisper.js

# 测试本地LLM服务
node scripts/test-local-llm.js
```

## 🔥 常见问题

### Docker 相关问题

**Q: Docker服务启动失败**
```bash
# 检查Docker是否正在运行
sudo systemctl status docker

# 重启Docker服务
sudo systemctl restart docker

# 检查Docker Compose版本
docker-compose --version
```

**Q: 容器内存不足**
```bash
# 增加Docker内存限制
# 编辑 /etc/docker/daemon.json
{
  "default-runtime": "runc",
  "default-ulimits": {
    "memlock": {
      "hard": -1,
      "soft": -1
    }
  }
}

# 重启Docker
sudo systemctl restart docker
```

### 端口冲突问题

**Q: 端口被占用**
```bash
# 查看端口占用情况
netstat -tlnp | grep :3000
netstat -tlnp | grep :5432

# 停止占用端口的进程
sudo kill -9 <PID>

# 或修改docker-compose.yml中的端口映射
```

### 数据库连接问题

**Q: 数据库连接失败**
```bash
# 检查数据库容器日志
docker-compose logs postgres

# 手动连接测试
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db

# 重置数据库
docker-compose down
docker volume rm whisper_postgres_data
docker-compose up -d postgres
```

### AI服务问题

**Q: AI模型下载失败**
```bash
# 手动下载模型
docker exec -it whisper_ollama bash
ollama pull whisper:latest
ollama pull llama3.1:8b

# 检查模型状态
ollama list
```

**Q: GPU加速不工作**
```bash
# 检查NVIDIA驱动
nvidia-smi

# 安装NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

## 🔄 升级和维护

### 日常维护

```bash
# 查看系统资源使用
docker stats

# 查看日志
docker-compose logs --tail=100 -f

# 清理未使用的资源
docker system prune -f
```

### 数据备份

```bash
# 数据库备份
./scripts/backup.sh create

# 恢复数据库
./scripts/backup.sh restore backup_2024-01-01.sql

# MinIO数据备份
docker exec whisper_minio mc mirror /data /backup/minio
```

### 升级应用

```bash
# 拉取最新代码
git pull origin main

# 更新依赖
pnpm install

# 应用数据库迁移
npx prisma db push

# 重新构建和启动
docker-compose build app
docker-compose up -d
```

### 监控和日志

```bash
# 实时监控服务状态
./scripts/management/health-check.sh continuous

# 查看应用日志
tail -f logs/app.log

# 查看部署日志
tail -f logs/deploy-$(date +%Y%m%d).log
```

## 🔗 访问地址

部署完成后，您可以访问以下服务：

| 服务 | 地址 | 描述 |
|------|------|------|
| 主应用 | http://localhost:3000 | Whisper App主界面 |
| MinIO控制台 | http://localhost:9001 | 对象存储管理界面 |
| Prisma Studio | `pnpm studio` | 数据库管理界面 |
| Ollama API | http://localhost:11434 | AI模型API接口 |

### 默认账号信息

- **MinIO**: minioadmin / minioadmin123
- **数据库**: whisper_user / whisper_password
- **Redis**: (密码: redis123)

## 📞 获取帮助

如果在部署过程中遇到问题：

1. 查看 [故障排除指南](./TROUBLESHOOTING_GUIDE.md)
2. 检查日志文件获取错误详情
3. 运行健康检查脚本诊断问题
4. 在GitHub Issues中提交问题

## 🔄 下一步

部署完成后，建议您：

1. 阅读 [快速开始教程](./QUICK_START_GUIDE.md) 了解基本使用
2. 查看 [功能使用指南](../user/FEATURES_GUIDE.md) 学习所有功能
3. 配置 [最佳实践](../user/BEST_PRACTICES.md) 优化性能
4. 设置定期备份和监控

---

**祝您使用愉快！** 🎉
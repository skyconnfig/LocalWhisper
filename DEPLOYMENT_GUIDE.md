# Whisper App 部署脚本使用指南

本目录包含完整的 Whisper App 本地部署自动化脚本，让您可以轻松设置和管理本地Whisper应用。

## 📁 脚本文件概览

### 主要脚本

| 脚本文件 | 描述 | 用途 |
|---------|------|------|
| `deploy.sh` | 一键部署脚本 | 完整的自动化部署流程 |
| `start.sh` | 主启动脚本 | 启动所有服务和应用 |
| `quick-start.sh` | 快速启动脚本 | 开发环境快速启动 |

### 配置文件

| 文件路径 | 描述 |
|---------|------|
| `config/env.development` | 开发环境配置 |
| `config/env.production` | 生产环境配置 |
| `config/env.template` | 环境变量模板 |

### 管理脚本

| 脚本路径 | 描述 |
|---------|------|
| `scripts/management/service-manager.sh` | 服务管理脚本 |
| `scripts/management/health-check.sh` | 健康检查脚本 |
| `scripts/management/ai-setup.sh` | AI模型配置脚本 |

## 🚀 快速开始

### 方式一：一键部署 (推荐)

```bash
# 下载项目并进入目录
cd whisper

# 运行一键部署脚本
./deploy.sh
```

这将自动完成：
- ✅ 环境检查和依赖安装
- ✅ 配置文件生成
- ✅ Docker服务启动
- ✅ 数据库初始化
- ✅ 应用构建和启动
- ✅ 健康检查

### 方式二：快速启动 (开发环境)

```bash
# 适用于已配置过的开发环境
./quick-start.sh
```

### 方式三：手动启动

```bash
# 1. 启动基础服务
./start.sh

# 2. 或者使用服务管理脚本
./scripts/management/service-manager.sh start
```

## ⚙️ 配置选项

### 环境配置

1. **开发环境** (默认)
   - 调试模式开启
   - 热重载支持
   - 宽松的性能限制

2. **生产环境**
   - 优化构建
   - 安全配置
   - 严格的性能限制

### 自定义配置

1. 复制环境变量模板：
```bash
cp config/env.template .env
```

2. 编辑 `.env` 文件，设置您的配置。

## 🛠️ 服务管理

### 基本操作

```bash
# 查看服务状态
./scripts/management/service-manager.sh status

# 启动所有服务
./scripts/management/service-manager.sh start

# 停止所有服务
./scripts/management/service-manager.sh stop

# 重启所有服务
./scripts/management/service-manager.sh restart
```

### 日志管理

```bash
# 查看所有日志
./scripts/management/service-manager.sh logs

# 查看特定服务日志
./scripts/management/service-manager.sh logs --service nextjs

# 实时跟踪日志
./scripts/management/service-manager.sh logs --follow
```

### 数据管理

```bash
# 创建数据备份
./scripts/management/service-manager.sh backup

# 恢复数据
./scripts/management/service-manager.sh restore backup_name

# 清理临时文件
./scripts/management/service-manager.sh cleanup
```

## 🤖 AI模型管理

### 查看可用模型

```bash
./scripts/management/ai-setup.sh list
```

### 安装模型

```bash
# 安装Whisper模型
./scripts/management/ai-setup.sh install --type whisper --model base

# 安装LLM模型
./scripts/management/ai-setup.sh install --type llm --model microsoft/DialoGPT-medium
```

### 交互式设置

```bash
./scripts/management/ai-setup.sh setup
```

## 🔍 健康检查

### 执行健康检查

```bash
# 一次性检查
./scripts/management/health-check.sh

# 持续监控模式
./scripts/management/health-check.sh continuous
```

### 检查项目

- ✅ Docker容器状态
- ✅ 数据库连接
- ✅ Redis连接
- ✅ 应用HTTP响应
- ✅ 端口占用情况
- ✅ 系统资源使用

## 📊 访问地址

部署成功后，您可以访问：

| 服务 | 地址 | 描述 |
|------|------|------|
| 主应用 | http://localhost:3000 | Whisper App 主界面 |
| MinIO控制台 | http://localhost:9001 | 对象存储管理 |
| Prisma Studio | 运行 `pnpm studio` | 数据库管理界面 |

默认登录信息：
- MinIO: `minioadmin` / `minioadmin123`

## 🔧 故障排除

### 常见问题

1. **Docker服务启动失败**
   ```bash
   # 检查Docker状态
   docker --version
   docker-compose --version
   
   # 重启Docker服务
   sudo systemctl restart docker
   ```

2. **端口被占用**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep :3000
   
   # 停止占用端口的进程
   sudo kill -9 <PID>
   ```

3. **依赖安装失败**
   ```bash
   # 清理缓存
   rm -rf node_modules
   pnpm install
   ```

4. **数据库连接失败**
   ```bash
   # 检查数据库状态
   docker-compose exec postgres pg_isready -U whisper_user -d whisper_db
   
   # 重启数据库服务
   docker-compose restart postgres
   ```

### 日志查看

```bash
# 查看部署日志
tail -f logs/deploy-*.log

# 查看应用日志
tail -f logs/app.log

# 查看健康检查日志
tail -f logs/health-check.log
```

## 📝 自定义和扩展

### 添加自定义脚本

1. 在 `scripts/` 目录下创建您的脚本
2. 设置执行权限：`chmod +x your-script.sh`
3. 在 `service-manager.sh` 中添加调用逻辑

### 修改环境配置

1. 编辑 `config/env.development` 或 `config/env.production`
2. 重启服务以应用更改

### 添加新的健康检查

1. 编辑 `scripts/management/health-check.sh`
2. 添加新的检查函数
3. 在 `run_health_checks()` 中调用

## 📋 系统要求

### 最低要求

- **操作系统**: Linux, macOS, Windows (with WSL)
- **内存**: 4GB RAM
- **磁盘**: 10GB 可用空间
- **CPU**: 2核心

### 软件依赖

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- Python 3.8+ (用于AI模型)

## 📞 支持

如果您遇到问题：

1. 查看日志文件获取详细错误信息
2. 运行健康检查脚本诊断问题
3. 检查常见问题解决方案
4. 在项目Issues中报告问题

## 🔄 更新

更新应用到最新版本：

```bash
./scripts/management/service-manager.sh update
```

这将：
- 📦 拉取最新代码
- 🔄 更新依赖
- 🗄️ 运行数据库迁移
- 🚀 重启服务

---

**享受使用 Whisper App！** 🎉
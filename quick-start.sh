#!/bin/bash

# Whisper App 开发快速启动脚本
# 用于开发环境的快速启动，跳过复杂的检查步骤

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${GREEN}🚀 Whisper App 快速启动${NC}"
echo ""

# 创建必要目录
mkdir -p logs .pids public/uploads

# 启动Docker服务
log_info "启动Docker服务..."
docker-compose up -d

# 等待服务就绪
log_info "等待服务就绪..."
sleep 15

# 检查依赖
if [ ! -d "node_modules" ]; then
    log_info "安装依赖..."
    pnpm install
fi

# 生成Prisma客户端
log_info "生成数据库客户端..."
pnpm prisma generate

# 推送数据库模式
log_info "同步数据库..."
pnpm prisma db push

# 初始化存储
if [ -f "scripts/init-local-storage.js" ]; then
    log_info "初始化存储..."
    node scripts/init-local-storage.js
fi

# 启动开发服务器
log_info "启动开发服务器..."
pnpm dev &
echo $! > .pids/nextjs.pid

# 等待应用启动
sleep 10

log_success "✅ 启动完成！"
echo ""
echo "访问地址:"
echo "  🌐 应用: http://localhost:3000"
echo "  📊 MinIO: http://localhost:9001"
echo ""
echo "管理命令:"
echo "  📋 状态: ./scripts/management/service-manager.sh status"
echo "  🛑 停止: ./scripts/management/service-manager.sh stop"
echo ""
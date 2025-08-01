#!/bin/bash

# Whisper App 主启动脚本
# 此脚本会自动检查依赖、设置环境、启动所有服务

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示欢迎信息
show_welcome() {
    echo -e "${GREEN}"
    echo "=========================================="
    echo "     Whisper App 本地部署启动器"
    echo "=========================================="
    echo -e "${NC}"
}

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="Linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    elif [[ "$OSTYPE" == "msys" ]]; then
        OS="Windows"
    else
        log_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    
    log_success "操作系统: $OS"
    
    # 检查可用内存 (至少4GB)
    if command -v free > /dev/null; then
        MEMORY_GB=$(free -g | awk 'NR==2{printf "%.1f", $2}')
        if (( $(echo "$MEMORY_GB < 4" | bc -l) )); then
            log_warning "系统内存不足4GB，可能影响性能"
        else
            log_success "系统内存: ${MEMORY_GB}GB"
        fi
    fi
    
    # 检查磁盘空间 (至少10GB)
    DISK_SPACE=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$DISK_SPACE" -lt 10 ]; then
        log_warning "磁盘可用空间不足10GB，可能影响使用"
    else
        log_success "磁盘可用空间: ${DISK_SPACE}GB"
    fi
}

# 检查Docker
check_docker() {
    log_info "检查Docker环境..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        log_info "安装指南: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行，请启动Docker服务"
        exit 1
    fi
    
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_success "Docker版本: $DOCKER_VERSION"
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装"
        exit 1
    fi
    
    COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_success "Docker Compose版本: $COMPOSE_VERSION"
}

# 检查Node.js和pnpm
check_nodejs() {
    log_info "检查Node.js环境..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_error "Node.js版本过低，需要18+，当前版本: $NODE_VERSION"
        exit 1
    fi
    
    log_success "Node.js版本: $NODE_VERSION"
    
    # 检查pnpm
    if ! command -v pnpm &> /dev/null; then
        log_info "pnpm未安装，正在安装..."
        npm install -g pnpm
    fi
    
    PNPM_VERSION=$(pnpm --version)
    log_success "pnpm版本: $PNPM_VERSION"
}

# 设置环境变量
setup_environment() {
    log_info "设置环境变量..."
    
    # 选择环境配置
    if [ -z "$WHISPER_ENV" ]; then
        echo "选择运行环境:"
        echo "1) 开发环境 (development)"
        echo "2) 生产环境 (production)"
        read -p "请输入选择 [1-2]: " env_choice
        
        case $env_choice in
            1)
                WHISPER_ENV="development"
                ;;
            2)
                WHISPER_ENV="production"
                ;;
            *)
                log_warning "无效选择，使用开发环境"
                WHISPER_ENV="development"
                ;;
        esac
    fi
    
    # 加载环境配置
    ENV_FILE="config/env.${WHISPER_ENV}"
    if [ -f "$ENV_FILE" ]; then
        log_info "加载环境配置: $ENV_FILE"
        source "$ENV_FILE"
    else
        log_warning "环境配置文件不存在: $ENV_FILE，使用默认配置"
        # 使用默认配置
        export DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"
        export REDIS_URL="redis://default:redis123@localhost:6379"
        export MINIO_ENDPOINT="localhost"
        export MINIO_PORT="9000"
        export MINIO_ACCESS_KEY="minioadmin"
        export MINIO_SECRET_KEY="minioadmin123"
        export NEXTAUTH_SECRET="your-secret-key-here"
        export NEXTAUTH_URL="http://localhost:3000"
    fi
    
    # 创建.env文件
    cat > .env << EOF
# 环境配置
NODE_ENV=${WHISPER_ENV}
WHISPER_ENV=${WHISPER_ENV}

# 数据库配置
DATABASE_URL=${DATABASE_URL}

# Redis配置
REDIS_URL=${REDIS_URL}

# MinIO对象存储配置
MINIO_ENDPOINT=${MINIO_ENDPOINT}
MINIO_PORT=${MINIO_PORT}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_USE_SSL=false
MINIO_BUCKET=audio-files

# NextAuth配置
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}

# AI服务配置
TOGETHER_API_KEY=${TOGETHER_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}

# 本地AI服务配置
LOCAL_LLM_ENABLED=${LOCAL_LLM_ENABLED:-true}
LOCAL_LLM_MODEL=${LOCAL_LLM_MODEL:-"microsoft/DialoGPT-medium"}
LOCAL_WHISPER_ENABLED=${LOCAL_WHISPER_ENABLED:-true}
LOCAL_WHISPER_MODEL=${LOCAL_WHISPER_MODEL:-"openai/whisper-base"}

# 应用配置
CLEANUP_API_KEY=${CLEANUP_API_KEY:-"default-cleanup-key"}
MAX_FILE_SIZE=${MAX_FILE_SIZE:-"100MB"}
EOF
    
    log_success "环境变量配置完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    if [ ! -f "package.json" ]; then
        log_error "未找到package.json文件"
        exit 1
    fi
    
    # 清理缓存
    if [ -d "node_modules" ]; then
        log_info "清理旧的依赖..."
        rm -rf node_modules
    fi
    
    # 安装依赖
    pnpm install
    
    # 生成Prisma客户端
    log_info "生成Prisma客户端..."
    pnpm prisma generate
    
    log_success "依赖安装完成"
}

# 启动Docker服务
start_docker_services() {
    log_info "启动Docker服务..."
    
    # 检查docker-compose.yml文件
    if [ ! -f "docker-compose.yml" ]; then
        log_error "未找到docker-compose.yml文件"
        exit 1
    fi
    
    # 停止现有服务
    docker-compose down --remove-orphans
    
    # 启动服务
    log_info "启动PostgreSQL、Redis和MinIO服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动完成..."
    sleep 30
    
    # 检查服务状态
    if ! docker-compose ps | grep -q "Up"; then
        log_error "Docker服务启动失败"
        docker-compose logs
        exit 1
    fi
    
    log_success "Docker服务启动成功"
}

# 下载AI模型
download_ai_models() {
    log_info "配置AI模型..."
    
    # 创建模型目录
    mkdir -p models/whisper
    mkdir -p models/llm
    
    # 检查是否启用本地AI模型
    if [ "${LOCAL_WHISPER_ENABLED:-true}" = "true" ]; then
        log_info "配置本地Whisper模型..."
        # 这里可以添加模型下载逻辑
        # 实际使用时会通过Python脚本动态下载
    fi
    
    if [ "${LOCAL_LLM_ENABLED:-true}" = "true" ]; then
        log_info "配置本地LLM模型..."
        # 这里可以添加模型下载逻辑
        # 实际使用时会通过Python脚本动态下载
    fi
    
    log_success "AI模型配置完成"
}

# 运行数据库迁移
run_database_migrations() {
    log_info "运行数据库迁移..."
    
    # 等待数据库就绪
    log_info "等待数据库连接就绪..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U whisper_user -d whisper_db; then
            break
        fi
        sleep 2
    done
    
    # 运行Prisma迁移
    pnpm prisma db push
    
    log_success "数据库迁移完成"
}

# 初始化存储
initialize_storage() {
    log_info "初始化存储配置..."
    
    # 运行存储初始化脚本
    if [ -f "scripts/init-local-storage.js" ]; then
        node scripts/init-local-storage.js
    fi
    
    log_success "存储初始化完成"
}

# 启动应用
start_application() {
    log_info "启动Whisper应用..."
    
    # 构建应用
    if [ "$WHISPER_ENV" = "production" ]; then
        log_info "构建生产版本..."
        pnpm build
        
        log_info "启动生产服务器..."
        pnpm start &
    else
        log_info "启动开发服务器..."
        pnpm dev &
    fi
    
    # 等待应用启动
    log_info "等待应用启动..."
    sleep 10
    
    # 检查应用是否正常运行
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "应用启动成功！"
        echo ""
        log_info "访问地址:"
        echo "  - 应用主页: http://localhost:3000"
        echo "  - MinIO控制台: http://localhost:9001 (用户名: minioadmin, 密码: minioadmin123)"
        echo "  - Prisma Studio: 运行 'pnpm studio' 查看数据库"
        echo ""
    else
        log_error "应用启动失败，请检查日志"
        exit 1
    fi
}

# 显示状态信息
show_status() {
    echo ""
    echo -e "${GREEN}=========================================="
    echo "           部署状态信息"
    echo -e "==========================================${NC}"
    
    echo ""
    echo "Docker服务状态:"
    docker-compose ps
    
    echo ""
    echo "应用进程:"
    if pgrep -f "next" > /dev/null; then
        echo "  ✓ Next.js应用正在运行"
    else
        echo "  ✗ Next.js应用未运行"
    fi
    
    echo ""
    echo "端口占用情况:"
    echo "  - 3000 (Next.js应用): $(netstat -tlnp 2>/dev/null | grep :3000 && echo '占用' || echo '空闲')"
    echo "  - 5432 (PostgreSQL): $(netstat -tlnp 2>/dev/null | grep :5432 && echo '占用' || echo '空闲')"
    echo "  - 6379 (Redis): $(netstat -tlnp 2>/dev/null | grep :6379 && echo '占用' || echo '空闲')"
    echo "  - 9000 (MinIO API): $(netstat -tlnp 2>/dev/null | grep :9000 && echo '占用' || echo '空闲')"
    echo "  - 9001 (MinIO Console): $(netstat -tlnp 2>/dev/null | grep :9001 && echo '占用' || echo '空闲')"
}

# 主函数
main() {
    show_welcome
    
    # 检查系统环境
    check_system_requirements
    check_docker
    check_nodejs
    
    # 设置环境
    setup_environment
    
    # 安装依赖
    install_dependencies
    
    # 启动服务
    start_docker_services
    
    # 配置AI模型
    download_ai_models
    
    # 数据库迁移
    run_database_migrations
    
    # 初始化存储
    initialize_storage
    
    # 启动应用
    start_application
    
    # 显示状态
    show_status
    
    log_success "Whisper应用部署完成！"
}

# 处理中断信号
trap 'log_warning "收到中断信号，正在清理..."; docker-compose down; exit 1' INT TERM

# 运行主函数
main "$@"
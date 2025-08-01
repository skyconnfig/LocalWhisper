#!/bin/bash

# Whisper App 一键部署脚本
# 完整的自动化部署流程，适用于全新环境和更新部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
DEPLOY_LOG="$PROJECT_ROOT/logs/deploy-$(date +%Y%m%d_%H%M%S).log"

# 创建日志目录
mkdir -p "$(dirname "$DEPLOY_LOG")"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$DEPLOY_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$DEPLOY_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$DEPLOY_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$DEPLOY_LOG"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [STEP] $1" >> "$DEPLOY_LOG"
}

# 显示横幅
show_banner() {
    clear
    echo -e "${CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    ██╗    ██╗██╗  ██╗██╗███████╗██████╗ ███████╗██████╗          ║
║    ██║    ██║██║  ██║██║██╔════╝██╔══██╗██╔════╝██╔══██╗         ║
║    ██║ █╗ ██║███████║██║███████╗██████╔╝█████╗  ██████╔╝         ║
║    ██║███╗██║██╔══██║██║╚════██║██╔═══╝ ██╔══╝  ██╔══██╗         ║
║    ╚███╔███╔╝██║  ██║██║███████║██║     ███████╗██║  ██║         ║
║     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝         ║
║                                                                  ║
║                     一键部署脚本 v1.0.0                          ║
║                  Automated deployment tool                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    echo -e "${GREEN}欢迎使用 Whisper App 一键部署工具！${NC}"
    echo "此脚本将自动完成以下步骤："
    echo "  1. 环境检查和依赖安装"
    echo "  2. 配置文件生成"
    echo "  3. Docker服务启动"
    echo "  4. 数据库初始化"
    echo "  5. 应用构建和启动"
    echo "  6. 健康检查"
    echo ""
}

# 检查运行权限
check_permissions() {
    log_step "检查运行权限"
    
    if [ "$EUID" -eq 0 ]; then
        log_warning "检测到以root用户运行，建议使用普通用户"
        read -p "是否继续? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            log_info "部署已取消"
            exit 0
        fi
    fi
    
    # 检查Docker权限
    if ! groups | grep -q docker; then
        log_warning "当前用户不在docker组中，可能需要sudo权限运行Docker命令"
    fi
    
    log_success "权限检查完成"
}

# 检查系统要求
check_system_requirements() {
    log_step "检查系统要求"
    
    local os_info=""
    if [ -f /etc/os-release ]; then
        os_info=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
    fi
    
    log_info "操作系统: ${os_info:-Unknown}"
    
    # 检查CPU核心数
    local cpu_cores=$(nproc)
    log_info "CPU核心数: $cpu_cores"
    
    if [ "$cpu_cores" -lt 2 ]; then
        log_warning "CPU核心数较少，可能影响性能"
    fi
    
    # 检查内存
    if command -v free > /dev/null; then
        local memory_gb=$(free -g | awk 'NR==2{printf "%.1f", $2}')
        log_info "系统内存: ${memory_gb}GB"
        
        if (( $(echo "$memory_gb < 4" | bc -l 2>/dev/null || echo "1") )); then
            log_warning "内存不足4GB，建议增加内存"
        fi
    fi
    
    # 检查磁盘空间
    local disk_space=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    log_info "可用磁盘空间: ${disk_space}GB"
    
    if [ "$disk_space" -lt 10 ]; then
        log_error "磁盘空间不足10GB，无法继续部署"
        exit 1
    fi
    
    log_success "系统要求检查通过"
}

# 检查和安装依赖
install_dependencies() {
    log_step "检查和安装依赖"
    
    local missing_deps=()
    
    # 检查基本工具
    for tool in curl wget git unzip; do
        if ! command -v "$tool" > /dev/null; then
            missing_deps+=("$tool")
        fi
    done
    
    # 检查Docker
    if ! command -v docker > /dev/null; then
        missing_deps+=("docker")
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose > /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # 检查Node.js
    if ! command -v node > /dev/null; then
        missing_deps+=("nodejs")
    else
        local node_version=$(node --version | sed 's/v//')
        local node_major=$(echo "$node_version" | cut -d'.' -f1)
        if [ "$node_major" -lt 18 ]; then
            log_warning "Node.js版本过低 ($node_version)，需要18+"
            missing_deps+=("nodejs-18+")
        else
            log_success "Node.js版本: $node_version"
        fi
    fi
    
    # 如果有缺失的依赖，提供安装指导
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "缺少以下依赖: ${missing_deps[*]}"
        echo ""
        echo "请根据您的操作系统安装缺失的依赖："
        echo ""
        
        if command -v apt > /dev/null; then
            echo "Ubuntu/Debian:"
            echo "  sudo apt update"
            echo "  sudo apt install -y curl wget git unzip"
            echo "  # Docker安装: https://docs.docker.com/engine/install/ubuntu/"
            echo "  # Node.js安装: https://nodejs.org/"
        elif command -v yum > /dev/null; then
            echo "CentOS/RHEL:"
            echo "  sudo yum install -y curl wget git unzip"
            echo "  # Docker安装: https://docs.docker.com/engine/install/centos/"
            echo "  # Node.js安装: https://nodejs.org/"
        elif command -v brew > /dev/null; then
            echo "macOS:"
            echo "  brew install curl wget git unzip"
            echo "  brew install --cask docker"
            echo "  brew install node"
        fi
        
        echo ""
        read -p "安装完成后按Enter继续，或按Ctrl+C退出: "
        
        # 重新检查
        install_dependencies
        return
    fi
    
    # 检查pnpm
    if ! command -v pnpm > /dev/null; then
        log_info "安装pnpm..."
        npm install -g pnpm
    fi
    
    log_success "所有依赖已安装"
}

# 选择部署模式
select_deployment_mode() {
    log_step "选择部署模式"
    
    echo ""
    echo "请选择部署模式:"
    echo "1) 全新部署 - 完整的初始化部署"
    echo "2) 更新部署 - 更新现有部署"
    echo "3) 开发部署 - 开发环境快速部署"
    echo "4) 生产部署 - 生产环境优化部署"
    echo ""
    
    while true; do
        read -p "请输入选择 [1-4]: " deploy_mode
        case $deploy_mode in
            1)
                DEPLOY_MODE="fresh"
                ENVIRONMENT="development"
                log_info "选择模式: 全新部署"
                break
                ;;
            2)
                DEPLOY_MODE="update"
                ENVIRONMENT="development"
                log_info "选择模式: 更新部署"
                break
                ;;
            3)
                DEPLOY_MODE="development"
                ENVIRONMENT="development"
                log_info "选择模式: 开发部署"
                break
                ;;
            4)
                DEPLOY_MODE="production"
                ENVIRONMENT="production"
                log_info "选择模式: 生产部署"
                break
                ;;
            *)
                echo "无效选择，请重新输入"
                ;;
        esac
    done
}

# 生成配置文件
generate_configuration() {
    log_step "生成配置文件"
    
    # 创建.env文件
    if [ ! -f ".env" ] || [ "$DEPLOY_MODE" = "fresh" ]; then
        log_info "创建环境配置文件..."
        
        # 生成随机密钥
        local nextauth_secret=$(openssl rand -base64 32 2>/dev/null || echo "change-this-secret-key")
        local cleanup_key=$(openssl rand -base64 16 2>/dev/null || echo "default-cleanup-key")
        
        # 复制模板文件
        if [ -f "config/env.template" ]; then
            cp "config/env.template" ".env"
            
            # 替换默认值
            sed -i "s/your-secret-key-here/$nextauth_secret/g" .env
            sed -i "s/default-cleanup-key/$cleanup_key/g" .env
            sed -i "s/NODE_ENV=development/NODE_ENV=$ENVIRONMENT/g" .env
            sed -i "s/WHISPER_ENV=development/WHISPER_ENV=$ENVIRONMENT/g" .env
            
            log_success "环境配置文件已创建"
        else
            log_warning "未找到配置模板，使用默认配置"
            create_default_env_file "$nextauth_secret" "$cleanup_key"
        fi
    else
        log_info "使用现有配置文件"
    fi
    
    # 加载环境变量
    source .env
    
    log_success "配置文件生成完成"
}

# 创建默认环境配置文件
create_default_env_file() {
    local nextauth_secret=$1
    local cleanup_key=$2
    
    cat > .env << EOF
# Whisper App 环境配置
NODE_ENV=$ENVIRONMENT
WHISPER_ENV=$ENVIRONMENT

# 数据库配置
DATABASE_URL=postgresql://whisper_user:whisper_password@localhost:5432/whisper_db

# Redis配置
REDIS_URL=redis://default:redis123@localhost:6379

# MinIO配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_BUCKET=audio-files

# NextAuth配置
NEXTAUTH_SECRET=$nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# 本地AI服务配置
LOCAL_LLM_ENABLED=true
LOCAL_WHISPER_ENABLED=true

# 应用配置
CLEANUP_API_KEY=$cleanup_key
MAX_FILE_SIZE=100MB
DEBUG=true
EOF
}

# 准备项目文件
prepare_project() {
    log_step "准备项目文件"
    
    # 创建必要目录
    local dirs=(
        "logs"
        "backups" 
        "public/uploads"
        "models/whisper"
        "models/llm"
        ".pids"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log_info "创建目录: $dir"
    done
    
    # 设置文件权限
    chmod +x start.sh || log_warning "无法设置start.sh权限"
    chmod +x scripts/management/*.sh || log_warning "无法设置管理脚本权限"
    
    log_success "项目文件准备完成"
}

# 启动基础服务
start_infrastructure() {
    log_step "启动基础服务"
    
    # 清理旧容器
    if [ "$DEPLOY_MODE" = "fresh" ]; then
        log_info "清理旧容器..."
        docker-compose down --remove-orphans 2>/dev/null || true
        docker system prune -f 2>/dev/null || true
    fi
    
    # 启动Docker服务
    log_info "启动Docker服务..."
    docker-compose up -d
    
    # 等待服务就绪
    log_info "等待服务启动..."
    local max_wait=120
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker-compose ps | grep -q "Up.*healthy"; then
            log_success "Docker服务启动成功"
            break
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
        echo -n "."
    done
    
    if [ $wait_time -ge $max_wait ]; then
        log_error "Docker服务启动超时"
        docker-compose logs
        exit 1
    fi
    
    log_success "基础服务启动完成"
}

# 初始化数据库
initialize_database() {
    log_step "初始化数据库"
    
    # 等待数据库就绪
    log_info "等待数据库连接..."
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker-compose exec -T postgres pg_isready -U whisper_user -d whisper_db > /dev/null 2>&1; then
            log_success "数据库连接就绪"
            break
        fi
        
        sleep 2
        wait_time=$((wait_time + 2))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        log_error "数据库连接超时"
        exit 1
    fi
    
    # 安装Node.js依赖
    log_info "安装项目依赖..."
    pnpm install
    
    # 生成Prisma客户端
    log_info "生成数据库客户端..."
    pnpm prisma generate
    
    # 推送数据库模式
    log_info "初始化数据库模式..."
    pnpm prisma db push
    
    # 初始化存储
    if [ -f "scripts/init-local-storage.js" ]; then
        log_info "初始化对象存储..."
        node scripts/init-local-storage.js
    fi
    
    log_success "数据库初始化完成"
}

# 构建和启动应用
build_and_start_app() {
    log_step "构建和启动应用"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "构建生产版本..."
        pnpm build
        
        log_info "启动生产服务器..."
        nohup pnpm start > logs/app.log 2>&1 &
        echo $! > .pids/nextjs.pid
    else
        log_info "启动开发服务器..."
        nohup pnpm dev > logs/app.log 2>&1 &
        echo $! > .pids/nextjs.pid
    fi
    
    # 等待应用启动
    log_info "等待应用启动..."
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log_success "应用启动成功"
            break
        fi
        
        sleep 3
        wait_time=$((wait_time + 3))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        log_error "应用启动超时"
        tail -50 logs/app.log
        exit 1
    fi
    
    log_success "应用构建和启动完成"
}

# 运行健康检查
run_health_check() {
    log_step "运行健康检查"
    
    if [ -f "scripts/management/health-check.sh" ]; then
        log_info "执行健康检查..."
        if bash scripts/management/health-check.sh; then
            log_success "健康检查通过"
        else
            log_warning "健康检查发现问题，但部署仍然继续"
        fi
    else
        log_warning "健康检查脚本不存在，跳过"
    fi
}

# 配置系统服务 (可选)
setup_system_service() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log_step "配置系统服务"
        
        read -p "是否创建systemd服务文件? (y/N): " create_service
        
        if [ "$create_service" = "y" ] || [ "$create_service" = "Y" ]; then
            create_systemd_service
        fi
    fi
}

# 创建systemd服务文件
create_systemd_service() {
    local service_file="/etc/systemd/system/whisper-app.service"
    local user=$(whoami)
    
    log_info "创建systemd服务文件..."
    
    sudo tee "$service_file" > /dev/null << EOF
[Unit]
Description=Whisper App
After=network.target docker.service
Requires=docker.service

[Service]
Type=forking
User=$user
Group=$user
WorkingDirectory=$PROJECT_ROOT
Environment=NODE_ENV=production
ExecStart=$PROJECT_ROOT/scripts/management/service-manager.sh start
ExecStop=$PROJECT_ROOT/scripts/management/service-manager.sh stop
ExecReload=$PROJECT_ROOT/scripts/management/service-manager.sh restart
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable whisper-app.service
    
    log_success "systemd服务配置完成"
    log_info "使用以下命令管理服务:"
    echo "  sudo systemctl start whisper-app    # 启动服务"
    echo "  sudo systemctl stop whisper-app     # 停止服务"
    echo "  sudo systemctl status whisper-app   # 查看状态"
}

# 显示部署结果
show_deployment_result() {
    log_step "部署完成"
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗"
    echo -e "║                        部署成功！                               ║"
    echo -e "╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${CYAN}访问地址:${NC}"
    echo "  🌐 应用主页: http://localhost:3000"
    echo "  📊 MinIO控制台: http://localhost:9001 (用户名: minioadmin, 密码: minioadmin123)"
    echo "  🗄️  Prisma Studio: 运行 'pnpm studio' 打开数据库管理界面"
    echo ""
    
    echo -e "${CYAN}管理命令:${NC}"
    echo "  📋 查看状态: ./scripts/management/service-manager.sh status"
    echo "  🔄 重启服务: ./scripts/management/service-manager.sh restart"
    echo "  📝 查看日志: ./scripts/management/service-manager.sh logs"
    echo "  ❤️  健康检查: ./scripts/management/health-check.sh"
    echo "  💾 数据备份: ./scripts/management/service-manager.sh backup"
    echo ""
    
    echo -e "${CYAN}重要文件:${NC}"
    echo "  📁 项目根目录: $PROJECT_ROOT"
    echo "  ⚙️  环境配置: .env"
    echo "  📊 部署日志: $DEPLOY_LOG"
    echo "  🗂️  应用日志: logs/app.log"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${YELLOW}生产环境注意事项:${NC}"
        echo "  🔐 请更改默认密码和密钥"
        echo "  🔒 配置防火墙规则"
        echo "  🔄 设置定期备份"
        echo "  📊 配置监控系统"
        echo ""
    fi
    
    echo -e "${GREEN}部署完成！您可以开始使用 Whisper App 了。${NC}"
}

# 清理函数
cleanup_on_error() {
    log_error "部署过程中发生错误，正在清理..."
    
    # 停止可能启动的服务
    docker-compose down 2>/dev/null || true
    
    # 清理PID文件
    rm -f .pids/*.pid 2>/dev/null || true
    
    log_info "清理完成，请检查错误日志: $DEPLOY_LOG"
}

# 主函数
main() {
    # 设置错误处理
    trap cleanup_on_error ERR
    trap 'log_warning "部署被中断"; cleanup_on_error; exit 130' INT TERM
    
    # 开始部署流程
    show_banner
    
    # 检查基本要求
    check_permissions
    check_system_requirements
    install_dependencies
    
    # 配置部署
    select_deployment_mode
    generate_configuration
    prepare_project
    
    # 部署服务
    start_infrastructure
    initialize_database
    build_and_start_app
    
    # 验证部署
    run_health_check
    setup_system_service
    
    # 显示结果
    show_deployment_result
    
    log_success "Whisper App 部署完成！"
}

# 运行主函数
main "$@"
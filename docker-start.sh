#!/bin/bash

# Whisper 应用 Docker 启动脚本
# 支持开发和生产环境

set -e

# 颜色输出
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

# 显示帮助信息
show_help() {
    cat << EOF
Whisper Docker 启动脚本

用法:
    $0 [COMMAND] [OPTIONS]

命令:
    dev         启动开发环境
    prod        启动生产环境  
    stop        停止所有服务
    restart     重启服务
    logs        查看日志
    status      查看服务状态
    clean       清理容器和卷
    backup      备份数据
    restore     恢复数据

选项:
    -h, --help      显示帮助信息
    -v, --verbose   详细输出
    --no-cache      构建时不使用缓存
    --pull          拉取最新镜像

示例:
    $0 dev                  # 启动开发环境
    $0 prod                 # 启动生产环境
    $0 stop                 # 停止所有服务
    $0 logs app             # 查看应用日志
    $0 clean --volumes      # 清理所有数据
    
EOF
}

# 检查Docker和Docker Compose
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或未在PATH中"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境变量文件
check_env_files() {
    local env_file="$1"
    
    if [[ ! -f "$env_file" ]]; then
        log_warning "环境变量文件 $env_file 不存在"
        
        if [[ -f "${env_file}.example" ]]; then
            log_info "从示例文件创建 $env_file"
            cp "${env_file}.example" "$env_file"
            log_warning "请编辑 $env_file 文件配置正确的环境变量"
        fi
    fi
}

# 启动开发环境
start_dev() {
    log_info "启动开发环境..."
    
    check_env_files ".env.local"
    
    local compose_cmd="docker-compose -f docker-compose.yml -f docker-compose.dev.yml"
    
    if [[ "$PULL_IMAGES" == "true" ]]; then
        log_info "拉取最新镜像..."
        $compose_cmd pull
    fi
    
    local build_args=""
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
    fi
    
    $compose_cmd up --build $build_args -d
    
    log_success "开发环境启动成功!"
    log_info "应用访问地址: http://localhost:3000"
    log_info "MinIO 控制台: http://localhost:9001"
    log_info "查看日志: $0 logs"
}

# 启动生产环境
start_prod() {
    log_info "启动生产环境..."
    
    check_env_files ".env.production"
    
    # 检查必要的生产环境变量
    if [[ -z "$POSTGRES_PASSWORD" || -z "$REDIS_PASSWORD" || -z "$NEXTAUTH_SECRET" ]]; then
        log_error "生产环境需要设置以下环境变量:"
        log_error "POSTGRES_PASSWORD, REDIS_PASSWORD, NEXTAUTH_SECRET"
        exit 1
    fi
    
    local compose_cmd="docker-compose -f docker-compose.yml -f docker-compose.prod.yml"
    
    if [[ "$PULL_IMAGES" == "true" ]]; then
        log_info "拉取最新镜像..."
        $compose_cmd pull
    fi
    
    local build_args=""
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
    fi
    
    $compose_cmd up --build $build_args -d
    
    log_success "生产环境启动成功!"
    log_info "查看日志: $0 logs"
}

# 停止服务
stop_services() {
    log_info "停止所有服务..."
    
    # 尝试停止开发环境
    if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps -q &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    fi
    
    # 尝试停止生产环境
    if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps -q &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    fi
    
    # 停止基础服务
    docker-compose down
    
    log_success "所有服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    stop_services
    sleep 3
    
    # 检查之前运行的是什么环境
    if [[ -f ".env.local" ]] && docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps -q &> /dev/null; then
        start_dev
    elif [[ -f ".env.production" ]]; then
        start_prod
    else
        log_warning "无法确定之前的环境，启动开发环境"
        start_dev
    fi
}

# 查看日志
show_logs() {
    local service="$1"
    local compose_cmd="docker-compose"
    
    # 检测当前运行的环境
    if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps -q &> /dev/null; then
        compose_cmd="docker-compose -f docker-compose.yml -f docker-compose.dev.yml"
    elif docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps -q &> /dev/null; then
        compose_cmd="docker-compose -f docker-compose.yml -f docker-compose.prod.yml"
    fi
    
    if [[ -n "$service" ]]; then
        $compose_cmd logs -f "$service"
    else
        $compose_cmd logs -f
    fi
}

# 查看服务状态
show_status() {
    log_info "服务状态:"
    
    # 检查开发环境
    if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps -q &> /dev/null; then
        log_info "开发环境状态:"
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps
    fi
    
    # 检查生产环境
    if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps -q &> /dev/null; then
        log_info "生产环境状态:"
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
    fi
    
    # 检查基础服务
    docker-compose ps
}

# 清理容器和卷
clean_up() {
    log_warning "这将删除所有容器、网络和卷！"
    read -p "确定要继续吗? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "清理容器和网络..."
        
        # 停止并删除容器
        stop_services
        
        # 删除网络
        docker network rm whisper_network 2>/dev/null || true
        
        if [[ "$1" == "--volumes" ]]; then
            log_info "删除数据卷..."
            docker volume rm $(docker volume ls -q | grep whisper) 2>/dev/null || true
        fi
        
        log_success "清理完成"
    else
        log_info "取消清理"
    fi
}

# 备份数据
backup_data() {
    local backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    log_info "备份数据到 $backup_dir..."
    
    # 备份PostgreSQL
    if docker-compose ps postgres | grep -q "Up"; then
        log_info "备份PostgreSQL数据..."
        docker-compose exec -T postgres pg_dumpall -U whisper_user > "$backup_dir/postgres_backup.sql"
    fi
    
    # 备份Redis
    if docker-compose ps redis | grep -q "Up"; then
        log_info "备份Redis数据..."
        docker-compose exec -T redis redis-cli --rdb - > "$backup_dir/redis_backup.rdb"
    fi
    
    # 备份上传文件
    if [[ -d "./public/uploads" ]]; then
        log_info "备份上传文件..."
        cp -r "./public/uploads" "$backup_dir/"
    fi
    
    log_success "备份完成: $backup_dir"
}

# 主函数
main() {
    local command="$1"
    shift || true
    
    # 解析选项
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            --no-cache)
                NO_CACHE="true"
                shift
                ;;
            --pull)
                PULL_IMAGES="true"
                shift
                ;;
            --volumes)
                CLEAN_VOLUMES="true"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    # 检查依赖
    check_dependencies
    
    # 执行命令
    case "$command" in
        dev)
            start_dev
            ;;
        prod)
            start_prod
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs "$1"
            ;;
        status)
            show_status
            ;;
        clean)
            if [[ "$CLEAN_VOLUMES" == "true" ]]; then
                clean_up --volumes
            else
                clean_up
            fi
            ;;
        backup)
            backup_data
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
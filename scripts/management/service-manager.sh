#!/bin/bash

# Whisper App 服务管理脚本
# 用于启动、停止、监控和管理Whisper应用的各项服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/logs"

# 创建必要目录
mkdir -p "$PID_DIR" "$LOG_DIR"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 显示帮助信息
show_help() {
    echo "Whisper App 服务管理工具"
    echo ""
    echo "用法: $0 <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  start     启动所有服务"
    echo "  stop      停止所有服务"
    echo "  restart   重启所有服务"
    echo "  status    查看服务状态"
    echo "  logs      查看服务日志"
    echo "  health    健康检查"
    echo "  backup    数据备份"
    echo "  restore   数据恢复"
    echo "  cleanup   清理临时文件"
    echo "  update    更新应用"
    echo ""
    echo "选项:"
    echo "  --service <name>    指定服务名称"
    echo "  --env <env>         指定环境 (development/production)"
    echo "  --follow            跟踪日志输出"
    echo "  --tail <n>          显示最后n行日志"
    echo "  --help              显示此帮助信息"
}

# 加载环境配置
load_environment() {
    local env=${1:-development}
    local env_file="$PROJECT_ROOT/config/env.$env"
    
    if [ -f "$env_file" ]; then
        log_info "加载环境配置: $env"
        source "$env_file"
    else
        log_warning "环境配置文件不存在: $env_file"
    fi
}

# 检查服务状态
check_service_status() {
    local service=$1
    local pid_file="$PID_DIR/$service.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "running"
            return 0
        else
            # PID文件存在但进程不存在，清理PID文件
            rm -f "$pid_file"
        fi
    fi
    
    echo "stopped"
    return 1
}

# 启动Docker服务
start_docker_services() {
    log_info "启动Docker服务..."
    
    cd "$PROJECT_ROOT"
    
    # 检查docker-compose文件
    if [ ! -f "docker-compose.yml" ]; then
        log_error "未找到docker-compose.yml文件"
        return 1
    fi
    
    # 启动Docker服务
    docker-compose up -d
    
    # 等待服务就绪
    log_info "等待Docker服务就绪..."
    local timeout=60
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if docker-compose ps | grep -q "Up.*healthy"; then
            log_success "Docker服务启动成功"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    log_error "Docker服务启动超时"
    return 1
}

# 停止Docker服务
stop_docker_services() {
    log_info "停止Docker服务..."
    
    cd "$PROJECT_ROOT"
    docker-compose down
    
    log_success "Docker服务已停止"
}

# 启动Next.js应用
start_nextjs_app() {
    log_info "启动Next.js应用..."
    
    cd "$PROJECT_ROOT"
    
    local pid_file="$PID_DIR/nextjs.pid"
    local log_file="$LOG_DIR/nextjs.log"
    
    # 检查是否已运行
    if [ "$(check_service_status nextjs)" = "running" ]; then
        log_warning "Next.js应用已在运行"
        return 0
    fi
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装依赖..."
        pnpm install
    fi
    
    # 生成Prisma客户端
    pnpm prisma generate
    
    # 根据环境启动应用
    if [ "${NODE_ENV:-development}" = "production" ]; then
        # 构建并启动生产版本
        pnpm build
        nohup pnpm start > "$log_file" 2>&1 &
    else
        # 启动开发版本
        nohup pnpm dev > "$log_file" 2>&1 &
    fi
    
    local pid=$!
    echo $pid > "$pid_file"
    
    # 等待应用启动
    sleep 10
    
    if ps -p "$pid" > /dev/null 2>&1; then
        log_success "Next.js应用启动成功 (PID: $pid)"
    else
        log_error "Next.js应用启动失败"
        rm -f "$pid_file"
        return 1
    fi
}

# 停止Next.js应用
stop_nextjs_app() {
    log_info "停止Next.js应用..."
    
    local pid_file="$PID_DIR/nextjs.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid"
            sleep 5
            
            # 强制杀死进程
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid"
            fi
            
            log_success "Next.js应用已停止"
        fi
        rm -f "$pid_file"
    else
        log_warning "Next.js应用未运行"
    fi
    
    # 清理其他相关进程
    pkill -f "next" || true
}

# 启动所有服务
start_all_services() {
    log_info "启动所有服务..."
    
    # 启动Docker服务
    start_docker_services || return 1
    
    # 运行数据库迁移
    cd "$PROJECT_ROOT"
    pnpm prisma db push
    
    # 初始化存储
    if [ -f "scripts/init-local-storage.js" ]; then
        node scripts/init-local-storage.js
    fi
    
    # 启动Next.js应用
    start_nextjs_app || return 1
    
    log_success "所有服务启动完成"
}

# 停止所有服务
stop_all_services() {
    log_info "停止所有服务..."
    
    # 停止Next.js应用
    stop_nextjs_app
    
    # 停止Docker服务
    stop_docker_services
    
    log_success "所有服务已停止"
}

# 重启所有服务
restart_all_services() {
    log_info "重启所有服务..."
    
    stop_all_services
    sleep 3
    start_all_services
}

# 显示服务状态
show_status() {
    echo ""
    echo -e "${GREEN}=========================================="
    echo "           服务状态报告"
    echo -e "==========================================${NC}"
    
    # Docker服务状态
    echo ""
    echo "Docker服务状态:"
    if command -v docker-compose > /dev/null; then
        cd "$PROJECT_ROOT"
        docker-compose ps 2>/dev/null || echo "  Docker服务未运行"
    else
        echo "  Docker Compose未安装"
    fi
    
    # Next.js应用状态
    echo ""
    echo "Next.js应用状态:"
    local nextjs_status=$(check_service_status nextjs)
    if [ "$nextjs_status" = "running" ]; then
        local pid=$(cat "$PID_DIR/nextjs.pid")
        echo "  ✓ 运行中 (PID: $pid)"
        
        # 检查端口
        if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
            echo "  ✓ 端口3000已监听"
        else
            echo "  ✗ 端口3000未监听"
        fi
        
        # 检查HTTP响应
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo "  ✓ HTTP响应正常"
        else
            echo "  ✗ HTTP响应异常"
        fi
    else
        echo "  ✗ 未运行"
    fi
    
    # 端口占用情况
    echo ""
    echo "端口占用情况:"
    for port in 3000 5432 6379 9000 9001; do
        if netstat -tlnp 2>/dev/null | grep -q ":$port"; then
            echo "  ✓ $port: 已占用"
        else
            echo "  ✗ $port: 空闲"
        fi
    done
    
    # 磁盘使用情况
    echo ""
    echo "磁盘使用情况:"
    df -h "$PROJECT_ROOT" | tail -1 | awk '{print "  可用空间: " $4 " / " $2 " (" $5 " 已使用)"}'
    
    # 内存使用情况
    echo ""
    echo "内存使用情况:"
    if command -v free > /dev/null; then
        free -h | grep "Mem:" | awk '{print "  可用内存: " $7 " / " $2}'
    fi
}

# 查看日志
show_logs() {
    local service=${1:-all}
    local follow=${2:-false}
    local tail_lines=${3:-100}
    
    case $service in
        "nextjs")
            local log_file="$LOG_DIR/nextjs.log"
            if [ -f "$log_file" ]; then
                if [ "$follow" = "true" ]; then
                    tail -f "$log_file"
                else
                    tail -n "$tail_lines" "$log_file"
                fi
            else
                log_warning "Next.js日志文件不存在"
            fi
            ;;
        "docker")
            cd "$PROJECT_ROOT"
            if [ "$follow" = "true" ]; then
                docker-compose logs -f --tail="$tail_lines"
            else
                docker-compose logs --tail="$tail_lines"
            fi
            ;;
        "all"|*)
            echo "=== Next.js应用日志 ==="
            show_logs nextjs false "$tail_lines"
            echo ""
            echo "=== Docker服务日志 ==="
            show_logs docker false "$tail_lines"
            ;;
    esac
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local all_healthy=true
    
    # 检查Docker服务
    echo "检查Docker服务..."
    cd "$PROJECT_ROOT"
    if ! docker-compose ps | grep -q "Up.*healthy"; then
        log_error "Docker服务不健康"
        all_healthy=false
    else
        log_success "Docker服务正常"
    fi
    
    # 检查Next.js应用
    echo "检查Next.js应用..."
    if [ "$(check_service_status nextjs)" != "running" ]; then
        log_error "Next.js应用未运行"
        all_healthy=false
    else
        # 检查HTTP响应
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Next.js应用正常"
        else
            log_warning "Next.js应用HTTP检查失败"
            all_healthy=false
        fi
    fi
    
    # 检查数据库连接
    echo "检查数据库连接..."
    if docker-compose exec -T postgres pg_isready -U whisper_user -d whisper_db > /dev/null 2>&1; then
        log_success "数据库连接正常"
    else
        log_error "数据库连接失败"
        all_healthy=false
    fi
    
    # 检查Redis连接
    echo "检查Redis连接..."
    if docker-compose exec -T redis redis-cli -a redis123 ping > /dev/null 2>&1; then
        log_success "Redis连接正常"
    else
        log_error "Redis连接失败"
        all_healthy=false
    fi
    
    if [ "$all_healthy" = "true" ]; then
        log_success "所有服务健康检查通过"
        return 0
    else
        log_error "健康检查失败"
        return 1
    fi
}

# 数据备份
backup_data() {
    log_info "开始数据备份..."
    
    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="whisper_backup_$timestamp"
    
    mkdir -p "$backup_dir"
    
    cd "$PROJECT_ROOT"
    
    # 备份数据库
    log_info "备份PostgreSQL数据库..."
    docker-compose exec -T postgres pg_dump -U whisper_user whisper_db > "$backup_dir/${backup_name}_db.sql"
    
    # 备份Redis数据
    log_info "备份Redis数据..."
    docker-compose exec -T redis redis-cli -a redis123 --rdb - > "$backup_dir/${backup_name}_redis.rdb"
    
    # 备份MinIO数据
    log_info "备份MinIO数据..."
    docker cp whisper_minio:/data "$backup_dir/${backup_name}_minio"
    
    # 备份应用配置
    log_info "备份应用配置..."
    tar -czf "$backup_dir/${backup_name}_config.tar.gz" config/ .env* 2>/dev/null || true
    
    # 创建备份信息文件
    cat > "$backup_dir/${backup_name}_info.txt" << EOF
备份时间: $(date)
备份版本: $timestamp
数据库: whisper_db
Redis: 已备份
MinIO: 已备份
配置文件: 已备份
EOF
    
    log_success "数据备份完成: $backup_dir/$backup_name"
}

# 数据恢复
restore_data() {
    local backup_name=$1
    
    if [ -z "$backup_name" ]; then
        log_error "请指定备份名称"
        echo "可用备份:"
        ls -1 "$PROJECT_ROOT/backups" | grep "_info.txt" | sed 's/_info.txt//'
        return 1
    fi
    
    local backup_dir="$PROJECT_ROOT/backups"
    
    if [ ! -f "$backup_dir/${backup_name}_info.txt" ]; then
        log_error "备份不存在: $backup_name"
        return 1
    fi
    
    log_warning "数据恢复将覆盖现有数据，请确认操作"
    read -p "继续恢复吗? (y/N): " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "恢复操作已取消"
        return 0
    fi
    
    log_info "开始数据恢复..."
    
    cd "$PROJECT_ROOT"
    
    # 停止服务
    stop_all_services
    
    # 恢复数据库
    if [ -f "$backup_dir/${backup_name}_db.sql" ]; then
        log_info "恢复PostgreSQL数据库..."
        start_docker_services
        docker-compose exec -T postgres psql -U whisper_user -d whisper_db < "$backup_dir/${backup_name}_db.sql"
    fi
    
    # 恢复Redis数据
    if [ -f "$backup_dir/${backup_name}_redis.rdb" ]; then
        log_info "恢复Redis数据..."
        docker cp "$backup_dir/${backup_name}_redis.rdb" whisper_redis:/data/dump.rdb
        docker-compose restart redis
    fi
    
    # 恢复MinIO数据
    if [ -d "$backup_dir/${backup_name}_minio" ]; then
        log_info "恢复MinIO数据..."
        docker cp "$backup_dir/${backup_name}_minio/." whisper_minio:/data/
        docker-compose restart minio
    fi
    
    # 恢复配置文件
    if [ -f "$backup_dir/${backup_name}_config.tar.gz" ]; then
        log_info "恢复配置文件..."
        tar -xzf "$backup_dir/${backup_name}_config.tar.gz"
    fi
    
    log_success "数据恢复完成"
    
    # 重启服务
    start_all_services
}

# 清理临时文件
cleanup_temp_files() {
    log_info "清理临时文件..."
    
    local cleaned=0
    
    # 清理应用临时文件
    if [ -d "$PROJECT_ROOT/public/uploads" ]; then
        find "$PROJECT_ROOT/public/uploads" -type f -mtime +1 -delete
        cleaned=$((cleaned + $(find "$PROJECT_ROOT/public/uploads" -type f -mtime +1 | wc -l)))
    fi
    
    # 清理Docker未使用的资源
    docker system prune -f > /dev/null 2>&1 || true
    
    # 清理旧日志文件
    if [ -d "$LOG_DIR" ]; then
        find "$LOG_DIR" -name "*.log" -mtime +7 -delete
    fi
    
    # 清理旧备份文件
    if [ -d "$PROJECT_ROOT/backups" ]; then
        find "$PROJECT_ROOT/backups" -type f -mtime +30 -delete
    fi
    
    log_success "临时文件清理完成"
}

# 更新应用
update_app() {
    log_info "更新应用..."
    
    cd "$PROJECT_ROOT"
    
    # 备份当前数据
    backup_data
    
    # 拉取最新代码
    if [ -d ".git" ]; then
        git pull
    else
        log_warning "不是Git仓库，跳过代码更新"
    fi
    
    # 更新依赖
    pnpm install
    
    # 运行数据库迁移
    pnpm prisma generate
    pnpm prisma db push
    
    # 重启服务
    restart_all_services
    
    log_success "应用更新完成"
}

# 主函数
main() {
    local command=$1
    shift
    
    # 解析参数
    local service=""
    local env="development"
    local follow=false
    local tail_lines=100
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --service)
                service="$2"
                shift 2
                ;;
            --env)
                env="$2"
                shift 2
                ;;
            --follow)
                follow=true
                shift
                ;;
            --tail)
                tail_lines="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    # 加载环境配置
    load_environment "$env"
    
    # 执行命令
    case $command in
        "start")
            if [ -n "$service" ]; then
                case $service in
                    "docker") start_docker_services ;;
                    "nextjs") start_nextjs_app ;;
                    *) log_error "未知服务: $service" ;;
                esac
            else
                start_all_services
            fi
            ;;
        "stop")
            if [ -n "$service" ]; then
                case $service in
                    "docker") stop_docker_services ;;
                    "nextjs") stop_nextjs_app ;;
                    *) log_error "未知服务: $service" ;;
                esac
            else
                stop_all_services
            fi
            ;;
        "restart")
            restart_all_services
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$service" "$follow" "$tail_lines"
            ;;
        "health")
            health_check
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$1"
            ;;
        "cleanup")
            cleanup_temp_files
            ;;
        "update")
            update_app
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
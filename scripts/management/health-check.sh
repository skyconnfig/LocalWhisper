#!/bin/bash

# Whisper App 健康检查脚本
# 用于监控应用和服务的健康状态

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
LOG_FILE="$PROJECT_ROOT/logs/health-check.log"

mkdir -p "$(dirname "$LOG_FILE")"

# 日志函数
log_info() { 
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

log_success() { 
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() { 
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

log_error() { 
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

# 健康检查结果
HEALTH_RESULTS=()
OVERALL_HEALTH=true

# 添加检查结果
add_result() {
    local service=$1
    local status=$2
    local message=$3
    
    HEALTH_RESULTS+=("$service:$status:$message")
    
    if [ "$status" != "OK" ]; then
        OVERALL_HEALTH=false
    fi
}

# 检查HTTP端点
check_http_endpoint() {
    local name=$1
    local url=$2
    local timeout=${3:-10}
    local expected_status=${4:-200}
    
    log_info "检查HTTP端点: $name ($url)"
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        log_success "$name HTTP检查通过 (状态码: $response_code)"
        add_result "$name" "OK" "HTTP响应正常"
        return 0
    else
        log_error "$name HTTP检查失败 (状态码: $response_code)"
        add_result "$name" "FAIL" "HTTP响应异常 ($response_code)"
        return 1
    fi
}

# 检查TCP端口
check_tcp_port() {
    local name=$1
    local host=$2
    local port=$3
    local timeout=${4:-5}
    
    log_info "检查TCP端口: $name ($host:$port)"
    
    if timeout "$timeout" bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        log_success "$name TCP端口检查通过"
        add_result "$name" "OK" "TCP端口可达"
        return 0
    else
        log_error "$name TCP端口检查失败"
        add_result "$name" "FAIL" "TCP端口不可达"
        return 1
    fi
}

# 检查进程
check_process() {
    local name=$1
    local pattern=$2
    
    log_info "检查进程: $name"
    
    if pgrep -f "$pattern" > /dev/null; then
        local pid=$(pgrep -f "$pattern" | head -1)
        log_success "$name 进程运行正常 (PID: $pid)"
        add_result "$name" "OK" "进程运行中"
        return 0
    else
        log_error "$name 进程未运行"
        add_result "$name" "FAIL" "进程未运行"
        return 1
    fi
}

# 检查Docker容器
check_docker_container() {
    local name=$1
    local container_name=$2
    
    log_info "检查Docker容器: $name"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name.*Up"; then
        local status=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$container_name" | awk '{print $2}')
        log_success "$name 容器运行正常 ($status)"
        add_result "$name" "OK" "容器运行中"
        return 0
    else
        log_error "$name 容器未运行"
        add_result "$name" "FAIL" "容器未运行"
        return 1
    fi
}

# 检查数据库连接
check_database() {
    local name=$1
    local connection_string=$2
    
    log_info "检查数据库连接: $name"
    
    cd "$PROJECT_ROOT"
    
    # 使用Docker容器检查PostgreSQL
    if docker-compose exec -T postgres pg_isready -U whisper_user -d whisper_db > /dev/null 2>&1; then
        log_success "$name 数据库连接正常"
        add_result "$name" "OK" "数据库连接正常"
        return 0
    else
        log_error "$name 数据库连接失败"
        add_result "$name" "FAIL" "数据库连接失败"
        return 1
    fi
}

# 检查Redis连接
check_redis() {
    local name=$1
    
    log_info "检查Redis连接: $name"
    
    cd "$PROJECT_ROOT"
    
    if docker-compose exec -T redis redis-cli -a redis123 ping 2>/dev/null | grep -q "PONG"; then
        log_success "$name Redis连接正常"
        add_result "$name" "OK" "Redis连接正常"
        return 0
    else
        log_error "$name Redis连接失败"
        add_result "$name" "FAIL" "Redis连接失败"
        return 1
    fi
}

# 检查磁盘空间
check_disk_space() {
    local name=$1
    local path=$2
    local threshold=${3:-90}  # 默认90%阈值
    
    log_info "检查磁盘空间: $name ($path)"
    
    local usage=$(df "$path" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        log_success "$name 磁盘空间充足 (使用率: $usage%)"
        add_result "$name" "OK" "磁盘空间充足 ($usage%)"
        return 0
    else
        log_warning "$name 磁盘空间不足 (使用率: $usage%)"
        add_result "$name" "WARN" "磁盘空间不足 ($usage%)"
        return 1
    fi
}

# 检查内存使用
check_memory() {
    local name=$1
    local threshold=${2:-90}  # 默认90%阈值
    
    log_info "检查内存使用: $name"
    
    if command -v free > /dev/null; then
        local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [ "$usage" -lt "$threshold" ]; then
            log_success "$name 内存使用正常 (使用率: $usage%)"
            add_result "$name" "OK" "内存使用正常 ($usage%)"
            return 0
        else
            log_warning "$name 内存使用过高 (使用率: $usage%)"
            add_result "$name" "WARN" "内存使用过高 ($usage%)"
            return 1
        fi
    else
        log_warning "$name 无法检查内存使用"
        add_result "$name" "WARN" "无法检查内存"
        return 1
    fi
}

# 检查文件系统权限
check_file_permissions() {
    local name=$1
    local path=$2
    local required_perms=$3
    
    log_info "检查文件权限: $name ($path)"
    
    if [ ! -e "$path" ]; then
        log_error "$name 文件不存在: $path"
        add_result "$name" "FAIL" "文件不存在"
        return 1
    fi
    
    local actual_perms=$(stat -c "%a" "$path" 2>/dev/null || echo "")
    
    if [ "$actual_perms" = "$required_perms" ]; then
        log_success "$name 文件权限正确 ($actual_perms)"
        add_result "$name" "OK" "文件权限正确"
        return 0
    else
        log_warning "$name 文件权限不正确 (期望: $required_perms, 实际: $actual_perms)"
        add_result "$name" "WARN" "文件权限不正确"
        return 1
    fi
}

# 运行所有健康检查
run_health_checks() {
    log_info "开始运行健康检查..."
    
    # 检查Docker容器
    check_docker_container "PostgreSQL" "whisper_postgres"
    check_docker_container "Redis" "whisper_redis"
    check_docker_container "MinIO" "whisper_minio"
    
    # 检查数据库连接
    check_database "PostgreSQL" "$DATABASE_URL"
    check_redis "Redis"
    
    # 检查应用进程
    check_process "Next.js" "next"
    
    # 检查HTTP端点
    check_http_endpoint "应用主页" "http://localhost:3000" 10 200
    check_http_endpoint "MinIO API" "http://localhost:9000/minio/health/live" 10 200
    check_http_endpoint "MinIO Console" "http://localhost:9001" 10 200
    
    # 检查TCP端口
    check_tcp_port "Next.js" "localhost" "3000"
    check_tcp_port "PostgreSQL" "localhost" "5432"
    check_tcp_port "Redis" "localhost" "6379"
    check_tcp_port "MinIO API" "localhost" "9000"
    check_tcp_port "MinIO Console" "localhost" "9001"
    
    # 检查系统资源
    check_disk_space "项目目录" "$PROJECT_ROOT" 90
    check_memory "系统内存" 85
    
    # 检查重要文件权限
    check_file_permissions "启动脚本" "$PROJECT_ROOT/start.sh" "755"
    check_file_permissions "服务管理脚本" "$PROJECT_ROOT/scripts/management/service-manager.sh" "755"
}

# 生成健康检查报告
generate_report() {
    local report_file="$PROJECT_ROOT/logs/health-report-$(date +%Y%m%d_%H%M%S).json"
    
    echo "生成健康检查报告..."
    
    # 创建JSON报告
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "overall_health": $( [ "$OVERALL_HEALTH" = true ] && echo "true" || echo "false" ),
  "checks": [
EOF
    
    local first=true
    for result in "${HEALTH_RESULTS[@]}"; do
        IFS=':' read -r service status message <<< "$result"
        
        if [ "$first" = false ]; then
            echo "," >> "$report_file"
        fi
        first=false
        
        cat >> "$report_file" << EOF
    {
      "service": "$service",
      "status": "$status",
      "message": "$message"
    }
EOF
    done
    
    cat >> "$report_file" << EOF
  ]
}
EOF
    
    echo "健康检查报告已生成: $report_file"
}

# 显示结果摘要
show_summary() {
    echo ""
    echo -e "${GREEN}=========================================="
    echo "           健康检查摘要"
    echo -e "==========================================${NC}"
    
    local total_checks=${#HEALTH_RESULTS[@]}
    local ok_count=0
    local warn_count=0
    local fail_count=0
    
    for result in "${HEALTH_RESULTS[@]}"; do
        IFS=':' read -r service status message <<< "$result"
        
        case $status in
            "OK") 
                echo -e "  ${GREEN}✓${NC} $service: $message"
                ok_count=$((ok_count + 1))
                ;;
            "WARN") 
                echo -e "  ${YELLOW}⚠${NC} $service: $message"
                warn_count=$((warn_count + 1))
                ;;
            "FAIL") 
                echo -e "  ${RED}✗${NC} $service: $message"
                fail_count=$((fail_count + 1))
                ;;
        esac
    done
    
    echo ""
    echo "检查统计:"
    echo "  总计: $total_checks"
    echo -e "  ${GREEN}正常: $ok_count${NC}"
    echo -e "  ${YELLOW}警告: $warn_count${NC}"
    echo -e "  ${RED}失败: $fail_count${NC}"
    
    echo ""
    if [ "$OVERALL_HEALTH" = true ]; then
        echo -e "${GREEN}整体健康状态: 良好${NC}"
    else
        echo -e "${RED}整体健康状态: 异常${NC}"
    fi
}

# 发送通知 (可选)
send_notification() {
    if [ "$OVERALL_HEALTH" = false ]; then
        # 这里可以添加邮件、Slack、钉钉等通知逻辑
        log_warning "检测到健康问题，建议检查系统状态"
    fi
}

# 主函数
main() {
    local mode=${1:-"check"}
    
    case $mode in
        "check")
            run_health_checks
            show_summary
            generate_report
            send_notification
            
            # 返回适当的退出码
            if [ "$OVERALL_HEALTH" = true ]; then
                exit 0
            else
                exit 1
            fi
            ;;
        "report")
            # 只生成报告，不执行检查
            if [ ${#HEALTH_RESULTS[@]} -eq 0 ]; then
                echo "没有健康检查结果，请先运行检查"
                exit 1
            fi
            generate_report
            ;;
        "continuous")
            # 持续监控模式
            log_info "启动持续监控模式 (按Ctrl+C退出)"
            while true; do
                run_health_checks
                show_summary
                
                if [ "$OVERALL_HEALTH" = false ]; then
                    send_notification
                fi
                
                sleep 300  # 5分钟检查一次
            done
            ;;
        *)
            echo "用法: $0 [check|report|continuous]"
            echo "  check      - 执行健康检查 (默认)"
            echo "  report     - 生成检查报告"
            echo "  continuous - 持续监控模式"
            exit 1
            ;;
    esac
}

# 加载环境配置
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# 处理中断信号
trap 'log_info "健康检查中断"; exit 130' INT TERM

# 运行主函数
main "$@"
#!/bin/bash

# PostgreSQL 自动备份脚本
# 用于生产环境的定期数据库备份

set -e

# 配置
BACKUP_DIR="/backups"
DB_NAME="${POSTGRES_DB:-whisper_production}"
DB_USER="${POSTGRES_USER:-whisper_prod_user}"
DB_HOST="postgres"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 生成备份文件名
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/postgres_backup_${TIMESTAMP}.sql"

echo "$(date): 开始备份数据库 $DB_NAME"

# 执行备份
if pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
    echo "$(date): 备份成功 - $BACKUP_FILE"
    
    # 压缩备份文件
    if command -v gzip &> /dev/null; then
        gzip "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        echo "$(date): 备份文件已压缩 - $BACKUP_FILE"
    fi
    
    # 清理旧备份
    find "$BACKUP_DIR" -name "postgres_backup_*.sql*" -mtime +${RETENTION_DAYS} -delete
    echo "$(date): 已清理 ${RETENTION_DAYS} 天前的旧备份"
    
else
    echo "$(date): 备份失败!" >&2
    exit 1
fi

echo "$(date): 备份完成"
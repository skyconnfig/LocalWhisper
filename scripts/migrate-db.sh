#!/bin/bash

# 数据库迁移脚本
# 用于从云端数据库迁移到本地数据库

set -e

echo "📦 数据库迁移工具"
echo "=================="

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: $0 <action> [options]"
    echo ""
    echo "Actions:"
    echo "  backup <source_url>     # 从源数据库创建备份"
    echo "  restore <backup_file>   # 恢复备份到本地数据库"
    echo "  migrate <source_url>    # 直接从源数据库迁移到本地"
    echo "  schema-diff             # 比较架构差异"
    echo "  reset                   # 重置本地数据库"
    echo ""
    echo "示例:"
    echo "  $0 backup \"postgresql://user:pass@host:5432/db\""
    echo "  $0 restore backup_2024-01-01.sql"
    echo "  $0 migrate \"postgresql://user:pass@host:5432/db\""
    echo ""
    exit 1
fi

ACTION=$1

# 本地数据库连接信息
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="5432"
LOCAL_DB_NAME="whisper_db"
LOCAL_DB_USER="whisper_user"
LOCAL_DB_PASSWORD="whisper_password"
LOCAL_DB_URL="postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/${LOCAL_DB_NAME}"

# 确保本地数据库服务运行
ensure_local_db() {
    echo "🔍 检查本地数据库服务..."
    if ! docker exec whisper_postgres pg_isready -U $LOCAL_DB_USER -d $LOCAL_DB_NAME > /dev/null 2>&1; then
        echo "❌ 本地数据库未运行，请先执行: ./scripts/setup-local-db.sh"
        exit 1
    fi
    echo "✅ 本地数据库运行正常"
}

# 创建备份
create_backup() {
    SOURCE_URL=$2
    if [ -z "$SOURCE_URL" ]; then
        echo "❌ 请提供源数据库 URL"
        exit 1
    fi

    BACKUP_FILE="backup_$(date +%Y-%m-%d_%H-%M-%S).sql"
    
    echo "📥 从源数据库创建备份..."
    echo "源数据库: $SOURCE_URL"
    echo "备份文件: $BACKUP_FILE"
    
    # 使用 pg_dump 创建备份
    if command -v pg_dump &> /dev/null; then
        pg_dump "$SOURCE_URL" > "$BACKUP_FILE"
    else
        echo "❌ pg_dump 未安装，尝试使用 Docker..."
        docker run --rm -v $(pwd):/backup postgres:16-alpine pg_dump "$SOURCE_URL" > "$BACKUP_FILE"
    fi
    
    echo "✅ 备份创建完成: $BACKUP_FILE"
}

# 恢复备份
restore_backup() {
    BACKUP_FILE=$2
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ 备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    ensure_local_db
    
    echo "📤 恢复备份到本地数据库..."
    echo "备份文件: $BACKUP_FILE"
    echo "目标数据库: $LOCAL_DB_URL"
    
    # 清理现有数据
    echo "🧹 清理现有数据..."
    docker exec -i whisper_postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c "
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO $LOCAL_DB_USER;
        GRANT ALL ON SCHEMA public TO public;
    "
    
    # 恢复数据
    echo "📥 恢复数据..."
    docker exec -i whisper_postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME < "$BACKUP_FILE"
    
    echo "✅ 数据恢复完成"
}

# 直接迁移
migrate_direct() {
    SOURCE_URL=$2
    if [ -z "$SOURCE_URL" ]; then
        echo "❌ 请提供源数据库 URL"
        exit 1
    fi
    
    ensure_local_db
    
    echo "🔄 直接从源数据库迁移到本地数据库..."
    echo "源数据库: $SOURCE_URL"
    echo "目标数据库: $LOCAL_DB_URL"
    
    # 创建临时备份
    TEMP_BACKUP="temp_migration_$(date +%Y%m%d_%H%M%S).sql"
    
    echo "📥 创建临时备份..."
    if command -v pg_dump &> /dev/null; then
        pg_dump "$SOURCE_URL" > "$TEMP_BACKUP"
    else
        docker run --rm -v $(pwd):/backup postgres:16-alpine pg_dump "$SOURCE_URL" > "$TEMP_BACKUP"
    fi
    
    # 恢复到本地数据库
    restore_backup restore "$TEMP_BACKUP"
    
    # 清理临时文件
    rm "$TEMP_BACKUP"
    
    echo "✅ 迁移完成"
}

# 架构差异比较
schema_diff() {
    echo "🔍 比较数据库架构差异..."
    
    # 使用 Prisma 生成架构
    echo "📊 生成当前 Prisma 架构..."
    npx prisma db push --preview-feature
    
    echo "📋 当前本地数据库表："
    docker exec whisper_postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c "
        SELECT schemaname, tablename, tableowner 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    "
}

# 重置本地数据库
reset_local_db() {
    ensure_local_db
    
    echo "⚠️  警告: 这将删除所有本地数据库数据！"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 操作已取消"
        exit 1
    fi
    
    echo "🔄 重置本地数据库..."
    
    # 删除所有表
    docker exec whisper_postgres psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c "
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO $LOCAL_DB_USER;
        GRANT ALL ON SCHEMA public TO public;
    "
    
    # 重新应用 Prisma 架构
    echo "📊 重新应用 Prisma 架构..."
    npx prisma db push
    
    echo "✅ 本地数据库重置完成"
}

# 执行对应的操作
case $ACTION in
    backup)
        create_backup "$@"
        ;;
    restore)
        restore_backup "$@"
        ;;
    migrate)
        migrate_direct "$@"
        ;;
    schema-diff)
        schema_diff
        ;;
    reset)
        reset_local_db
        ;;
    *)
        echo "❌ 未知操作: $ACTION"
        echo "使用 $0 查看帮助"
        exit 1
        ;;
esac
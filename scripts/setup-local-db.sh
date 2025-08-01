#!/bin/bash

# 本地数据库设置脚本
# 用于初始化本地 PostgreSQL 数据库环境

set -e

echo "🚀 开始设置本地 PostgreSQL 数据库环境..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose 未安装，请先安装 docker-compose"
    exit 1
fi

# 启动数据库服务
echo "📦 启动 PostgreSQL、Redis 和 MinIO 服务..."
docker-compose up -d postgres redis minio minio_init

# 等待数据库启动
echo "⏳ 等待数据库服务启动..."
sleep 15

# 检查数据库连接
echo "🔍 检查数据库连接..."
if docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db; then
    echo "✅ PostgreSQL 连接成功"
else
    echo "❌ PostgreSQL 连接失败"
    exit 1
fi

# 检查 Redis 连接
echo "🔍 检查 Redis 连接..."
if docker exec whisper_redis redis-cli -a redis123 ping | grep -q PONG; then
    echo "✅ Redis 连接成功"
else
    echo "❌ Redis 连接失败"
    exit 1
fi

# 生成 Prisma 客户端
echo "🔧 生成 Prisma 客户端..."
npm run build > /dev/null 2>&1 || {
    echo "⚠️ Prisma 客户端生成失败，请检查 package.json 中的构建脚本"
}

# 推送数据库架构
echo "📊 推送数据库架构..."
npx prisma db push

# 检查数据库表是否创建成功
echo "🔍 验证数据库表..."
TABLES=$(docker exec whisper_postgres psql -U whisper_user -d whisper_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" | grep -v '^ *$' | wc -l)
if [ "$TABLES" -gt 0 ]; then
    echo "✅ 数据库表创建成功 ($TABLES 个表)"
else
    echo "❌ 数据库表创建失败"
    exit 1
fi

echo ""
echo "🎉 本地数据库环境设置完成！"
echo ""
echo "📋 服务信息："
echo "   PostgreSQL: localhost:5432"
echo "   数据库名: whisper_db"
echo "   用户名: whisper_user"
echo "   密码: whisper_password"
echo ""
echo "   Redis: localhost:6379"
echo "   密码: redis123"
echo ""
echo "   MinIO API: http://localhost:9000"
echo "   MinIO Console: http://localhost:9001"
echo "   用户名: minioadmin"
echo "   密码: minioadmin123"
echo ""
echo "🔧 有用的命令："
echo "   查看服务状态: docker-compose ps"
echo "   查看日志: docker-compose logs [service-name]"
echo "   停止服务: docker-compose down"
echo "   打开 Prisma Studio: npm run studio"
echo ""
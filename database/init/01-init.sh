#!/bin/bash
# PostgreSQL 初始化脚本
# 这个脚本会在数据库容器首次启动时自动执行

set -e

# 创建数据库扩展
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 启用 UUID 扩展
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- 启用 pg_trgm 扩展用于模糊搜索
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    
    -- 启用 unaccent 扩展用于忽略重音符号的搜索
    CREATE EXTENSION IF NOT EXISTS "unaccent";
    
    -- 设置默认时区
    SET timezone = 'UTC';
    
    -- 创建用于全文搜索的配置
    CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS simple_unaccent (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION simple_unaccent
        ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
        WITH unaccent, simple;
    
    GRANT ALL PRIVILEGES ON DATABASE whisper_db TO whisper_user;
EOSQL

echo "PostgreSQL 初始化完成"
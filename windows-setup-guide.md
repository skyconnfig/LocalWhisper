# Windows本地部署完整安装指南

> 本指南提供Windows环境下MinIO、PostgreSQL和Redis的详细安装配置教程，助您快速搭建Whisper App本地运行环境。

## 📋 目录

- [系统要求](#系统要求)
- [MinIO安装配置](#minio安装配置)
- [PostgreSQL安装配置](#postgresql安装配置)
- [Redis安装配置](#redis安装配置)
- [环境验证](#环境验证)
- [常见问题](#常见问题)

---

## 🖥️ 系统要求

### 最低配置
- **操作系统**：Windows 10 或 Windows 11 (64位)
- **内存**：8GB RAM
- **存储空间**：10GB 可用空间
- **网络**：互联网连接（用于下载安装包）

### 推荐配置
- **操作系统**：Windows 11 (64位)
- **内存**：16GB RAM 或更多
- **存储空间**：20GB+ 可用空间（SSD推荐）
- **处理器**：Intel i5 或 AMD Ryzen 5 及以上

---

## 📦 MinIO安装配置

MinIO是一个高性能的对象存储服务，兼容Amazon S3 API，用于替代AWS S3进行本地文件存储。

### 1. 下载MinIO

#### 方法一：官方下载
1. 访问 [MinIO官网](https://min.io/download)
2. 选择 **Windows** 平台
3. 下载 `minio.exe` 文件

#### 方法二：命令行下载
```powershell
# 使用PowerShell下载
Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile "minio.exe"
```

### 2. 创建MinIO目录结构

```powershell
# 创建MinIO工作目录
mkdir C:\minio
mkdir C:\minio\data
mkdir C:\minio\config

# 将minio.exe移动到工作目录
move minio.exe C:\minio\
```

### 3. 配置MinIO环境变量

#### 使用PowerShell配置：
```powershell
# 设置MinIO访问密钥
[Environment]::SetEnvironmentVariable("MINIO_ROOT_USER", "minioadmin", "User")
[Environment]::SetEnvironmentVariable("MINIO_ROOT_PASSWORD", "minioadmin123", "User")

# 设置MinIO数据目录
[Environment]::SetEnvironmentVariable("MINIO_DATA_DIR", "C:\minio\data", "User")
```

#### 使用图形界面配置：
1. 右键 **此电脑** → **属性**
2. 点击 **高级系统设置**
3. 点击 **环境变量**
4. 在 **用户变量** 中点击 **新建**，添加：
   - `MINIO_ROOT_USER` = `minioadmin`
   - `MINIO_ROOT_PASSWORD` = `minioadmin123`
   - `MINIO_DATA_DIR` = `C:\minio\data`

### 4. 启动MinIO服务

```powershell
# 进入MinIO目录
cd C:\minio

# 启动MinIO服务器
.\minio.exe server C:\minio\data --console-address ":9001"
```

### 5. 验证MinIO安装

1. **MinIO API服务**：打开浏览器访问 http://localhost:9000
2. **MinIO控制台**：打开浏览器访问 http://localhost:9001
3. 使用默认凭据登录：
   - **用户名**：`minioadmin`
   - **密码**：`minioadmin123`

### 6. 创建Windows服务（可选）

创建 `install-minio-service.bat` 文件：
```batch
@echo off
sc create MinIO binPath= "C:\minio\minio.exe server C:\minio\data --console-address :9001" start= auto
sc description MinIO "MinIO Object Storage Server"
echo MinIO服务已安装
pause
```

---

## 🐘 PostgreSQL安装配置

PostgreSQL是一个功能强大的开源关系数据库系统，用于存储应用数据。

### 1. 下载PostgreSQL

1. 访问 [PostgreSQL官网](https://www.postgresql.org/download/windows/)
2. 点击 **Download the installer**
3. 选择最新版本（推荐PostgreSQL 15或16）
4. 下载Windows x86-64安装包

### 2. 安装PostgreSQL

1. **运行安装程序**：右键安装包，选择 **以管理员身份运行**
2. **选择安装目录**：默认 `C:\Program Files\PostgreSQL\15`
3. **选择组件**：
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4（图形管理工具）
   - ✅ Stack Builder（可选）
   - ✅ Command Line Tools
4. **设置数据目录**：默认 `C:\Program Files\PostgreSQL\15\data`
5. **设置超级用户密码**：**重要**！请记住此密码，推荐设置为 `postgres123`
6. **设置端口**：默认 `5432`
7. **选择区域设置**：选择 `Chinese (Simplified), China` 或保持默认
8. 完成安装

### 3. 配置PostgreSQL

#### 环境变量配置
1. 将PostgreSQL bin目录添加到PATH：
   - `C:\Program Files\PostgreSQL\15\bin`

#### 使用PowerShell配置：
```powershell
# 添加PostgreSQL到PATH
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```

### 4. 创建Whisper数据库

#### 方法一：使用pgAdmin图形界面
1. 打开 **pgAdmin 4**
2. 连接到本地PostgreSQL服务器
3. 右键 **Databases** → **Create** → **Database**
4. 数据库名称：`whisper`
5. 所有者：`postgres`
6. 点击 **Save**

#### 方法二：使用命令行
```powershell
# 连接到PostgreSQL
psql -U postgres -h localhost

# 创建数据库
CREATE DATABASE whisper;

# 创建专用用户
CREATE USER whisper_user WITH PASSWORD 'whisper123';

# 授权
GRANT ALL PRIVILEGES ON DATABASE whisper TO whisper_user;

# 退出
\q
```

### 5. 验证PostgreSQL安装

```powershell
# 测试连接
psql -U postgres -h localhost -d whisper

# 如果成功，会看到类似输出：
# whisper=#
```

---

## 🔴 Redis安装配置

Redis是一个内存数据结构存储系统，用于缓存和限流。

### 1. 下载Redis

由于Redis官方不直接支持Windows，我们使用Microsoft维护的版本：

1. 访问 [Microsoft Redis GitHub](https://github.com/microsoftarchive/redis/releases)
2. 下载最新版本的 `Redis-x64-*.msi` 文件

### 2. 安装Redis

1. **运行MSI安装包**：双击下载的文件
2. **选择安装路径**：默认 `C:\Program Files\Redis`
3. **配置选项**：
   - ✅ Add Redis to PATH
   - ✅ Install Redis as Windows Service
4. **设置最大内存**：默认或设置为系统内存的50%
5. 完成安装

### 3. 配置Redis

#### 编辑配置文件
1. 打开 `C:\Program Files\Redis\redis.windows.conf`
2. 修改以下配置：

```conf
# 绑定所有网络接口（开发环境）
bind 0.0.0.0

# 设置密码（可选，生产环境推荐）
# requirepass redis123

# 设置最大内存
maxmemory 2gb
maxmemory-policy allkeys-lru

# 持久化配置
save 900 1
save 300 10
save 60 10000

# 日志级别
loglevel notice
logfile "C:/Program Files/Redis/redis.log"
```

### 4. 启动Redis服务

#### 方法一：Windows服务管理
1. 按 `Win + R`，输入 `services.msc`
2. 找到 **Redis** 服务
3. 右键选择 **启动**

#### 方法二：命令行启动
```powershell
# 启动Redis服务器
redis-server "C:\Program Files\Redis\redis.windows.conf"
```

### 5. 验证Redis安装

```powershell
# 连接到Redis
redis-cli

# 测试基本操作
127.0.0.1:6379> ping
PONG

127.0.0.1:6379> set test "Hello Redis"
OK

127.0.0.1:6379> get test
"Hello Redis"

127.0.0.1:6379> exit
```

---

## ✅ 环境验证

### 创建验证脚本

创建 `verify-setup.ps1` PowerShell脚本：

```powershell
Write-Host "=== Whisper App 环境验证脚本 ===" -ForegroundColor Green

# 验证MinIO
Write-Host "`n1. 验证MinIO..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9000/minio/health/live" -TimeoutSec 5
    Write-Host "✅ MinIO服务正常运行" -ForegroundColor Green
} catch {
    Write-Host "❌ MinIO服务未运行" -ForegroundColor Red
    Write-Host "请启动MinIO: C:\minio\minio.exe server C:\minio\data --console-address :9001"
}

# 验证PostgreSQL
Write-Host "`n2. 验证PostgreSQL..." -ForegroundColor Yellow
try {
    $result = psql -U postgres -h localhost -d whisper -c "SELECT version();" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL服务正常运行" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL连接失败" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ PostgreSQL未安装或未运行" -ForegroundColor Red
}

# 验证Redis
Write-Host "`n3. 验证Redis..." -ForegroundColor Yellow
try {
    $result = redis-cli ping 2>$null
    if ($result -eq "PONG") {
        Write-Host "✅ Redis服务正常运行" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis连接失败" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis未安装或未运行" -ForegroundColor Red
}

Write-Host "`n=== 验证完成 ===" -ForegroundColor Green
Write-Host "如果所有服务都正常，您可以继续部署Whisper App"
```

运行验证：
```powershell
PowerShell -ExecutionPolicy Bypass -File verify-setup.ps1
```

### 预期输出
```
=== Whisper App 环境验证脚本 ===

1. 验证MinIO...
✅ MinIO服务正常运行

2. 验证PostgreSQL...
✅ PostgreSQL服务正常运行

3. 验证Redis...
✅ Redis服务正常运行

=== 验证完成 ===
如果所有服务都正常，您可以继续部署Whisper App
```

---

## 🔧 集成配置

### Whisper App环境变量配置

创建 `.env.local` 文件：
```bash
# 数据库配置
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/whisper"

# Redis配置
REDIS_URL="redis://localhost:6379"

# MinIO配置
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_BUCKET_NAME="whisper-audio"

# 本地文件存储
UPLOAD_PATH="./uploads"
WHISPER_MODEL_PATH="./models"

# 应用配置
NODE_ENV="development"
PORT="3000"
```

### 数据库连接测试代码

创建 `test-connections.js` 测试文件：
```javascript
// 测试PostgreSQL连接
const { Pool } = require('pg');

const pgPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'whisper',
  password: 'postgres123',
  port: 5432,
});

async function testPostgreSQL() {
  try {
    const client = await pgPool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL连接成功:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL连接失败:', err.message);
  }
}

// 测试Redis连接
const redis = require('redis');
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});

async function testRedis() {
  try {
    await redisClient.connect();
    await redisClient.set('test', 'Hello Redis');
    const value = await redisClient.get('test');
    console.log('✅ Redis连接成功:', value);
    await redisClient.disconnect();
  } catch (err) {
    console.error('❌ Redis连接失败:', err.message);
  }
}

// 测试MinIO连接
const { Client } = require('minio');

const minioClient = new Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin123'
});

async function testMinIO() {
  try {
    const buckets = await minioClient.listBuckets();
    console.log('✅ MinIO连接成功，存储桶列表:', buckets);
  } catch (err) {
    console.error('❌ MinIO连接失败:', err.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('开始测试所有连接...\n');
  await testPostgreSQL();
  await testRedis();
  await testMinIO();
  console.log('\n测试完成！');
  process.exit(0);
}

runAllTests();
```

运行测试：
```powershell
npm install pg redis minio
node test-connections.js
```

---

## 🚨 常见问题

### MinIO相关问题

**Q: MinIO启动失败，提示端口被占用**
```powershell
# 检查端口占用
netstat -ano | findstr :9000
netstat -ano | findstr :9001

# 终止占用进程
taskkill /PID <进程ID> /F

# 或更换端口启动
.\minio.exe server C:\minio\data --address :9002 --console-address :9003
```

**Q: 无法访问MinIO控制台**
- 检查防火墙设置
- 确认服务已启动
- 尝试使用127.0.0.1替代localhost

### PostgreSQL相关问题

**Q: psql命令未找到**
```powershell
# 检查PATH环境变量
echo $env:PATH

# 手动添加PostgreSQL bin目录
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"
```

**Q: 密码认证失败**
```powershell
# 重置postgres用户密码
# 1. 编辑 pg_hba.conf 文件
# 2. 将 md5 改为 trust
# 3. 重启PostgreSQL服务
# 4. 使用ALTER USER重设密码
ALTER USER postgres PASSWORD '新密码';
```

**Q: 连接被拒绝**
- 检查PostgreSQL服务是否运行
- 检查防火墙设置
- 验证端口5432是否开放

### Redis相关问题

**Q: Redis服务无法启动**
```powershell
# 检查Windows服务
services.msc

# 手动启动服务
net start redis
```

**Q: 内存不足错误**
- 编辑redis.conf文件
- 设置maxmemory参数
- 重启Redis服务

### 通用网络问题

**Q: 防火墙阻止连接**
```powershell
# 添加防火墙规则
netsh advfirewall firewall add rule name="MinIO" dir=in action=allow protocol=TCP localport=9000,9001
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
netsh advfirewall firewall add rule name="Redis" dir=in action=allow protocol=TCP localport=6379
```

---

## 🎯 下一步

完成所有服务安装后，您可以：

1. **部署Whisper App**：参考主项目README进行应用部署
2. **配置AI模型**：按照task.md中的模型推荐进行配置
3. **性能优化**：根据实际使用情况调整各服务配置
4. **数据备份**：设置定期备份策略

## 📞 技术支持

如果遇到安装问题：
1. 检查系统要求是否满足
2. 查看相关服务的日志文件
3. 运行环境验证脚本
4. 参考常见问题解决方案

---

*文档更新时间：2025-08-01*
*适用版本：MinIO Latest, PostgreSQL 15+, Redis 5+*
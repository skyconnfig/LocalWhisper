# Whisper App 故障排除指南

本指南提供常见问题的诊断和解决方案，帮助您快速解决使用过程中遇到的问题。

## 📋 目录

1. [快速诊断](#快速诊断)
2. [部署相关问题](#部署相关问题)
3. [服务连接问题](#服务连接问题)
4. [转录功能问题](#转录功能问题)
5. [AI处理问题](#AI处理问题)
6. [文件上传问题](#文件上传问题)
7. [用户认证问题](#用户认证问题)
8. [性能优化问题](#性能优化问题)
9. [数据管理问题](#数据管理问题)
10. [高级故障排除](#高级故障排除)

## 🔍 快速诊断

### 健康检查脚本

首先运行系统健康检查来识别问题：

```bash
# 运行健康检查脚本
./scripts/management/health-check.sh

# 或手动检查各个服务
curl http://localhost:3000/api/health
docker-compose ps
```

### 常见问题自检清单

- [ ] 所有Docker容器都在运行
- [ ] 端口没有被其他服务占用
- [ ] 环境变量配置正确
- [ ] 磁盘空间充足
- [ ] 网络连接正常

## 🚀 部署相关问题

### Docker服务启动失败

**问题**: Docker容器无法启动

**原因分析**:
```bash
# 查看容器状态
docker-compose ps

# 查看启动日志
docker-compose logs [service-name]

# 查看系统资源
docker system df
```

**解决方案**:

1. **重启Docker服务**
```bash
sudo systemctl restart docker
docker-compose down
docker-compose up -d
```

2. **清理Docker资源**
```bash
# 清理停止的容器
docker container prune -f

# 清理未使用的镜像
docker image prune -f

# 清理未使用的卷
docker volume prune -f
```

3. **检查磁盘空间**
```bash
df -h
# 如果磁盘空间不足，清理日志和临时文件
sudo journalctl --vacuum-time=7d
```

### 端口冲突问题

**问题**: 服务端口被占用

**诊断**:
```bash
# 检查端口占用
netstat -tlnp | grep :3000
netstat -tlnp | grep :5432
netstat -tlnp | grep :6379
netstat -tlnp | grep :9000
netstat -tlnp | grep :11434
```

**解决方案**:

1. **停止占用端口的进程**
```bash
# 找到占用进程的PID
lsof -i :3000

# 停止进程
sudo kill -9 <PID>
```

2. **修改端口配置**
```bash
# 编辑 docker-compose.yml
nano docker-compose.yml

# 修改端口映射，例如：
# - "13000:3000"  # 将主机端口改为13000
```

### 环境变量配置错误

**问题**: 应用因环境变量配置错误无法启动

**诊断**:
```bash
# 检查环境变量文件
cat .env.local

# 验证数据库连接字符串
echo $DATABASE_URL
```

**解决方案**:
```bash
# 重新复制配置模板
cp config/env.template .env.local

# 编辑配置文件
nano .env.local

# 确保必需的变量都已设置：
# - DATABASE_URL
# - REDIS_URL  
# - NEXTAUTH_SECRET
# - MINIO_ENDPOINT
```

## 🔗 服务连接问题

### 数据库连接失败

**问题**: 应用无法连接到PostgreSQL数据库

**诊断**:
```bash
# 测试数据库连接
docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db

# 查看数据库日志
docker-compose logs postgres

# 手动连接测试
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db
```

**解决方案**:

1. **重启数据库服务**
```bash
docker-compose restart postgres
# 等待服务完全启动
sleep 10
```

2. **重置数据库**
```bash
docker-compose down
docker volume rm whisper_postgres_data
docker-compose up -d postgres
# 等待启动完成后推送schema
npx prisma db push
```

3. **检查连接字符串**
```bash
# 确保DATABASE_URL格式正确
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"
```

### Redis连接失败

**问题**: Redis缓存服务连接失败

**诊断**:
```bash
# 测试Redis连接
docker exec whisper_redis redis-cli -a redis123 ping

# 查看Redis日志
docker-compose logs redis
```

**解决方案**:
```bash
# 重启Redis服务
docker-compose restart redis

# 清理Redis数据（如果需要）
docker exec whisper_redis redis-cli -a redis123 FLUSHALL
```

### MinIO存储连接失败

**问题**: 对象存储服务无法访问

**诊断**:
```bash
# 测试MinIO健康状态
curl http://localhost:9000/minio/health/live

# 查看MinIO日志
docker-compose logs minio

# 检查存储桶
docker exec whisper_minio mc ls myminio/
```

**解决方案**:

1. **重新初始化MinIO**
```bash
docker-compose restart minio minio_init
# 检查存储桶是否创建成功
curl http://localhost:9001  # 访问控制台
```

2. **手动创建存储桶**
```bash
# 进入MinIO容器
docker exec -it whisper_minio sh

# 使用mc命令创建存储桶
mc mb /data/audio-files
mc mb /data/temp-files
```

## 🎤 转录功能问题

### Whisper模型无法加载

**问题**: 语音转录失败，模型加载错误

**诊断**:
```bash
# 检查Ollama服务状态
curl http://localhost:11434/api/tags

# 查看Ollama日志
docker-compose logs ollama

# 列出已安装的模型
docker exec whisper_ollama ollama list
```

**解决方案**:

1. **重新下载Whisper模型**
```bash
# 删除旧模型（如果存在问题）
docker exec whisper_ollama ollama rm whisper:latest

# 重新下载
docker exec whisper_ollama ollama pull whisper:latest

# 验证下载
docker exec whisper_ollama ollama list
```

2. **检查模型文件完整性**
```bash
# 查看模型存储空间
docker exec whisper_ollama du -sh ~/.ollama/models/

# 如果空间不足，清理其他不需要的模型
docker exec whisper_ollama ollama rm unused-model
```

### 转录质量问题

**问题**: 转录结果质量差或不准确

**解决方案**:

1. **音频文件预处理**
```bash
# 使用ffmpeg改善音频质量
ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a wav output.wav

# 降噪处理
ffmpeg -i input.wav -af "highpass=f=200, lowpass=f=3000" output_clean.wav
```

2. **调整转录参数**
```javascript
// 在转录请求中指定更高质量的模型
const transcriptionOptions = {
  model: 'whisper:medium',  // 使用medium或large模型
  language: 'zh',           // 指定语言以提高准确性
  temperature: 0.1,         // 降低随机性
};
```

3. **分段处理长音频**
```bash
# 将长音频分割为小段
ffmpeg -i long_audio.mp3 -f segment -segment_time 300 -c copy segment_%03d.mp3
```

### 转录速度慢

**问题**: 转录处理时间过长

**诊断**:
```bash
# 检查系统资源使用
docker stats
htop

# 检查模型大小
docker exec whisper_ollama ollama list
```

**解决方案**:

1. **使用更小的模型**
```bash
# 下载并使用base模型
docker exec whisper_ollama ollama pull whisper:base
```

2. **启用GPU加速**
```bash
# 修改docker-compose.yml
# 取消GPU相关配置的注释
runtime: nvidia
environment:
  - NVIDIA_VISIBLE_DEVICES=all
```

3. **优化系统资源**
```bash
# 增加Docker内存限制
# 编辑 /etc/docker/daemon.json
{
  "default-runtime": "runc",
  "default-ulimits": {
    "memlock": {"hard": -1, "soft": -1}
  }
}
```

## 🤖 AI处理问题

### LLM服务连接失败

**问题**: AI文本处理功能无法使用

**诊断**:
```bash
# 测试LLM服务
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Hello"
}'

# 检查模型状态
docker exec whisper_ollama ollama list
```

**解决方案**:

1. **重新下载LLM模型**
```bash
# 下载默认LLM模型
docker exec whisper_ollama ollama pull llama3.1:8b

# 或使用更小的模型
docker exec whisper_ollama ollama pull llama3.1:latest
```

2. **测试模型功能**
```bash
# 简单测试
docker exec whisper_ollama ollama run llama3.1:8b "Summarize this text"
```

### AI处理结果质量差

**问题**: AI生成的内容质量不理想

**解决方案**:

1. **优化提示词**
```javascript
// 使用更具体的提示
const prompt = `请按照以下格式总结这段文字：
1. 主要观点：
2. 关键信息：
3. 结论：

文字内容：${transcriptionText}`;
```

2. **调整模型参数**
```javascript
const options = {
  temperature: 0.3,    // 降低随机性
  top_p: 0.8,         // 限制词汇选择范围
  max_tokens: 1000,   // 限制输出长度
};
```

### AI处理超时

**问题**: AI处理请求超时

**诊断**:
```bash
# 检查服务响应时间
time curl http://localhost:11434/api/tags

# 监控资源使用
docker stats whisper_ollama
```

**解决方案**:
```bash
# 增加超时时间配置
# 在.env.local中添加
LLM_TIMEOUT=300000  # 5分钟超时

# 或使用更快的模型
docker exec whisper_ollama ollama pull llama3.1:8b
```

## 📁 文件上传问题

### 文件格式不支持

**问题**: 音频文件上传失败

**诊断**:
```bash
# 检查文件格式
ffprobe your-audio-file.xxx

# 查看支持的格式列表
grep ALLOWED_AUDIO_FORMATS .env.local
```

**解决方案**:

1. **转换文件格式**
```bash
# 转换为支持的格式
ffmpeg -i input.xxx -acodec mp3 output.mp3
ffmpeg -i input.xxx -acodec wav output.wav
```

2. **更新支持的格式列表**
```bash
# 在.env.local中添加格式
ALLOWED_AUDIO_FORMATS="mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4,your-format"
```

### 文件太大

**问题**: 文件超过大小限制

**解决方案**:

1. **压缩音频文件**
```bash
# 降低比特率
ffmpeg -i input.wav -ab 128k output.mp3

# 降低采样率
ffmpeg -i input.wav -ar 22050 output.wav
```

2. **调整大小限制**
```bash
# 在.env.local中修改
MAX_FILE_SIZE="200MB"  # 增加到200MB
```

### 上传进度卡住

**问题**: 文件上传过程中卡住

**诊断**:
```bash
# 检查网络连接
ping localhost

# 检查磁盘空间
df -h

# 查看上传日志
docker-compose logs app
```

**解决方案**:
```bash
# 重启相关服务
docker-compose restart app minio

# 清理临时文件
docker exec whisper_minio find /data -name "*.tmp" -delete
```

## 👤 用户认证问题

### 登录失败

**问题**: 用户无法登录或注册

**诊断**:
```bash
# 检查NextAuth配置
grep NEXTAUTH .env.local

# 查看应用日志
docker-compose logs app | grep auth
```

**解决方案**:

1. **重置NextAuth密钥**
```bash
# 生成新的秘钥
openssl rand -base64 32

# 更新.env.local
NEXTAUTH_SECRET="your-new-secret-here"
```

2. **清理认证数据**
```bash
# 清理浏览器数据
# 或使用无痕模式测试

# 重置数据库用户表（谨慎操作）
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db -c "TRUNCATE TABLE \"User\", \"Account\", \"Session\" CASCADE;"
```

### 会话过期问题

**问题**: 用户频繁被要求重新登录

**解决方案**:
```bash
# 调整会话配置
# 在.env.local中添加
NEXTAUTH_SESSION_MAXAGE=30d  # 30天有效期
```

## ⚡ 性能优化问题

### 系统响应慢

**问题**: 应用整体响应速度慢

**诊断**:
```bash
# 检查系统资源
htop
iotop
docker stats

# 检查数据库性能
docker exec whisper_postgres pg_stat_activity
```

**解决方案**:

1. **优化数据库**
```sql
-- 连接到数据库
-- 分析慢查询
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- 重建索引
REINDEX DATABASE whisper_db;
```

2. **清理缓存**
```bash
# 清理Redis缓存
docker exec whisper_redis redis-cli -a redis123 FLUSHALL

# 清理应用缓存
rm -rf .next/cache
npm run build
```

3. **调整资源限制**
```yaml
# 在docker-compose.yml中增加资源限制
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### 内存使用过高

**问题**: 服务占用内存过多

**解决方案**:
```bash
# 限制AI模型内存使用
docker exec whisper_ollama ollama pull llama3.1:8b  # 使用更小的模型

# 调整PostgreSQL内存设置
# 编辑数据库配置
echo "shared_buffers = 128MB" >> postgresql.conf
echo "effective_cache_size = 512MB" >> postgresql.conf

# 重启服务
docker-compose restart postgres
```

## 💾 数据管理问题

### 数据丢失

**问题**: 转录记录或用户数据丢失

**解决方案**:

1. **检查数据备份**
```bash
# 查看现有备份
ls -la backups/

# 恢复最近的备份
./scripts/backup.sh restore latest
```

2. **检查数据库状态**
```bash
# 连接数据库检查数据
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db

# 查看表数据
\dt
SELECT COUNT(*) FROM "Whisper";
SELECT COUNT(*) FROM "User";
```

### 存储空间不足

**问题**: 磁盘空间不足导致服务异常

**解决方案**:
```bash
# 清理旧的转录文件
node scripts/cleanup-old-files.js

# 清理Docker资源
docker system prune -a -f

# 清理日志文件
sudo journalctl --vacuum-time=7d

# 压缩数据库
docker exec whisper_postgres pg_dump -U whisper_user whisper_db | gzip > backup.sql.gz
```

## 🔬 高级故障排除

### 深度日志分析

```bash
# 收集所有服务日志
mkdir -p debug_logs
docker-compose logs --no-color > debug_logs/all_services.log
docker-compose logs app --no-color > debug_logs/app.log
docker-compose logs postgres --no-color > debug_logs/postgres.log
docker-compose logs ollama --no-color > debug_logs/ollama.log

# 分析错误模式
grep -i error debug_logs/*.log
grep -i failed debug_logs/*.log
grep -i timeout debug_logs/*.log
```

### 网络连接诊断

```bash
# 测试容器间网络连接
docker exec whisper_app ping postgres
docker exec whisper_app ping redis
docker exec whisper_app ping minio
docker exec whisper_app ping ollama

# 检查DNS解析
docker exec whisper_app nslookup postgres
```

### 性能分析

```bash
# 生成性能报告
docker stats --no-stream > performance_report.txt
free -h >> performance_report.txt
df -h >> performance_report.txt
lscpu >> performance_report.txt

# 数据库性能分析
docker exec whisper_postgres pg_stat_activity > db_activity.txt
```

### 完整系统重置

如果所有方法都无效，可以执行完整重置：

```bash
# ⚠️ 警告：这将删除所有数据！
# 停止所有服务
docker-compose down

# 删除所有卷（数据将丢失）
docker volume rm $(docker volume ls -q | grep whisper)

# 删除所有镜像
docker rmi $(docker images -q | grep whisper)

# 清理系统
docker system prune -a -f

# 重新部署
./deploy.sh
```

## 📞 获取额外帮助

### 日志收集

在寻求帮助时，请提供以下信息：

```bash
# 创建诊断报告
./scripts/management/generate-diagnostic-report.sh

# 或手动收集信息
echo "=== System Info ===" > diagnostic_report.txt
uname -a >> diagnostic_report.txt
docker --version >> diagnostic_report.txt
docker-compose --version >> diagnostic_report.txt

echo "=== Service Status ===" >> diagnostic_report.txt
docker-compose ps >> diagnostic_report.txt

echo "=== Recent Logs ===" >> diagnostic_report.txt
docker-compose logs --tail=50 >> diagnostic_report.txt
```

### 社区支持

- **GitHub Issues**: 技术问题和Bug报告
- **Discussions**: 使用问题和经验分享
- **Documentation**: 查看最新文档更新

### 紧急恢复

如果系统完全无法使用：

1. **保存重要数据**
```bash
# 导出数据库
docker exec whisper_postgres pg_dump -U whisper_user whisper_db > emergency_backup.sql

# 备份配置文件
cp .env.local .env.local.backup
```

2. **使用备用部署方式**
```bash
# 使用开发模式快速启动
npm run dev
```

3. **联系支持团队**
   - 提供详细的错误描述
   - 附上诊断报告
   - 说明复现步骤

---

**希望这个故障排除指南能帮助您快速解决问题！** 🛠️

如果问题仍未解决，请查看 [API文档](./API_REFERENCE.md) 或联系 [技术支持](../README.md#获取帮助)。
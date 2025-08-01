# Whisper App 常见问题解答 (FAQ)

本文档收集了用户在使用 Whisper App 过程中最常遇到的问题和解决方案，帮助您快速解决使用中的疑问。

## 📋 目录

1. [安装和部署问题](#安装和部署问题)
2. [文件上传问题](#文件上传问题)
3. [转录功能问题](#转录功能问题)
4. [AI处理问题](#AI处理问题)
5. [账户和认证问题](#账户和认证问题)
6. [性能和速度问题](#性能和速度问题)
7. [数据安全和隐私](#数据安全和隐私)
8. [高级功能问题](#高级功能问题)
9. [故障排除](#故障排除)
10. [技术支持](#技术支持)

---

## 🚀 安装和部署问题

### Q: 系统最低配置要求是什么？

**A**: 推荐配置如下：
- **内存**: 8GB RAM（最低4GB）
- **存储**: 20GB可用空间（推荐50GB+）
- **CPU**: 4核心处理器（推荐8核心+）
- **操作系统**: Linux、macOS、Windows (WSL2)
- **软件**: Docker 20.10+、Docker Compose 2.0+、Node.js 18+

### Q: 可以在Windows上直接运行吗？

**A**: 推荐在Windows上使用WSL2环境：
1. 安装WSL2和Ubuntu
2. 在WSL2中安装Docker Desktop
3. 按照Linux环境的步骤部署
4. 通过Windows浏览器访问 `http://localhost:3000`

### Q: 部署过程中出现端口冲突怎么办？

**A**: 修改 `docker-compose.yml` 中的端口映射：
```yaml
# 例如将主应用端口改为8080
app:
  ports:
    - "8080:3000"  # 主机端口:容器端口
```
然后访问 `http://localhost:8080`

### Q: 一键部署脚本失败怎么办？

**A**: 按以下步骤排查：
1. 检查Docker是否正常运行：`docker --version`
2. 检查端口是否被占用：`netstat -tlnp | grep :3000`
3. 查看部署日志：`./deploy.sh 2>&1 | tee deploy.log`
4. 如果仍有问题，请查看 [故障排除指南](../main/TROUBLESHOOTING_GUIDE.md)

### Q: 如何更新到最新版本？

**A**: 执行以下命令：
```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose build --no-cache
docker-compose down && docker-compose up -d

# 应用数据库迁移（如果有）
docker-compose exec app npx prisma db push
```

---

## 📁 文件上传问题

### Q: 支持哪些音频格式？

**A**: 支持以下格式：
- **推荐格式**: WAV, FLAC（质量最佳）
- **常用格式**: MP3, M4A, AAC
- **其他格式**: OGG, WMA, WebM, MP4

### Q: 文件大小限制是多少？

**A**: 
- **默认限制**: 100MB
- **推荐大小**: 50MB以下（处理速度更快）
- **修改限制**: 在 `.env.local` 中设置 `MAX_FILE_SIZE=200MB`

### Q: 上传后文件丢失怎么办？

**A**: 检查以下几点：
1. **查看上传状态**: 确认上传是否完成
2. **检查存储空间**: 确保磁盘空间充足
3. **查看错误日志**: `docker-compose logs app | grep -i error`
4. **检查MinIO服务**: 访问 `http://localhost:9001` 查看文件

### Q: 可以批量上传文件吗？

**A**: 可以，支持以下方式：
- **拖拽多选**: 同时选择多个文件拖拽到上传区域
- **批量选择**: 点击选择文件时按住Ctrl/Cmd多选
- **限制数量**: 单次最多上传10个文件

### Q: 上传速度很慢怎么办？

**A**: 尝试以下优化：
1. **压缩音频**: 使用较低的比特率
2. **检查网络**: 确保网络连接稳定
3. **减少并发**: 不要同时上传过多文件
4. **升级硬件**: 使用SSD存储提升I/O性能

---

## 🎤 转录功能问题

### Q: 转录质量不理想怎么办？

**A**: 提升转录质量的方法：

**音频质量方面**:
- 使用清晰、无噪音的录音
- 选择安静的录音环境
- 确保说话者距离麦克风适中

**设置优化**:
- 手动指定音频语言（而非自动检测）
- 使用更高质量的Whisper模型
- 尝试不同的音频格式

**文件预处理**:
```bash
# 使用ffmpeg优化音频
ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a wav output.wav
```

### Q: 支持哪些语言？

**A**: 支持80+种语言，包括：
- **中文**: 普通话、粤语等方言
- **英语**: 美式、英式英语
- **日语**: 标准日语
- **韩语**: 标准韩语
- **欧洲语言**: 法语、德语、西班牙语、意大利语等
- **其他**: 阿拉伯语、印地语、俄语等

### Q: 转录速度很慢怎么办？

**A**: 优化转录速度：

**模型选择**:
- 使用 `tiny` 或 `base` 模型（速度快，质量略低）
- 避免使用 `large-v3` 模型（质量高但速度慢）

**硬件优化**:
- 启用GPU加速（如果有NVIDIA显卡）
- 增加系统内存
- 使用更快的CPU

**系统配置**:
```bash
# 在.env.local中设置更快的模型
WHISPER_MODEL="whisper:base"
```

### Q: 如何处理多人对话？

**A**: 目前Whisper App将多人对话转录为连续文本，建议：
1. **预处理**: 使用音频编辑软件分离不同说话人
2. **后处理**: 手动编辑转录结果，添加说话人标识
3. **标记格式**: 
   ```
   张三：这是我的观点...
   李四：我认为...
   ```

### Q: 转录结果出现乱码怎么办？

**A**: 可能的原因和解决方案：
1. **语言检测错误**: 手动指定正确的音频语言
2. **音频质量差**: 使用更高质量的录音
3. **编码问题**: 确保音频文件编码正常
4. **模型问题**: 尝试重新下载Whisper模型

---

## 🤖 AI处理问题

### Q: AI处理结果不理想怎么办？

**A**: 优化AI处理结果：

**提示词优化**:
```
❌ 不好的提示: "总结一下"
✅ 好的提示: "请将这段会议录音总结为3-5个要点，每个要点不超过50字，重点关注决定事项和行动计划"
```

**添加上下文**:
```
"这是一段产品设计讨论的录音，参与者包括产品经理、设计师和开发工程师。请重点提取关于用户体验和技术实现的讨论内容。"
```

**分段处理**:
- 将长文本分成小段分别处理
- 每段处理后再综合整理

### Q: AI处理速度很慢怎么办？

**A**: 提升AI处理速度：

**模型优化**:
- 使用较小的LLM模型（如 `llama3.1:8b` 而非更大模型）
- 启用GPU加速
- 减少上下文长度

**文本优化**:
- 缩短输入文本长度
- 移除无关的转录内容
- 使用更简洁的提示词

### Q: 如何创建自定义AI模板？

**A**: 创建步骤：
1. **进入设置页面** > AI模板管理
2. **点击"新建模板"**
3. **填写模板信息**:
   ```
   模板名称: 会议纪要
   提示内容: 请将以下会议录音整理为结构化纪要：
   1. 会议主题
   2. 参与人员  
   3. 主要讨论点
   4. 决定事项
   5. 后续行动
   
   会议内容：{transcription}
   ```
4. **保存并测试**模板效果

### Q: AI处理超时怎么办？

**A**: 解决超时问题：
1. **缩短文本**: 将长文本分段处理
2. **简化提示**: 使用更简洁的提示词
3. **检查服务**: 确认Ollama服务正常运行
4. **调整超时**: 在 `.env.local` 中增加 `LLM_TIMEOUT=600000`

### Q: 支持哪些LLM模型？

**A**: 支持Ollama平台的所有模型：
- **通用模型**: llama3.1:8b, mistral:7b
- **中文优化**: qwen2:7b, baichuan2:7b  
- **代码专用**: codellama:7b
- **轻量模型**: phi3:mini, gemma:2b

下载新模型：
```bash
docker exec whisper_ollama ollama pull qwen2:7b
```

---

## 👤 账户和认证问题

### Q: 忘记密码怎么办？

**A**: 重置密码方法：
1. **暂不支持邮件重置**（本地部署版本）
2. **管理员重置**: 联系系统管理员重置
3. **数据库重置**: 
   ```bash
   # 删除用户记录（谨慎操作）
   docker exec -it whisper_postgres psql -U whisper_user -d whisper_db
   DELETE FROM "User" WHERE email = 'user@example.com';
   ```

### Q: 可以修改用户信息吗？

**A**: 可以在设置页面修改：
- **显示名称**: 随时可以修改
- **头像**: 上传新的头像图片
- **密码**: 输入当前密码后设置新密码
- **邮箱**: 暂不支持修改（技术限制）

### Q: 支持多用户吗？

**A**: 支持，每个用户的数据完全隔离：
- **独立存储**: 每个用户的转录记录独立
- **权限隔离**: 用户只能访问自己的数据
- **设置隔离**: 个人设置不影响其他用户

### Q: 如何删除账户？

**A**: 删除账户步骤：
1. **导出数据**: 在设置页面导出所有个人数据
2. **联系管理员**: 请求删除账户
3. **或者自行删除**:
   ```bash
   # 谨慎操作，数据无法恢复
   docker exec -it whisper_postgres psql -U whisper_user -d whisper_db
   DELETE FROM "User" WHERE email = 'user@example.com';
   ```

### Q: 登录会话多久过期？

**A**: 会话管理策略：
- **默认有效期**: 7天
- **记住我**: 30天
- **自动续期**: 活跃使用时自动延长
- **手动退出**: 立即清除会话

---

## ⚡ 性能和速度问题

### Q: 系统运行缓慢怎么办？

**A**: 性能优化建议：

**硬件检查**:
```bash
# 检查系统资源使用
docker stats
htop
df -h
```

**服务优化**:
- 重启服务：`docker-compose restart`
- 清理缓存：`docker exec whisper_redis redis-cli -a redis123 FLUSHALL`
- 清理日志：`docker system prune -f`

**配置调整**:
- 增加内存分配给Docker
- 使用SSD存储
- 关闭不必要的其他应用

### Q: 内存使用过高怎么办？

**A**: 内存优化方案：

**模型优化**:
- 使用更小的AI模型
- 限制并发处理数量
- 定期重启Ollama服务

**系统配置**:
```yaml
# 在docker-compose.yml中限制内存
services:
  ollama:
    deploy:
      resources:
        limits:
          memory: 8G
```

### Q: 磁盘空间不足怎么办？

**A**: 空间管理策略：

**自动清理**:
- 设置自动删除旧转录记录
- 启用临时文件自动清理
- 压缩存储的音频文件

**手动清理**:
```bash
# 清理Docker资源
docker system prune -a -f

# 清理应用数据
./scripts/cleanup-old-files.js

# 清理日志文件
sudo journalctl --vacuum-time=7d
```

### Q: 网络连接问题？

**A**: 网络问题排查：
1. **检查端口占用**: `netstat -tlnp | grep :3000`
2. **检查防火墙**: 确保端口3000开放
3. **检查代理设置**: 如果使用代理，确保配置正确
4. **重启网络服务**: `sudo systemctl restart docker`

---

## 🔒 数据安全和隐私

### Q: 数据是否会发送到外部服务器？

**A**: **完全不会**，Whisper App是完全本地化的：
- **语音转录**: 使用本地Whisper模型
- **AI处理**: 使用本地Ollama服务
- **数据存储**: 所有数据存储在本地
- **网络访问**: 仅用于下载模型和更新

### Q: 如何确保数据安全？

**A**: 数据安全措施：

**访问控制**:
- 用户认证和授权
- 数据库密码保护
- 服务间网络隔离

**数据加密**:
- HTTPS传输加密
- 数据库连接加密
- 密码哈希存储

**备份策略**:
- 定期自动备份
- 备份文件加密存储
- 多版本备份保留

### Q: 可以部署在公网吗？

**A**: 可以，但需要额外的安全配置：

**SSL证书**:
```nginx
# nginx配置示例
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

**防火墙规则**:
- 只开放必要端口（80, 443）
- 限制访问来源IP
- 使用强密码策略

### Q: 如何备份个人数据？

**A**: 数据备份方法：

**Web界面备份**:
1. 进入设置页面
2. 点击"导出所有数据"
3. 下载完整的数据包

**命令行备份**:
```bash
# 运行备份脚本
./scripts/backup-system.sh

# 备份个人数据
./scripts/backup-user-data.sh user@example.com
```

---

## 🔧 高级功能问题

### Q: 如何使用API接口？

**A**: API使用步骤：

**获取API密钥**:
1. 登录后进入设置页面
2. 生成API密钥
3. 妥善保存密钥（仅显示一次）

**使用示例**:
```javascript
// 上传文件
const formData = new FormData();
formData.append('file', audioFile);

const response = await fetch('/api/local-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  },
  body: formData
});
```

详细API文档请查看 [API使用文档](../main/API_REFERENCE.md)

### Q: 如何集成到其他应用？

**A**: 集成方案：

**Webhook集成**:
```bash
# 配置webhook URL
WEBHOOK_URL="https://your-app.com/webhook/transcription"
```

**第三方工具**:
- Zapier自动化集成
- Power Automate工作流
- 自定义脚本集成

### Q: 支持批量处理吗？

**A**: 支持多种批量操作：
- **批量上传**: 同时上传多个文件
- **批量转录**: 使用相同设置转录多个文件
- **批量AI处理**: 应用相同模板到多个转录
- **批量导出**: 导出多个记录的内容

### Q: 如何自定义界面？

**A**: 界面定制选项：
- **主题设置**: 浅色/深色主题切换
- **语言设置**: 界面语言（中文/英文）
- **布局设置**: 列表/网格视图切换
- **自定义CSS**: 开发者可修改样式文件

---

## 🛠️ 故障排除

### Q: 服务无法启动怎么办？

**A**: 系统性排查步骤：

**1. 检查Docker状态**:
```bash
docker --version
docker-compose --version
sudo systemctl status docker
```

**2. 检查端口占用**:
```bash
netstat -tlnp | grep -E ":(3000|5432|6379|9000|11434)"
```

**3. 查看错误日志**:
```bash
docker-compose logs --tail=50
./scripts/health-check.sh
```

**4. 重启服务**:
```bash
docker-compose down
docker-compose up -d
```

### Q: 数据库连接失败？

**A**: 数据库问题排查：

**检查数据库状态**:
```bash
docker-compose logs postgres
docker exec whisper_postgres pg_isready -U whisper_user -d whisper_db
```

**重置数据库**:
```bash
# 谨慎操作：会丢失所有数据
docker-compose down
docker volume rm whisper_postgres_data
docker-compose up -d postgres
npx prisma db push
```

### Q: AI服务不可用？

**A**: AI服务排查：

**检查Ollama状态**:
```bash
curl http://localhost:11434/api/tags
docker-compose logs ollama
```

**重新下载模型**:
```bash
docker exec whisper_ollama ollama pull whisper:latest
docker exec whisper_ollama ollama pull llama3.1:8b
```

### Q: 网页无法访问？

**A**: 网页访问问题：

**基本检查**:
1. 确认服务已启动：`docker-compose ps`
2. 检查端口映射：确认端口3000未被占用
3. 清除浏览器缓存和Cookie
4. 尝试使用无痕模式访问

**网络检查**:
```bash
# 测试本地连接
curl http://localhost:3000/api/health

# 检查应用日志
docker-compose logs app
```

---

## 📞 技术支持

### Q: 如何报告问题？

**A**: 问题报告流程：

**1. 收集信息**:
```bash
# 生成诊断报告
./scripts/health-check.sh > diagnostic_report.txt

# 收集系统信息
echo "系统: $(uname -a)" >> diagnostic_report.txt
echo "Docker: $(docker --version)" >> diagnostic_report.txt
echo "内存: $(free -h)" >> diagnostic_report.txt
```

**2. 提交Issue**:
- 访问项目GitHub页面
- 创建新Issue
- 详细描述问题和复现步骤
- 附上诊断报告

### Q: 如何获得帮助？

**A**: 获得帮助的途径：

**文档资源**:
- [完整部署指南](../main/LOCAL_DEPLOYMENT_GUIDE.md)
- [故障排除指南](../main/TROUBLESHOOTING_GUIDE.md)
- [功能使用指南](./FEATURES_GUIDE.md)

**社区支持**:
- GitHub Issues：技术问题和Bug报告
- GitHub Discussions：使用经验交流
- 项目Wiki：社区贡献的使用技巧

**专业支持**:
如需专业技术支持，请联系项目维护团队。

### Q: 如何参与项目开发？

**A**: 参与方式：

**贡献代码**:
1. Fork项目仓库
2. 创建功能分支
3. 提交Pull Request
4. 参与代码审查

**改进文档**:
- 完善现有文档
- 翻译文档到其他语言
- 添加使用示例

**反馈建议**:
- 提出功能改进建议
- 报告使用中的问题
- 分享使用经验和技巧

---

**希望这份FAQ能解决您使用Whisper App时遇到的问题！** ❓

如果您的问题不在此列表中，请查看 [故障排除指南](../main/TROUBLESHOOTING_GUIDE.md) 或在GitHub上提交Issue。
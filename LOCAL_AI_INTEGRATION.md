# 本地AI服务集成说明

## 修改概览

本次更新将Whisper应用从Together.ai服务切换到本地AI服务，包括：

1. **本地Whisper转录服务**：替换Together.ai的转录API
2. **本地LLM服务**：替换Together.ai的大语言模型服务
3. **保持原有的错误处理和认证逻辑**

## 修改的文件

### 1. `/home/lixinsi/whisper/lib/apiClients.ts`
- 添加了本地服务配置常量
- 新增 `transcribeWithLocalWhisper()` 函数用于本地Whisper转录
- 新增 `createLocalLLMClient()` 和 `getLocalLLMModel()` 函数用于本地LLM服务
- 保留了原有的Together.ai客户端以供后备使用

### 2. `/home/lixinsi/whisper/trpc/routers/whisper.ts`
- **第59-66行**：替换Together.ai转录调用为本地Whisper服务调用
- **第71-81行**：替换标题生成的LLM调用为本地LLM服务
- 保持相同的输入输出接口和错误处理逻辑

### 3. `/home/lixinsi/whisper/app/api/transform/route.ts`
- **第75-79行**：替换Together.ai的streamText调用为本地LLM服务
- 保持流式响应功能不变
- 保持认证和数据库操作逻辑不变

## 环境变量配置

创建或更新 `.env.local` 文件，添加以下配置：

```bash
# 本地Whisper服务URL
LOCAL_WHISPER_URL=http://localhost:9000

# 本地LLM服务URL (Ollama)
LOCAL_LLM_URL=http://localhost:11434

# 本地LLM模型名称
LOCAL_LLM_MODEL=llama3.1:8b
```

## 本地服务要求

### Whisper服务
- 需要在端口9000运行本地Whisper服务
- 支持OpenAI兼容的API接口：`/v1/audio/transcriptions`
- 接受JSON格式的请求，包含音频URL

### LLM服务 (Ollama)
- 需要在端口11434运行Ollama服务
- 支持OpenAI兼容的API接口：`/v1/chat/completions`
- 已安装指定的模型（默认：llama3.1:8b）

## 功能保持不变

- 音频转录功能
- 流式文本转换
- 用户认证和授权
- 数据库操作
- 错误处理
- 分钟限制逻辑

## 部署建议

1. 确保本地Whisper和Ollama服务正常运行
2. 更新环境变量配置
3. 测试转录和文本转换功能
4. 监控服务性能和错误日志

## 故障排除

如果本地服务不可用，可以：
1. 检查服务是否正常运行
2. 验证网络连接
3. 查看应用日志中的错误信息
4. 考虑恢复到Together.ai服务作为后备方案
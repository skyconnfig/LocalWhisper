# 本地大语言模型服务集成指南

本指南说明如何集成Ollama本地LLM服务来替换Together.ai的远程LLM服务。

## 前置条件

### 1. 安装Ollama

**Windows/macOS:**
```bash
# 访问 https://ollama.ai/download 下载安装包
# 或使用包管理器安装
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. 下载所需模型

```bash
# 下载中文模型 (用于中文内容转换)
ollama pull qwen2.5:7b

# 下载英文模型 (用于英文内容转换)
ollama pull llama3.1:8b
```

### 3. 验证Ollama服务

```bash
# 检查Ollama服务状态
curl http://localhost:11434/api/tags

# 测试模型
ollama run qwen2.5:7b "你好，请介绍一下你自己"
ollama run llama3.1:8b "Hello, please introduce yourself"
```

## 文件说明

### 1. 核心文件

#### `/lib/localLLMService.ts`
- 完整的本地LLM服务实现
- 支持Ollama API集成
- 自动语言检测和模型选择
- 流式响应支持
- 错误处理和重试机制

#### `/lib/apiClients.ts` (已更新)
- 添加了本地LLM客户端导出
- 提供统一客户端接口
- 支持Together.ai和本地LLM切换

#### `/app/api/transform/route-local.ts`
- 展示如何集成本地LLM的API路由示例
- 自动回退到Together.ai的机制
- 增强的错误处理

### 2. 配置文件

#### `/.env.local.example`
- 环境变量配置示例
- 本地LLM服务设置
- 保留Together.ai作为回退选项

## 集成步骤

### 1. 环境配置

复制环境变量配置：
```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件：
```env
# 启用本地LLM服务
USE_LOCAL_LLM=true

# Ollama服务地址
OLLAMA_BASE_URL=http://localhost:11434

# 保留Together.ai配置作为回退
TOGETHER_API_KEY=your_existing_key
```

### 2. 代码集成

有两种集成方式：

#### 方式一：替换现有路由 (推荐)

更新 `/app/api/transform/route.ts` 的第75-79行：

```typescript
// 原来的代码:
const aiClient = togetherVercelAiClient(apiKey);
const { textStream } = streamText({
  model: aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo"),
  prompt,
});

// 替换为:
import { createUnifiedLLMClient, checkOllamaHealth } from "@/lib/apiClients";

// 检查是否使用本地LLM
const useLocalLLM = process.env.USE_LOCAL_LLM === "true";
let aiClient;
let model;

if (useLocalLLM) {
  try {
    const healthCheck = await checkOllamaHealth();
    if (healthCheck.status === 'healthy') {
      console.log("Using local LLM service");
      aiClient = createUnifiedLLMClient(true);
      // 自动根据转录内容语言选择模型
      model = aiClient(whisper.fullTranscription);
    } else {
      console.warn("Local LLM unhealthy, falling back to Together.ai:", healthCheck.error);
      aiClient = togetherVercelAiClient(apiKey);
      model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
    }
  } catch (error) {
    console.error("Error checking local LLM, falling back to Together.ai:", error);
    aiClient = togetherVercelAiClient(apiKey);
    model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
  }
} else {
  aiClient = togetherVercelAiClient(apiKey);
  model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
}

const { textStream } = await streamText({
  model,
  prompt,
});
```

#### 方式二：使用新路由

1. 将 `route-local.ts` 重命名为 `route.ts`
2. 备份原有的 `route.ts` 文件

### 3. 启动服务

```bash
# 确保Ollama在运行
ollama serve

# 启动应用
npm run dev
```

## 功能特性

### 1. 智能模型选择
- 自动检测转录内容语言
- 中文内容使用 `qwen2.5:7b`
- 英文内容使用 `llama3.1:8b`

### 2. 错误处理
- 健康检查机制
- 自动回退到Together.ai
- 指数退避重试机制

### 3. 流式响应
- 保持与原有API相同的流式接口
- 实时内容生成
- 低延迟响应

### 4. 转换类型支持
- Summary (摘要)
- Quick Note (快速笔记)
- List (列表)
- Blog (博客文章)
- Email (邮件)

## 监控和调试

### 1. 健康检查

```bash
# 检查Ollama服务状态
curl http://localhost:11434/api/tags

# 检查可用模型
curl http://localhost:11434/api/tags | jq '.models[].name'
```

### 2. 日志监控

应用会在控制台输出以下日志：
- "Using local LLM service" - 使用本地LLM
- "Local LLM unhealthy, falling back to Together.ai" - 回退到Together.ai
- "Selected model for transformation: [model]" - 选择的模型

### 3. 性能测试

```bash
# 测试中文转换
curl -X POST http://localhost:3000/api/transform \
  -H "Content-Type: application/json" \
  -H "X-Use-Local-LLM: true" \
  -d '{"whisperId": "test-id", "typeName": "summary"}'

# 测试英文转换
curl -X POST http://localhost:3000/api/transform \
  -H "Content-Type: application/json" \
  -H "X-Use-Local-LLM: true" \
  -d '{"whisperId": "test-id", "typeName": "summary"}'
```

## 故障排除

### 1. Ollama连接失败
- 检查Ollama服务是否运行: `ps aux | grep ollama`
- 验证端口可访问: `curl http://localhost:11434/api/tags`
- 检查防火墙设置

### 2. 模型未找到
```bash
# 重新下载模型
ollama pull qwen2.5:7b
ollama pull llama3.1:8b

# 验证模型安装
ollama list
```

### 3. 内存不足
- 监控系统内存使用
- 考虑使用更小的模型变体
- 调整Ollama配置

### 4. 响应速度慢
- 检查硬件配置(特别是GPU支持)
- 考虑使用量化模型
- 调整并发设置

## 优势对比

### 本地LLM vs Together.ai

**本地LLM优势:**
- 数据隐私保护
- 无网络依赖
- 无API调用费用
- 可定制模型选择
- 更低延迟(本地网络)

**Together.ai优势:**
- 更强大的模型能力
- 无硬件要求
- 专业维护
- 更好的可扩展性

## 后续优化建议

1. **GPU加速**: 配置CUDA支持以提升推理速度
2. **模型优化**: 使用量化模型减少内存占用
3. **缓存机制**: 实现结果缓存以提升重复请求性能
4. **监控面板**: 添加本地LLM服务监控界面
5. **模型管理**: 实现动态模型下载和管理功能
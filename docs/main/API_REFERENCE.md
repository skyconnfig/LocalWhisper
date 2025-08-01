# Whisper App API 使用文档

本文档详细介绍了 Whisper App 提供的所有 REST API 和 tRPC 接口，包括认证、文件上传、语音转录和AI处理功能。

## 📋 目录

1. [API概览](#API概览)
2. [认证机制](#认证机制)
3. [REST API接口](#REST-API接口)
4. [tRPC接口](#tRPC接口)
5. [错误处理](#错误处理)
6. [使用示例](#使用示例)
7. [速率限制](#速率限制)
8. [SDK和客户端](#SDK和客户端)

## 🔍 API概览

Whisper App 提供两种类型的API接口：

- **REST API**: 标准HTTP接口，适用于文件上传、健康检查等
- **tRPC API**: 类型安全的RPC接口，适用于数据查询和转录操作

### 基础URL

```
本地部署: http://localhost:3000
生产环境: https://your-domain.com
```

### 支持的格式

- **请求格式**: JSON, FormData (文件上传)
- **响应格式**: JSON
- **文件格式**: MP3, WAV, M4A, OGG, FLAC, AAC, WMA, WebM, MP4

## 🔐 认证机制

Whisper App 使用 NextAuth.js 进行用户认证，支持多种认证方式。

### 会话认证

大多数API需要用户登录才能访问：

```javascript
// 客户端JavaScript示例
const response = await fetch('/api/whispers', {
  method: 'GET',
  credentials: 'include', // 包含session cookie
  headers: {
    'Content-Type': 'application/json',
  }
});
```

### API密钥认证

某些管理API使用API密钥认证：

```javascript
const response = await fetch('/api/cleanup-files', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.CLEANUP_API_KEY}`,
    'Content-Type': 'application/json',
  }
});
```

## 🌐 REST API接口

### 健康检查

检查系统健康状态：

```http
GET /api/health
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "minio": "connected",
    "ollama": "connected"
  },
  "version": "1.0.0"
}
```

### 用户认证

#### 注册用户

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "User Name"
}
```

**响应**:
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

#### 用户登录

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "secure_password"
}
```

### 文件上传

#### 本地文件上传

上传音频文件到本地存储：

```http
POST /api/local-upload
Content-Type: multipart/form-data

file: [音频文件]
title: "转录标题" (可选)
language: "zh" (可选)
```

**响应**:
```json
{
  "success": true,
  "fileUrl": "/uploads/audio_123456.mp3",
  "filename": "audio_123456.mp3",
  "size": 1024000,
  "mimeType": "audio/mpeg"
}
```

#### S3/MinIO文件上传

上传文件到对象存储：

```http
POST /api/s3-upload
Content-Type: multipart/form-data

file: [音频文件]
```

**响应**:
```json
{
  "success": true,
  "fileUrl": "http://localhost:9000/audio-files/audio_123456.mp3",
  "key": "audio_123456.mp3",
  "bucket": "audio-files"
}
```

### 文件管理

#### 获取文件

```http
GET /api/files/[...path]
```

#### 清理临时文件

```http
POST /api/cleanup-files
Authorization: Bearer YOUR_CLEANUP_API_KEY
```

**响应**:
```json
{
  "success": true,
  "deletedFiles": 15,
  "freedSpace": "156MB"
}
```

### AI文本转换

流式AI文本处理：

```http
POST /api/transform
Content-Type: application/json

{
  "whisperId": "whisper_id",
  "typeName": "summary",
  "prompt": "请总结以下内容",
  "transcription": "转录文本内容..."
}
```

**响应**: Server-Sent Events (SSE) 流

```
data: {"type": "token", "content": "这"}
data: {"type": "token", "content": "是"}
data: {"type": "token", "content": "一个"}
data: {"type": "complete", "fullText": "这是一个总结..."}
```

### 验证API密钥

```http
POST /api/validate-key
Content-Type: application/json

{
  "apiKey": "your-together-ai-key"
}
```

## 🔧 tRPC接口

tRPC提供类型安全的API接口，主要用于数据查询和转录操作。

### 设置tRPC客户端

```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../trpc/routers/_app';

export const trpc = createTRPCReact<AppRouter>();

// 在组件中使用
function MyComponent() {
  const utils = trpc.useContext();
  
  // 查询转录记录
  const { data: whispers } = trpc.whisper.getAll.useQuery();
  
  // 创建转录
  const createMutation = trpc.whisper.create.useMutation();
}
```

### Whisper转录接口

#### 获取所有转录记录

```typescript
const whispers = await trpc.whisper.getAll.query();
```

**返回类型**:
```typescript
{
  id: string;
  title: string;
  createdAt: Date;
  fullTranscription: string;
  audioTracks: AudioTrack[];
  transformations: Transformation[];
}[]
```

#### 获取单个转录记录

```typescript
const whisper = await trpc.whisper.getById.query({ id: "whisper_id" });
```

#### 创建转录记录

```typescript
const newWhisper = await trpc.whisper.create.mutate({
  title: "我的转录",
  audioUrl: "http://localhost:9000/audio-files/audio.mp3",
  language: "zh"
});
```

**参数**:
```typescript
{
  title: string;
  audioUrl: string;
  language?: string;
}
```

#### 删除转录记录

```typescript
await trpc.whisper.delete.mutate({ id: "whisper_id" });
```

### 使用限制接口

#### 获取用户限制信息

```typescript
const limits = await trpc.limit.get.query();
```

**返回**:
```typescript
{
  minutesUsed: number;
  minutesLimit: number;
  remainingMinutes: number;
  resetDate: Date;
}
```

## ❌ 错误处理

### 标准错误格式

所有API错误都遵循统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "详细错误信息",
    "details": {
      "field": "具体错误字段",
      "value": "错误值"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 常见错误代码

| 错误代码 | HTTP状态码 | 描述 |
|---------|-----------|------|
| `UNAUTHORIZED` | 401 | 用户未认证 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `FILE_TOO_LARGE` | 413 | 文件超过大小限制 |
| `UNSUPPORTED_FORMAT` | 400 | 不支持的文件格式 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过速率限制 |
| `TRANSCRIPTION_FAILED` | 500 | 转录处理失败 |
| `AI_PROCESSING_FAILED` | 500 | AI处理失败 |

### 错误处理示例

```typescript
try {
  const result = await trpc.whisper.create.mutate(data);
} catch (error) {
  if (error.data?.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('已达到使用限制，请稍后再试');
  } else if (error.data?.code === 'FILE_TOO_LARGE') {
    console.log('文件太大，请上传小于100MB的文件');
  } else {
    console.log('未知错误:', error.message);
  }
}
```

## 💡 使用示例

### 完整的文件上传和转录流程

```typescript
async function uploadAndTranscribe(audioFile: File) {
  try {
    // 1. 上传文件
    const formData = new FormData();
    formData.append('file', audioFile);
    
    const uploadResponse = await fetch('/api/local-upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success) {
      throw new Error('文件上传失败');
    }
    
    // 2. 创建转录记录
    const whisper = await trpc.whisper.create.mutate({
      title: audioFile.name,
      audioUrl: uploadResult.fileUrl,
      language: 'zh'
    });
    
    console.log('转录创建成功:', whisper);
    return whisper;
    
  } catch (error) {
    console.error('上传转录失败:', error);
    throw error;
  }
}
```

### 流式AI处理

```typescript
async function processWithAI(whisperId: string, prompt: string) {
  const response = await fetch('/api/transform', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      whisperId,
      typeName: 'custom',
      prompt
    })
  });
  
  if (!response.body) {
    throw new Error('无法获取响应流');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'token') {
            result += data.content;
            // 实时显示处理进度
            console.log('当前结果:', result);
          } else if (data.type === 'complete') {
            result = data.fullText;
            console.log('处理完成:', result);
            return result;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
  
  return result;
}
```

### 批量处理音频文件

```typescript
async function batchTranscribe(files: File[]) {
  const results = [];
  
  for (const file of files) {
    try {
      console.log(`开始处理: ${file.name}`);
      
      const whisper = await uploadAndTranscribe(file);
      results.push(whisper);
      
      console.log(`完成处理: ${file.name}`);
      
      // 避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`处理失败 ${file.name}:`, error);
      results.push({ error: error.message, file: file.name });
    }
  }
  
  return results;
}
```

## ⚡ 速率限制

为了保护系统资源，API实施了速率限制：

### 默认限制

- **转录分钟数**: 每月100分钟
- **API请求**: 每小时1000次请求
- **文件上传**: 每分钟10个文件
- **AI处理**: 每小时50次请求

### 速率限制响应

当超过限制时，API返回429状态码：

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "已超过速率限制",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetTime": "2024-01-01T13:00:00Z"
    }
  }
}
```

### 检查限制状态

```typescript
// 获取当前使用情况
const limits = await trpc.limit.get.query();

console.log(`已使用: ${limits.minutesUsed}/${limits.minutesLimit} 分钟`);
console.log(`重置时间: ${limits.resetDate}`);
```

## 🛠️ SDK和客户端

### JavaScript/TypeScript客户端

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/routers/_app';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      // 添加认证头
      headers: () => ({
        Authorization: `Bearer ${getAuthToken()}`,
      }),
    }),
  ],
});

// 使用客户端
const whispers = await client.whisper.getAll.query();
```

### Python客户端示例

```python
import requests
import json

class WhisperClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        
    def upload_file(self, file_path):
        """上传音频文件"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{self.base_url}/api/local-upload",
                files=files
            )
            return response.json()
    
    def health_check(self):
        """检查系统健康状态"""
        response = requests.get(f"{self.base_url}/api/health")
        return response.json()

# 使用示例
client = WhisperClient()
health = client.health_check()
print(f"系统状态: {health['status']}")
```

### Curl示例

```bash
# 健康检查
curl http://localhost:3000/api/health

# 上传文件
curl -X POST http://localhost:3000/api/local-upload \
  -F "file=@audio.mp3" \
  -F "title=我的音频"

# 清理文件
curl -X POST http://localhost:3000/api/cleanup-files \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 📚 进阶用法

### Webhook支持

配置Webhook接收转录完成通知：

```typescript
// 在.env.local中配置
WEBHOOK_URL="https://your-app.com/webhook/transcription"
WEBHOOK_SECRET="your-webhook-secret"

// Webhook处理示例
app.post('/webhook/transcription', (req, res) => {
  const { whisperId, status, transcription } = req.body;
  
  if (status === 'completed') {
    console.log(`转录完成: ${whisperId}`);
    console.log(`内容: ${transcription}`);
  }
  
  res.status(200).send('OK');
});
```

### 自定义AI提示模板

```typescript
const customPrompts = {
  meeting_summary: `请为以下会议内容生成结构化摘要：
  
1. 主要议题
2. 关键决定
3. 行动项目
4. 下次会议安排

会议内容：{transcription}`,

  email_draft: `将以下语音内容转换为正式邮件格式：

主题：{subject}
内容：{transcription}`,
};

// 使用自定义模板
const result = await processWithAI(whisperId, customPrompts.meeting_summary);
```

### 监控和分析

```typescript
// 获取使用统计
const stats = await trpc.analytics.getUsageStats.query({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});

console.log(`本月转录时长: ${stats.totalMinutes} 分钟`);
console.log(`最活跃时段: ${stats.peakHours}`);
console.log(`常用语言: ${stats.topLanguages}`);
```

## 🔍 调试和测试

### API测试工具

```typescript
// 简单的API测试工具
async function testAPI() {
  console.log('开始API测试...');
  
  // 测试健康检查
  const health = await fetch('/api/health').then(r => r.json());
  console.log('健康检查:', health.status);
  
  // 测试认证
  const whispers = await trpc.whisper.getAll.query();
  console.log('获取转录记录:', whispers.length);
  
  console.log('API测试完成');
}
```

### 性能监控

```typescript
// API响应时间监控
const originalFetch = fetch;
window.fetch = async (...args) => {
  const start = performance.now();
  const response = await originalFetch(...args);
  const duration = performance.now() - start;
  
  console.log(`API请求 ${args[0]} 耗时: ${duration.toFixed(2)}ms`);
  return response;
};
```

---

**这份API文档应该能帮助您快速集成和使用Whisper App的所有功能！** 🚀

如需更多帮助，请查看 [开发者文档](../developer/DEVELOPMENT_SETUP.md) 或 [联系我们](../README.md#获取帮助)。
# 本地Whisper服务设置说明

本项目现在支持使用本地的faster-whisper替代Together.ai的Whisper服务进行语音转录。

## 安装Requirements

### 1. 安装Python依赖

首先确保您的系统上安装了Python 3.8+，然后安装faster-whisper：

```bash
pip install faster-whisper
```

### 2. 验证安装

运行以下命令验证faster-whisper是否正确安装：

```bash
faster-whisper --help
```

如果看到帮助信息，说明安装成功。

## 环境变量配置

在您的`.env.local`文件中添加以下配置（可选）：

```bash
# Whisper模型配置（可选，默认为'base'）
WHISPER_MODEL=base

# 备用HTTP API端点（可选，用于fallback）
LOCAL_WHISPER_URL=http://localhost:9000
```

### 可用的Whisper模型

- `tiny` - 最快但准确性较低
- `base` - 平衡速度和准确性（默认推荐）
- `small` - 更好的准确性，稍慢
- `medium` - 很好的准确性，较慢
- `large-v3` - 最高准确性，最慢

## 功能特性

### 1. 多音频格式支持

支持以下音频格式：
- WAV, MP3, MP4, M4A
- OGG, FLAC, AAC, WMA
- WebM

### 2. 语言检测和转录

- 自动语言检测
- 支持80+种语言
- 可指定特定语言进行转录

### 3. 语音活动检测(VAD)

启用VAD过滤以提高转录准确性：
- 自动识别语音和静音段
- 过滤背景噪音
- 提高转录质量

### 4. 错误处理和Fallback

- 检测faster-whisper是否可用
- 自动fallback到HTTP API（如果配置）
- 详细的错误日志记录

## API使用示例

### 基本使用

```typescript
import { transcribeAudioFromUrl } from '@/lib/localWhisperService';

const result = await transcribeAudioFromUrl('https://example.com/audio.mp3', {
  language: 'en',
  model: 'base'
});

console.log('转录结果:', result.text);
console.log('检测语言:', result.language);
```

### 高级配置

```typescript
const result = await transcribeAudioFromUrl(audioUrl, {
  language: 'zh',
  model: 'medium',
  task: 'transcribe',
  vad_filter: true,
  vad_parameters: {
    threshold: 0.5,
    min_speech_duration_ms: 250,
    max_speech_duration_s: 10,
    min_silence_duration_ms: 100,
    speech_pad_ms: 30
  }
});
```

## 性能优化建议

### 1. 模型选择

- **开发环境**: 使用`tiny`或`base`模型
- **生产环境**: 根据准确性需求选择`base`、`small`或`medium`
- **高准确性需求**: 使用`large-v3`（需要更多内存和时间）

### 2. 硬件要求

- **CPU**: 多核处理器推荐
- **内存**: 至少4GB RAM（large模型需要8GB+）
- **GPU**: 支持CUDA的GPU可大幅提升速度

### 3. 批处理

对于大量音频文件，考虑实现队列系统：

```typescript
// 示例队列处理
const audioQueue = ['url1', 'url2', 'url3'];
const results = await Promise.all(
  audioQueue.map(url => transcribeAudioFromUrl(url))
);
```

## 故障排除

### 1. faster-whisper命令未找到

```bash
# 检查PATH是否包含Python scripts目录
echo $PATH

# 或使用pip show查看安装位置
pip show faster-whisper
```

### 2. 内存不足错误

- 尝试使用更小的模型（如`tiny`或`base`）
- 增加系统RAM
- 启用虚拟内存/交换文件

### 3. 音频文件下载失败

- 检查网络连接
- 验证音频URL是否可访问
- 确保音频文件格式受支持

### 4. 转录质量问题

- 使用更大的模型（如`medium`或`large-v3`）
- 启用VAD过滤
- 调整VAD参数
- 确保音频质量良好

## 文件结构

```
lib/
├── localWhisperService.ts    # 本地Whisper服务实现
├── apiClients.ts            # API客户端（已更新）
└── localLLMService.ts       # 本地LLM服务

trpc/routers/
└── whisper.ts              # Whisper路由（使用本地服务）
```

## 主要实现文件

### `/lib/localWhisperService.ts`
完整的faster-whisper集成服务，包含：
- 音频下载和处理
- 子进程调用管理
- 错误处理和重试
- 多格式支持
- 语言检测

### `/lib/apiClients.ts`
更新后的API客户端，现在包含：
- `transcribeWithLocalWhisper()` - 使用本地faster-whisper
- 自动可用性检测
- HTTP API fallback支持

## 监控和日志

服务包含详细的日志记录：

```bash
# 查看应用日志
npm run dev

# 日志内容包括：
# - 音频下载进度
# - 转录开始/完成时间
# - 错误信息和堆栈跟踪
# - 性能指标
```
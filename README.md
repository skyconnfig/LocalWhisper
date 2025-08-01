<a href="https://github.com/skyconnfig/LocalWhisper">
  <img alt="LocalWhisper - Self-Hosted Audio Transcription" src="./public/og.jpg">
  <h1 align="center">LocalWhisper</h1>
</a>

<p align="center">
  A fully self-hosted audio transcription and transformation app. Complete privacy, zero cloud dependencies.
</p>

<p align="center">
  <strong>Transform any Whisper app into a local, privacy-first solution</strong>
</p>

## 🌟 Why LocalWhisper?

- **🔒 Complete Privacy**: All audio processing happens locally - your data never leaves your machine
- **💰 Zero Cloud Costs**: No API fees, no subscription costs, no usage limits  
- **🚀 Offline Ready**: Works without internet connection once set up
- **⚡ High Performance**: Local AI models with optimized performance
- **🛠️ Fully Customizable**: Use your own AI models and configurations
- **🐳 Docker Ready**: One-command deployment with Docker

## 🏗️ Local Tech Stack

- **Local AI**: Ollama + Whisper models (replaces Together.ai)
- **Authentication**: NextAuth.js (replaces Clerk)
- **Database**: Local PostgreSQL (replaces Neon)
- **Storage**: MinIO or local filesystem (replaces AWS S3)
- **Cache**: Local Redis (replaces Upstash)
- **Framework**: Next.js 15 + React 19 + TypeScript
- **Deployment**: Docker Compose with full orchestration

## 🎯 How LocalWhisper Works

1. **Register/Login** with local NextAuth.js authentication
2. **Upload Audio** to local MinIO or filesystem storage
3. **AI Transcription** using local Whisper models (faster-whisper)
4. **Content Transformation** with local LLMs (Llama 3.1, Qwen 2.5)
5. **Manage History** in your private local database

## ⚡ Quick Start

### One-Click Deployment (Recommended)
```bash
git clone https://github.com/skyconnfig/LocalWhisper.git
cd LocalWhisper
./deploy.sh
```

### Quick Development Setup
```bash
./quick-start.sh
```

### Manual Setup
```bash
# Install dependencies
npm install

# Start local services
docker-compose up -d

# Run database migrations
npm run db:push

# Start the app
npm run dev
```

## 📋 System Requirements

- **OS**: Windows 11, macOS, or Linux
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB for AI models + your audio files
- **Docker**: Required for easy deployment
- **Optional**: GPU for faster AI processing

## 🔧 Supported AI Models

### Whisper Models (Speech-to-Text)
- `base` - Fast, good quality (142MB)
- `medium` - **Recommended balance** (769MB)
- `large-v3` - Best accuracy (1.55GB)

### LLM Models (Text Processing)
- `llama3.1:8b` - English content processing
- `qwen2.5:7b` - Chinese content processing  
- `gemma2:9b` - Lightweight alternative

## 🌐 Access Your LocalWhisper

After deployment:
- **Main App**: http://localhost:3000
- **MinIO Console**: http://localhost:9001 (admin UI)
- **Database Studio**: Run `npm run studio`

## 📚 Documentation

- [📖 Complete Deployment Guide](./docs/main/LOCAL_DEPLOYMENT_GUIDE.md)
- [⚡ Quick Start Tutorial](./docs/main/QUICK_START_GUIDE.md)
- [🔧 Configuration Options](./docs/user/CONFIGURATION.md)
- [🏗️ Architecture Overview](./docs/technical/ARCHITECTURE.md)
- [❓ FAQ & Troubleshooting](./docs/user/FAQ.md)
- [📋 Full Documentation Index](./DOCUMENTATION_INDEX.md)

## 🧪 Testing

Run comprehensive tests to verify your deployment:
```bash
npm run test           # Full test suite
npm run test:quick     # Quick functionality check
npm run test:health    # System health check
```

## 🔄 Migration from Cloud Version

LocalWhisper provides seamless migration from cloud-based Whisper apps:

- **From Together.ai**: Automatic local AI integration
- **From Clerk**: Smooth NextAuth.js transition  
- **From AWS S3**: Local file system or MinIO setup
- **From Upstash**: Local Redis configuration

See [Migration Guide](./docs/main/LOCAL_DEPLOYMENT_GUIDE.md#migration) for details.

## 🤝 Contributing

We welcome contributions! See [Contributing Guide](./docs/developer/CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built upon the excellent [Whisper App](https://github.com/nutlope/whisper-app) foundation
- Powered by [OpenAI Whisper](https://github.com/openai/whisper) and [Ollama](https://ollama.ai)
- UI components from [Radix UI](https://radix-ui.com) and [Tailwind CSS](https://tailwindcss.com)

---

<p align="center">
  <strong>⭐ Star this repo if LocalWhisper helps you build privacy-first AI applications!</strong>
</p>
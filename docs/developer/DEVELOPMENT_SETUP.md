# Whisper App 开发环境搭建指南

本指南详细介绍如何搭建 Whisper App 的开发环境，包括本地开发配置、调试工具和开发流程。

## 📋 目录

1. [开发环境要求](#开发环境要求)
2. [项目结构](#项目结构)
3. [本地开发设置](#本地开发设置)
4. [开发工具配置](#开发工具配置)
5. [调试和测试](#调试和测试)
6. [开发流程](#开发流程)

## 💻 开发环境要求

### 系统要求
- **操作系统**: Linux, macOS, Windows (WSL2)
- **内存**: 8GB+ RAM
- **存储**: 20GB+ 可用空间
- **CPU**: 4核心+处理器

### 必需软件
- **Node.js**: 18.0+ (推荐使用nvm管理版本)
- **pnpm**: 8.0+ (包管理器)
- **Docker**: 20.10+ (容器化服务)
- **Docker Compose**: 2.0+
- **Git**: 2.30+

### 推荐工具
- **VS Code**: 代码编辑器
- **Postman**: API测试工具
- **DBeaver**: 数据库管理工具

## 📁 项目结构

```
whisper/
├── app/                      # Next.js App Router
│   ├── api/                 # API路由
│   ├── auth/                # 认证页面
│   ├── whispers/            # 转录相关页面
│   ├── globals.css          # 全局样式
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 首页
├── components/               # React组件
│   ├── ui/                  # UI基础组件
│   ├── auth/                # 认证组件
│   └── hooks/               # 自定义Hook
├── lib/                     # 工具库
│   ├── generated/           # Prisma生成文件
│   ├── apiClients.ts        # API客户端
│   ├── auth.ts              # 认证配置
│   └── utils.ts             # 工具函数
├── trpc/                    # tRPC配置
│   ├── routers/             # tRPC路由
│   ├── client.tsx           # 客户端配置
│   └── server.tsx           # 服务端配置
├── prisma/                  # 数据库配置
│   └── schema.prisma        # 数据库模式
├── scripts/                 # 管理脚本
├── docs/                    # 项目文档
├── docker-compose.yml       # Docker服务配置
├── package.json             # 项目依赖
└── tsconfig.json           # TypeScript配置
```

## 🛠️ 本地开发设置

### 1. 克隆项目

```bash
# 克隆仓库
git clone <repository-url>
cd whisper

# 查看分支
git branch -a
git checkout develop  # 切换到开发分支
```

### 2. 安装依赖

```bash
# 安装Node.js (使用nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安装pnpm
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 3. 环境配置

```bash
# 复制环境变量模板
cp config/env.development .env.local

# 编辑环境变量
nano .env.local
```

开发环境配置示例：
```bash
# .env.local
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# 数据库配置
DATABASE_URL="postgresql://whisper_user:whisper_password@localhost:5432/whisper_db"

# Redis配置
REDIS_URL="redis://:redis123@localhost:6379"

# MinIO配置
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"

# NextAuth配置
NEXTAUTH_SECRET="development-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AI服务配置
OLLAMA_BASE_URL="http://localhost:11434"
LOCAL_WHISPER_ENABLED=true
LOCAL_LLM_ENABLED=true

# 开发选项
ENABLE_DEBUG_LOGS=true
LOG_LEVEL="debug"
NEXT_TELEMETRY_DISABLED=1
```

### 4. 启动基础服务

```bash
# 启动数据库、Redis、MinIO、Ollama
docker-compose up -d postgres redis minio ollama

# 等待服务启动
sleep 30

# 初始化数据库
pnpm db:push

# 下载AI模型
docker exec whisper_ollama ollama pull whisper:latest
docker exec whisper_ollama ollama pull llama3.1:8b
```

### 5. 启动开发服务器

```bash
# 启动Next.js开发服务器
pnpm dev

# 或使用Turbo模式（更快的热重载）
pnpm dev --turbo
```

访问 http://localhost:3000 查看应用。

## 🔧 开发工具配置

### VS Code配置

#### 推荐扩展

```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "prisma.prisma",
    "ms-vscode.vscode-docker",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### 工作区设置

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

#### 调试配置

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### ESLint和Prettier配置

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Git配置

```bash
# .gitignore (主要内容)
node_modules/
.next/
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
```

```bash
# Git钩子设置
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint
pnpm type-check
```

## 🐛 调试和测试

### 开发调试

#### 服务器端调试

```typescript
// 在服务器端代码中添加调试点
console.log('Debug info:', { userId, audioUrl });

// 使用调试器
debugger; // 在浏览器开发工具中会暂停

// 使用VS Code调试
// 设置断点后使用F5启动调试
```

#### 客户端调试

```typescript
// React组件调试
import { useEffect } from 'react';

function DebugComponent() {
  useEffect(() => {
    console.log('Component mounted');
    return () => console.log('Component unmounted');
  }, []);
}

// 使用React DevTools
// 安装浏览器扩展：React Developer Tools
```

#### 数据库调试

```bash
# 连接到数据库
docker exec -it whisper_postgres psql -U whisper_user -d whisper_db

# 查看查询日志
docker-compose logs postgres | grep -i "statement\|error"

# 使用Prisma Studio
pnpm studio
```

### API测试

#### 使用Postman

```json
// Postman环境变量
{
  "base_url": "http://localhost:3000",
  "api_key": "your-test-api-key"
}
```

#### 使用curl

```bash
# 测试健康检查
curl http://localhost:3000/api/health

# 测试文件上传
curl -X POST http://localhost:3000/api/local-upload \
  -F "file=@test-audio.mp3" \
  -H "Cookie: next-auth.session-token=your-session-token"

# 测试tRPC
curl -X POST http://localhost:3000/api/trpc/whisper.getAll \
  -H "Content-Type: application/json" \
  -d '{"json":{}}'
```

### 单元测试

```bash
# 安装测试依赖
pnpm add -D jest @testing-library/react @testing-library/jest-dom

# 运行测试
pnpm test

# 测试覆盖率
pnpm test:coverage
```

测试示例：
```typescript
// __tests__/utils.test.ts
import { formatFileSize } from '../lib/utils';

describe('formatFileSize', () => {
  test('formats bytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });
});
```

## 🔄 开发流程

### Git工作流

```bash
# 1. 创建功能分支
git checkout -b feature/audio-batch-upload

# 2. 开发功能
# ... 编写代码 ...

# 3. 提交代码
git add .
git commit -m "feat: add batch audio upload functionality"

# 4. 推送分支
git push origin feature/audio-batch-upload

# 5. 创建Pull Request
# 在GitHub上创建PR

# 6. 合并后清理
git checkout develop
git pull origin develop
git branch -d feature/audio-batch-upload
```

### 提交消息规范

```bash
# 提交消息格式：<type>(<scope>): <description>

# 类型说明：
feat: 新功能
fix: 修复bug
docs: 文档更改
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具更改

# 示例：
git commit -m "feat(api): add batch transcription endpoint"
git commit -m "fix(ui): resolve upload progress display issue"
git commit -m "docs(readme): update installation instructions"
```

### 代码审查检查清单

- [ ] **功能完整**: 功能按需求实现
- [ ] **代码质量**: 遵循项目编码规范
- [ ] **类型安全**: TypeScript类型正确
- [ ] **性能考虑**: 无明显性能问题
- [ ] **错误处理**: 适当的错误处理
- [ ] **测试覆盖**: 包含必要的测试
- [ ] **文档更新**: 相关文档已更新
- [ ] **向后兼容**: 不破坏现有功能

### 发布流程

```bash
# 1. 合并到main分支
git checkout main
git merge develop

# 2. 更新版本号
npm version patch  # 或 minor, major

# 3. 构建生产版本
pnpm build

# 4. 运行完整测试
pnpm test:e2e

# 5. 创建发布标签
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# 6. 部署到生产环境
./deploy.sh production
```

### 常用开发命令

```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx scripts/seed.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "docker:dev": "docker-compose -f docker-compose.dev.yml up -d",
    "docker:logs": "docker-compose logs -f"
  }
}
```

### 开发小贴士

1. **热重载**: 使用 `--turbo` 标志获得更快的热重载
2. **数据库变更**: 修改schema后运行 `pnpm db:push`
3. **类型检查**: 定期运行 `pnpm type-check`
4. **依赖更新**: 使用 `pnpm update` 更新依赖
5. **清理缓存**: 删除 `.next` 目录清理构建缓存

---

**现在您的开发环境已经准备就绪！** 🎉

开始愉快的开发吧！如有问题，请查看 [故障排除指南](../main/TROUBLESHOOTING_GUIDE.md)。
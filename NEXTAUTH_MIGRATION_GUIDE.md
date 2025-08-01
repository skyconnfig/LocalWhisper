# NextAuth.js 迁移指南

本指南将帮助您从 Clerk 迁移到 NextAuth.js 认证系统。

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install next-auth @auth/prisma-adapter bcryptjs
npm install -D @types/bcryptjs
```

### 2. 环境变量配置

在 `.env.local` 文件中添加以下配置：

```env
# NextAuth.js 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# 数据库
DATABASE_URL="your-postgresql-connection-string"

# OAuth 提供者 (可选)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_ID=your-github-app-id
GITHUB_SECRET=your-github-app-secret
```

### 3. 数据库迁移

运行以下命令更新数据库模式：

```bash
npx prisma db push
```

## 📝 文件替换清单

### 必需替换的文件

1. **中间件** - 替换 `middleware.ts`:
   ```typescript
   // 原文件: middleware.ts (使用 clerkMiddleware)
   // 新文件: middleware-nextauth.ts
   cp middleware-nextauth.ts middleware.ts
   ```

2. **布局文件** - 替换 `app/layout.tsx`:
   ```typescript
   // 原文件: app/layout.tsx (使用 ClerkProvider)
   // 新文件: app/layout-nextauth.tsx
   cp app/layout-nextauth.tsx app/layout.tsx
   ```

3. **Header 组件** - 替换 `components/Header.tsx`:
   ```typescript
   // 原文件: components/Header.tsx (使用 Clerk hooks)
   // 新文件: components/Header-nextauth.tsx
   cp components/Header-nextauth.tsx components/Header.tsx
   ```

4. **useLimits Hook** - 替换 `components/hooks/useLimits.ts`:
   ```typescript
   // 原文件: components/hooks/useLimits.ts (使用 useUser from Clerk)
   // 新文件: components/hooks/useLimitsNextAuth.ts
   cp components/hooks/useLimitsNextAuth.ts components/hooks/useLimits.ts
   ```

### 新增的文件

这些文件已经创建，无需额外操作：

- `app/api/auth/[...nextauth]/route.ts` - NextAuth.js API 路由
- `app/api/auth/register/route.ts` - 用户注册 API
- `lib/auth.ts` - NextAuth.js 认证配置
- `components/AuthProvider.tsx` - Session Provider 包装器
- `app/auth/signin/page.tsx` - 登录页面
- `app/auth/signup/page.tsx` - 注册页面

## 🔧 认证功能对比

### Clerk vs NextAuth.js 功能映射

| Clerk 功能 | NextAuth.js 等效功能 | 实现方式 |
|-----------|-------------------|----------|
| `useUser()` | `useSession()` | 获取当前用户信息 |
| `SignedIn/SignedOut` | 条件渲染基于 `session` | 使用 `session` 状态判断 |
| `SignInButton` | 自定义登录按钮 | 导航到 `/auth/signin` |
| `SignUpButton` | 自定义注册按钮 | 导航到 `/auth/signup` |
| `UserButton` | 自定义用户菜单 | 使用 `signOut()` 函数 |
| `clerkMiddleware` | NextAuth.js 中间件 | 使用 `getToken()` 验证 |

### 认证提供者配置

NextAuth.js 配置支持以下认证方式：

1. **邮箱密码认证** (Credentials Provider)
   - 支持用户注册和登录
   - 密码使用 bcrypt 加密
   - 最小密码长度: 8 位

2. **Google OAuth** (可选)
   - 需要配置 Google OAuth 应用
   - 设置 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`

3. **GitHub OAuth** (可选)
   - 需要配置 GitHub OAuth 应用
   - 设置 `GITHUB_ID` 和 `GITHUB_SECRET`

## 🗄️ 数据库模式更新

### 新增的认证相关表

```sql
-- NextAuth.js 所需的表结构已自动创建：
-- Account: OAuth 账户关联
-- Session: 用户会话管理
-- User: 用户基础信息
-- VerificationToken: 邮箱验证令牌
```

### 现有数据兼容性

- `Whisper` 表新增了与 `User` 表的外键关联
- 保持所有现有的 whisper 和 transformation 数据
- 用户ID格式从 Clerk UUID 改为 NextAuth.js cuid

## 🔄 迁移步骤

### 步骤 1: 准备工作
1. 备份现有数据库
2. 确保所有依赖已安装
3. 配置环境变量

### 步骤 2: 数据库迁移
```bash
# 更新数据库模式
npx prisma db push

# 验证迁移
npx prisma studio
```

### 步骤 3: 文件替换
按照上述文件替换清单执行文件替换操作

### 步骤 4: 测试验证
1. 启动开发服务器: `npm run dev`
2. 测试用户注册功能
3. 测试用户登录功能
4. 测试OAuth登录(如果配置)
5. 验证现有whisper数据访问正常

## ⚠️ 注意事项

### 用户数据迁移

如果您有现有的Clerk用户数据，需要：

1. **手动迁移用户数据**:
   ```sql
   -- 示例：从Clerk用户ID映射到新的User表
   -- 需要根据实际情况调整
   INSERT INTO "User" (id, email, name, "emailVerified", "createdAt")
   SELECT 
     gen_random_uuid(), -- 生成新的ID
     clerk_email,
     clerk_name,
     NOW(),
     clerk_created_at
   FROM your_existing_clerk_data;
   ```

2. **更新Whisper表的userId引用**:
   ```sql
   -- 更新whisper记录的userId字段
   UPDATE "Whisper" 
   SET "userId" = (
     SELECT id FROM "User" 
     WHERE email = clerk_user_email
   )
   WHERE clerk_user_id = old_clerk_id;
   ```

### 会话管理

- NextAuth.js 使用 JWT 策略进行会话管理
- 会话默认有效期为 30 天
- 支持自动会话刷新

### 安全性

- 所有密码使用 bcrypt 加密 (salt rounds: 12)
- CSRF 保护自动启用
- 环境变量中的 `NEXTAUTH_SECRET` 必须设置

## 🎯 最佳实践

1. **环境变量安全性**
   - 使用强随机密钥作为 `NEXTAUTH_SECRET`
   - 不要在代码中硬编码密钥

2. **用户体验**
   - 提供清晰的错误消息
   - 实现密码强度验证
   - 支持自动登录后注册

3. **性能优化**
   - 使用数据库连接池
   - 适当的会话存储策略
   - 缓存用户权限信息

## 🆘 故障排除

### 常见问题

1. **"Invalid credentials" 错误**
   - 检查密码是否正确加密
   - 验证邮箱格式和大小写

2. **OAuth 登录失败**
   - 确认 OAuth 应用配置正确
   - 检查回调 URL 设置

3. **会话持久化问题**
   - 验证数据库连接
   - 检查 Session 表结构

4. **中间件重定向循环**
   - 确认路径匹配规则
   - 检查公共路径配置

### 调试模式

启用 NextAuth.js 调试模式：

```env
NEXTAUTH_DEBUG=true
```

## 📞 支持

如果在迁移过程中遇到问题，请：

1. 检查 NextAuth.js 官方文档
2. 验证所有配置文件
3. 查看控制台错误日志
4. 确认数据库连接状态

迁移完成后，您将拥有一个完全自主控制的认证系统，无需依赖第三方认证服务。
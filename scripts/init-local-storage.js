#!/usr/bin/env node

/**
 * 初始化本地存储环境
 * 创建必要的目录和设置权限
 */

const fs = require('fs');
const path = require('path');

// 尝试读取环境变量文件
function loadEnvFile() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          process.env[key] = value;
        }
      }
    }
  }
}

const UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './public/uploads';

async function initializeLocalStorage() {
  try {
    console.log('🚀 Initializing local file storage...');
    
    // 加载环境变量
    loadEnvFile();
    
    // 创建上传目录
    const uploadPath = path.resolve(UPLOAD_DIR);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log(`✅ Created upload directory: ${uploadPath}`);
    } else {
      console.log(`✅ Upload directory already exists: ${uploadPath}`);
    }
    
    // 创建 .gitignore 文件以忽略上传的文件
    const gitignorePath = path.join(uploadPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
      console.log('✅ Created .gitignore in upload directory');
    }
    
    // 验证目录权限
    try {
      const testFile = path.join(uploadPath, 'test.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('✅ Upload directory is writable');
    } catch (error) {
      console.error('❌ Upload directory is not writable:', error.message);
      process.exit(1);
    }
    
    // 检查环境变量
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      console.warn('⚠️  NEXT_PUBLIC_BASE_URL not set, using default: http://localhost:3000');
    } else {
      console.log(`✅ Base URL configured: ${baseUrl}`);
    }
    
    console.log('\n🎉 Local storage initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Make sure your .env.local file is properly configured');
    console.log('2. Run "npm run dev" to start the development server');
    console.log('3. Upload files will be stored in:', uploadPath);
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// 运行初始化
initializeLocalStorage();
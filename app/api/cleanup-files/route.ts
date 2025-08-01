import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldFiles } from '@/lib/fileUtils';

export async function POST(request: NextRequest) {
  try {
    // 验证请求权限（可以添加API密钥验证）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取清理配置
    const maxAgeDays = parseInt(process.env.FILE_CLEANUP_MAX_AGE_DAYS || '7');
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // 转换为毫秒

    // 执行清理
    const deletedCount = await cleanupOldFiles(maxAge);

    return NextResponse.json({
      success: true,
      deletedFiles: deletedCount,
      maxAgeDays,
      message: `Cleaned up ${deletedCount} files older than ${maxAgeDays} days`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// GET方法用于查看清理状态（仅统计，不删除）
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const fs = await import('fs');
    const path = await import('path');
    
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || './public/uploads';
    const maxAgeDays = parseInt(process.env.FILE_CLEANUP_MAX_AGE_DAYS || '7');
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({
        totalFiles: 0,
        oldFiles: 0,
        maxAgeDays
      });
    }

    const files = fs.readdirSync(uploadDir);
    let oldFiles = 0;

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      
      if (Date.now() - stats.mtime.getTime() > maxAge) {
        oldFiles++;
      }
    }

    return NextResponse.json({
      totalFiles: files.length,
      oldFiles,
      maxAgeDays,
      message: `${oldFiles} files are older than ${maxAgeDays} days and can be cleaned up`
    });

  } catch (error) {
    console.error('Cleanup status error:', error);
    return NextResponse.json(
      { error: 'Failed to get cleanup status' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { getFileInfo } from '@/lib/fileUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/');
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || './public/uploads';
    const fullPath = path.join(uploadDir, filePath);
    
    // 安全检查：确保请求的文件在上传目录内
    const normalizedUploadDir = path.resolve(uploadDir);
    const normalizedFilePath = path.resolve(fullPath);
    
    if (!normalizedFilePath.startsWith(normalizedUploadDir)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // 检查文件是否存在
    const fileInfo = getFileInfo(fullPath);
    if (!fileInfo.exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // 读取文件
    const fileBuffer = await readFile(fullPath);
    
    // 获取文件扩展名并设置合适的 Content-Type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = getContentType(ext);
    
    // 设置响应头
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000', // 缓存一年
      'ETag': `"${fileInfo.modified?.getTime() || Date.now()}"`,
    });
    
    // 如果是音频文件，添加 Accept-Ranges 头以支持范围请求
    if (contentType.startsWith('audio/')) {
      headers.set('Accept-Ranges', 'bytes');
    }
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
  };
  
  return contentTypes[extension] || 'application/octet-stream';
}
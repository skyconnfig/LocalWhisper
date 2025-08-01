import { NextRequest, NextResponse } from 'next/server';
import { saveFileLocally, isValidAudioFile } from '@/lib/fileUtils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // 验证文件类型
    if (!isValidAudioFile(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only audio files are allowed.' },
        { status: 400 }
      );
    }
    
    // 验证文件大小 (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }
    
    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 保存文件
    const result = await saveFileLocally(buffer, file.name, file.type);
    
    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      size: file.size,
      type: file.type
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// 可选：添加GET方法来获取文件信息
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  
  if (!filename) {
    return NextResponse.json(
      { error: 'Filename parameter required' },
      { status: 400 }
    );
  }
  
  try {
    const { getFileInfo } = await import('@/lib/fileUtils');
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || './public/uploads';
    const filePath = `${uploadDir}/${filename}`;
    const info = getFileInfo(filePath);
    
    if (!info.exists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      exists: info.exists,
      size: info.size,
      created: info.created,
      modified: info.modified
    });
    
  } catch (error) {
    console.error('File info error:', error);
    return NextResponse.json(
      { error: 'Failed to get file info' },
      { status: 500 }
    );
  }
}
import fs from 'fs';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// 本地文件存储配置
const UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './public/uploads';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// 确保上传目录存在
export async function ensureUploadDir() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to create upload directory:', error);
    throw error;
  }
}

// 保存文件到本地存储
export async function saveFileLocally(
  file: Buffer | Uint8Array, 
  originalName: string, 
  mimeType: string
): Promise<{ url: string; filename: string; path: string }> {
  await ensureUploadDir();
  
  // 生成唯一文件名
  const fileExtension = getFileExtension(originalName, mimeType);
  const filename = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  
  try {
    await writeFile(filePath, file);
    
    // 生成访问URL
    const url = `${BASE_URL}/uploads/${filename}`;
    
    return {
      url,
      filename,
      path: filePath
    };
  } catch (error) {
    console.error('Failed to save file:', error);
    throw error;
  }
}

// 删除本地文件
export async function deleteFileLocally(filePath: string): Promise<boolean> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
}

// 从URL中提取文件名
export function getFilenameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    return pathname.split('/').pop() || null;
  } catch {
    return null;
  }
}

// 获取文件扩展名
function getFileExtension(originalName: string, mimeType: string): string {
  // 首先尝试从原始文件名获取扩展名
  const nameExtension = path.extname(originalName);
  if (nameExtension) {
    return nameExtension;
  }
  
  // 根据MIME类型获取扩展名
  const mimeExtensions: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/mpeg3': '.mp3',
    'audio/x-mpeg-3': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-pn-wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/m4a': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac'
  };
  
  return mimeExtensions[mimeType] || '.audio';
}

// 获取文件信息
export function getFileInfo(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch {
    return {
      exists: false,
      size: 0,
      created: null,
      modified: null
    };
  }
}

// 验证文件类型
export function isValidAudioFile(mimeType: string): boolean {
  const validMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mpeg3',
    'audio/x-mpeg-3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/x-pn-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm',
    'audio/ogg',
    'audio/flac'
  ];
  
  return validMimeTypes.includes(mimeType);
}

// 清理过期文件（可选功能）
export async function cleanupOldFiles(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    await ensureUploadDir();
    const files = fs.readdirSync(UPLOAD_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);
      
      // 如果文件超过指定年龄，则删除
      if (Date.now() - stats.mtime.getTime() > maxAge) {
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete old file ${file}:`, error);
        }
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old files:', error);
    return 0;
  }
}
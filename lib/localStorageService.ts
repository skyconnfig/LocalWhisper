import { Client as MinioClient } from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

// Types
export interface StorageConfig {
  strategy: 'minio' | 'filesystem';
  minioConfig?: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    region: string;
  };
  bucketName: string;
  tempBucketName: string;
  filesystemUploadDir?: string;
  maxFileSize: number;
  allowedFormats: string[];
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
}

export interface FileMetadata {
  originalName: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  userId?: string;
}

// Storage service class
export class LocalStorageService {
  private minioClient?: MinioClient;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    
    if (config.strategy === 'minio' && config.minioConfig) {
      this.minioClient = new MinioClient(config.minioConfig);
    }
  }

  /**
   * Initialize storage service (create buckets, directories, etc.)
   */
  async initialize(): Promise<void> {
    if (this.config.strategy === 'minio' && this.minioClient) {
      await this.initializeMinIO();
    } else if (this.config.strategy === 'filesystem') {
      await this.initializeFileSystem();
    }
  }

  private async initializeMinIO(): Promise<void> {
    if (!this.minioClient) throw new Error('MinIO client not initialized');

    try {
      // Check if main bucket exists, create if not
      const bucketExists = await this.minioClient.bucketExists(this.config.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.config.bucketName, this.config.minioConfig?.region || 'us-east-1');
        console.log(`Created bucket: ${this.config.bucketName}`);
      }

      // Check if temp bucket exists, create if not
      const tempBucketExists = await this.minioClient.bucketExists(this.config.tempBucketName);
      if (!tempBucketExists) {
        await this.minioClient.makeBucket(this.config.tempBucketName, this.config.minioConfig?.region || 'us-east-1');
        console.log(`Created temp bucket: ${this.config.tempBucketName}`);
      }

      // Set bucket policy for public read access (optional)
      const publicReadPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.config.bucketName}/*`]
          }
        ]
      };

      await this.minioClient.setBucketPolicy(this.config.bucketName, JSON.stringify(publicReadPolicy));
      console.log('MinIO initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MinIO:', error);
      throw error;
    }
  }

  private async initializeFileSystem(): Promise<void> {
    if (!this.config.filesystemUploadDir) {
      throw new Error('Filesystem upload directory not configured');
    }

    try {
      // Create upload directory if it doesn't exist
      await fs.promises.mkdir(this.config.filesystemUploadDir, { recursive: true });
      
      // Create temp directory
      const tempDir = path.join(this.config.filesystemUploadDir, 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });
      
      console.log('Filesystem storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize filesystem storage:', error);
      throw error;
    }
  }

  /**
   * Upload file from buffer
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    metadata: Partial<FileMetadata> = {},
    isTemp: boolean = false
  ): Promise<UploadResult> {
    // Validate file size
    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    // Validate file format
    const fileExtension = path.extname(fileName).toLowerCase().slice(1);
    if (!this.config.allowedFormats.includes(fileExtension)) {
      throw new Error(`File format .${fileExtension} is not allowed`);
    }

    // Generate unique key
    const uniqueKey = this.generateUniqueKey(fileName, metadata.userId);
    const bucketName = isTemp ? this.config.tempBucketName : this.config.bucketName;

    if (this.config.strategy === 'minio') {
      return await this.uploadToMinIO(buffer, uniqueKey, contentType, metadata, bucketName);
    } else {
      return await this.uploadToFileSystem(buffer, uniqueKey, contentType, metadata, isTemp);
    }
  }

  private async uploadToMinIO(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata: Partial<FileMetadata>,
    bucketName: string
  ): Promise<UploadResult> {
    if (!this.minioClient) throw new Error('MinIO client not initialized');

    try {
      const metaData = {
        'Content-Type': contentType,
        'X-Amz-Meta-Original-Name': metadata.originalName || key,
        'X-Amz-Meta-Uploaded-At': new Date().toISOString(),
        'X-Amz-Meta-User-Id': metadata.userId || 'anonymous'
      };

      const stream = Readable.from(buffer);
      await this.minioClient.putObject(bucketName, key, stream, buffer.length, metaData);

      // Generate URL
      const url = await this.minioClient.presignedGetObject(bucketName, key, 24 * 60 * 60); // 24 hours

      return {
        url,
        key,
        bucket: bucketName,
        size: buffer.length,
        contentType
      };
    } catch (error) {
      console.error('MinIO upload failed:', error);
      throw new Error(`Failed to upload file to MinIO: ${error}`);
    }
  }

  private async uploadToFileSystem(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata: Partial<FileMetadata>,
    isTemp: boolean
  ): Promise<UploadResult> {
    if (!this.config.filesystemUploadDir) {
      throw new Error('Filesystem upload directory not configured');
    }

    try {
      const uploadDir = isTemp 
        ? path.join(this.config.filesystemUploadDir, 'temp')
        : this.config.filesystemUploadDir;
      
      const filePath = path.join(uploadDir, key);
      
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write file
      await fs.promises.writeFile(filePath, buffer);
      
      // Write metadata
      const metadataPath = filePath + '.meta.json';
      const metadataContent = {
        originalName: metadata.originalName || key,
        size: buffer.length,
        contentType,
        uploadedAt: new Date().toISOString(),
        userId: metadata.userId || 'anonymous'
      };
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadataContent, null, 2));

      // Generate local URL
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/files/${isTemp ? 'temp/' : ''}${key}`;

      return {
        url,
        key,
        bucket: isTemp ? 'temp' : 'files',
        size: buffer.length,
        contentType
      };
    } catch (error) {
      console.error('Filesystem upload failed:', error);
      throw new Error(`Failed to upload file to filesystem: ${error}`);
    }
  }

  /**
   * Get file as stream
   */
  async getFileStream(key: string, isTemp: boolean = false): Promise<NodeJS.ReadableStream> {
    const bucketName = isTemp ? this.config.tempBucketName : this.config.bucketName;

    if (this.config.strategy === 'minio') {
      if (!this.minioClient) throw new Error('MinIO client not initialized');
      return await this.minioClient.getObject(bucketName, key);
    } else {
      if (!this.config.filesystemUploadDir) {
        throw new Error('Filesystem upload directory not configured');
      }
      
      const uploadDir = isTemp 
        ? path.join(this.config.filesystemUploadDir, 'temp')
        : this.config.filesystemUploadDir;
      
      const filePath = path.join(uploadDir, key);
      return fs.createReadStream(filePath);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(key: string, isTemp: boolean = false): Promise<void> {
    const bucketName = isTemp ? this.config.tempBucketName : this.config.bucketName;

    if (this.config.strategy === 'minio') {
      if (!this.minioClient) throw new Error('MinIO client not initialized');
      await this.minioClient.removeObject(bucketName, key);
    } else {
      if (!this.config.filesystemUploadDir) {
        throw new Error('Filesystem upload directory not configured');
      }
      
      const uploadDir = isTemp 
        ? path.join(this.config.filesystemUploadDir, 'temp')
        : this.config.filesystemUploadDir;
      
      const filePath = path.join(uploadDir, key);
      const metadataPath = filePath + '.meta.json';
      
      await fs.promises.unlink(filePath);
      
      // Delete metadata file if exists
      try {
        await fs.promises.unlink(metadataPath);
      } catch (error) {
        // Ignore if metadata file doesn't exist
      }
    }
  }

  /**
   * List files
   */
  async listFiles(prefix: string = '', isTemp: boolean = false): Promise<string[]> {
    const bucketName = isTemp ? this.config.tempBucketName : this.config.bucketName;

    if (this.config.strategy === 'minio') {
      if (!this.minioClient) throw new Error('MinIO client not initialized');
      
      const objectsStream = this.minioClient.listObjects(bucketName, prefix, true);
      const objects: string[] = [];
      
      return new Promise((resolve, reject) => {
        objectsStream.on('data', (obj) => {
          if (obj.name) objects.push(obj.name);
        });
        objectsStream.on('error', reject);
        objectsStream.on('end', () => resolve(objects));
      });
    } else {
      if (!this.config.filesystemUploadDir) {
        throw new Error('Filesystem upload directory not configured');
      }
      
      const uploadDir = isTemp 
        ? path.join(this.config.filesystemUploadDir, 'temp')
        : this.config.filesystemUploadDir;
      
      const files = await fs.promises.readdir(uploadDir);
      return files.filter(file => 
        file.startsWith(prefix) && !file.endsWith('.meta.json')
      );
    }
  }

  /**
   * Cleanup old temporary files
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let deletedCount = 0;

    if (this.config.strategy === 'minio') {
      if (!this.minioClient) throw new Error('MinIO client not initialized');
      
      const objectsStream = this.minioClient.listObjects(this.config.tempBucketName, '', true);
      
      for await (const obj of objectsStream) {
        if (obj.name && obj.lastModified && obj.lastModified < cutoffTime) {
          await this.minioClient.removeObject(this.config.tempBucketName, obj.name);
          deletedCount++;
        }
      }
    } else {
      if (!this.config.filesystemUploadDir) {
        throw new Error('Filesystem upload directory not configured');
      }
      
      const tempDir = path.join(this.config.filesystemUploadDir, 'temp');
      const files = await fs.promises.readdir(tempDir);
      
      for (const file of files) {
        if (file.endsWith('.meta.json')) continue;
        
        const filePath = path.join(tempDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.mtime < cutoffTime) {
          await fs.promises.unlink(filePath);
          
          // Also delete metadata file
          const metadataPath = filePath + '.meta.json';
          try {
            await fs.promises.unlink(metadataPath);
          } catch (error) {
            // Ignore if metadata file doesn't exist
          }
          
          deletedCount++;
        }
      }
    }

    console.log(`Cleaned up ${deletedCount} temporary files older than ${olderThanHours} hours`);
    return deletedCount;
  }

  /**
   * Generate unique key for file
   */
  private generateUniqueKey(originalName: string, userId?: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    const userPrefix = userId ? `users/${userId}/` : '';
    const datePrefix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    return `${userPrefix}${datePrefix}/${timestamp}-${uuid}-${baseName}${extension}`;
  }

  /**
   * Get file info
   */
  async getFileInfo(key: string, isTemp: boolean = false): Promise<FileMetadata | null> {
    const bucketName = isTemp ? this.config.tempBucketName : this.config.bucketName;

    if (this.config.strategy === 'minio') {
      if (!this.minioClient) throw new Error('MinIO client not initialized');
      
      try {
        const stat = await this.minioClient.statObject(bucketName, key);
        return {
          originalName: stat.metaData?.['x-amz-meta-original-name'] || key,
          size: stat.size,
          contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
          uploadedAt: new Date(stat.metaData?.['x-amz-meta-uploaded-at'] || stat.lastModified),
          userId: stat.metaData?.['x-amz-meta-user-id']
        };
      } catch (error) {
        console.error('Failed to get file info from MinIO:', error);
        return null;
      }
    } else {
      if (!this.config.filesystemUploadDir) {
        throw new Error('Filesystem upload directory not configured');
      }
      
      const uploadDir = isTemp 
        ? path.join(this.config.filesystemUploadDir, 'temp')
        : this.config.filesystemUploadDir;
      
      const filePath = path.join(uploadDir, key);
      const metadataPath = filePath + '.meta.json';
      
      try {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        return {
          originalName: metadata.originalName,
          size: metadata.size,
          contentType: metadata.contentType,
          uploadedAt: new Date(metadata.uploadedAt),
          userId: metadata.userId
        };
      } catch (error) {
        console.error('Failed to get file metadata:', error);
        return null;
      }
    }
  }
}

// Helper function to create storage service instance
export function createStorageService(): LocalStorageService {
  const storageStrategy = (process.env.STORAGE_STRATEGY as 'minio' | 'filesystem') || 'minio';
  
  const config: StorageConfig = {
    strategy: storageStrategy,
    bucketName: process.env.MINIO_BUCKET_NAME || 'audio-files',
    tempBucketName: process.env.MINIO_TEMP_BUCKET_NAME || 'temp-files',
    maxFileSize: parseFileSize(process.env.MAX_FILE_SIZE || '100MB'),
    allowedFormats: (process.env.ALLOWED_AUDIO_FORMATS || 'mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4').split(','),
    filesystemUploadDir: process.env.FILESYSTEM_UPLOAD_DIR || './uploads'
  };

  if (storageStrategy === 'minio') {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const url = new URL(endpoint);
    
    config.minioConfig = {
      endPoint: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:' || process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
      region: process.env.MINIO_REGION || 'us-east-1'
    };
  }

  return new LocalStorageService(config);
}

// Helper function to parse file size
function parseFileSize(sizeStr: string): number {
  const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  
  if (!match) {
    throw new Error(`Invalid file size format: ${sizeStr}`);
  }
  
  const size = parseFloat(match[1]);
  const unit = match[2].toUpperCase() as keyof typeof units;
  
  return Math.floor(size * units[unit]);
}
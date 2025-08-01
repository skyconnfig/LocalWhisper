# Local File Storage Solution for Whisper App

This document provides a comprehensive guide for the local file storage solution that replaces AWS S3.

## Overview

The local storage solution offers two strategies:
1. **MinIO** (Recommended) - S3-compatible object storage
2. **Filesystem** - Direct filesystem storage

## Architecture

```
Whisper App
├── MinIO (S3-compatible storage)
│   ├── audio-files bucket (permanent files)
│   └── temp-files bucket (temporary files)
├── Redis (caching and session management)
└── Local Filesystem (fallback option)
```

## Features

- **S3 Compatibility**: Drop-in replacement for AWS S3
- **Multiple Storage Strategies**: MinIO or filesystem
- **File Management**: Upload, download, delete operations
- **Security**: User-based access control
- **Automatic Cleanup**: Scheduled cleanup of temporary files
- **File Validation**: Size and format restrictions
- **Metadata Storage**: File information tracking

## Setup Instructions

### 1. Quick Setup

Run the automated setup script:

```bash
./setup-storage.sh
```

### 2. Manual Setup

#### Prerequisites
- Docker and Docker Compose
- Node.js 18+
- npm or pnpm

#### Step 1: Install Dependencies

```bash
npm install minio
```

#### Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your configuration:

```env
# MinIO Configuration
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_REGION=us-east-1
MINIO_BUCKET_NAME=audio-files
MINIO_TEMP_BUCKET_NAME=temp-files

# Redis Configuration
REDIS_URL=redis://:redis123@localhost:6379

# File Storage Configuration
MAX_FILE_SIZE=100MB
ALLOWED_AUDIO_FORMATS=mp3,wav,m4a,ogg,flac,aac,wma,webm,mp4
TEMP_FILE_CLEANUP_INTERVAL=3600000
AUTO_DELETE_AFTER_DAYS=30

# Storage Strategy
STORAGE_STRATEGY=minio  # or 'filesystem'
FILESYSTEM_UPLOAD_DIR=./uploads
```

#### Step 3: Start Services

```bash
docker-compose up -d
```

#### Step 4: Start Application

```bash
npm run dev
```

Or use the start script:

```bash
./start-app.sh
```

## Usage

### File Upload

The app automatically handles file uploads through the existing interface. Files are:

1. Validated for size and format
2. Uploaded to the configured storage
3. Organized by user and date
4. Made available for transcription

### File Access

Files are accessible through:

- **Direct URL**: `/api/files/[...path]`
- **Download**: Add `?download=true` parameter
- **Temporary files**: `/api/files/temp/[...path]`

### File Management

#### List Files

```bash
GET /api/files?prefix=users/user-id/
```

#### Delete File

```bash
DELETE /api/files/path/to/file
```

#### Cleanup Temporary Files

```bash
DELETE /api/files?action=cleanup-temp&hours=24
```

## Storage Strategies

### MinIO (Recommended)

**Advantages:**
- S3-compatible API
- Web-based management console
- Scalable and production-ready
- Built-in access control
- Excellent performance

**Configuration:**
- Runs on port 9000 (API) and 9001 (Console)
- Automatic bucket creation
- Public read access for audio files
- Built-in metadata storage

**Access MinIO Console:**
- URL: http://localhost:9001
- Username: minioadmin
- Password: minioadmin123

### Filesystem

**Advantages:**
- Simple setup
- No additional services
- Direct file access

**Disadvantages:**
- No built-in access control
- Manual metadata management
- Less scalable

**Configuration:**
- Files stored in `./uploads` directory
- Metadata stored as `.meta.json` files
- Temporary files in `./uploads/temp`

## File Organization

### Directory Structure

```
MinIO Buckets:
├── audio-files/
│   └── users/
│       └── [user-id]/
│           └── [date]/
│               └── [timestamp]-[uuid]-[filename]
└── temp-files/
    └── [timestamp]-[uuid]-[filename]

Filesystem:
├── uploads/
│   ├── users/
│   │   └── [user-id]/
│   │       └── [date]/
│   │           ├── [timestamp]-[uuid]-[filename]
│   │           └── [timestamp]-[uuid]-[filename].meta.json
│   └── temp/
│       ├── [timestamp]-[uuid]-[filename]
│       └── [timestamp]-[uuid]-[filename].meta.json
```

### File Naming Convention

Files are named using the pattern:
```
[timestamp]-[uuid]-[original-filename]
```

Example:
```
1698765432123-a1b2c3d4-e5f6-7890-abcd-ef1234567890-recording.webm
```

## API Endpoints

### Upload Endpoint

```
POST /api/s3-upload
Content-Type: multipart/form-data

Body: FormData with 'file' field
```

**Response:**
```json
{
  "url": "http://localhost:3000/api/files/users/user123/2024-01-01/file.webm",
  "key": "users/user123/2024-01-01/1698765432123-uuid-file.webm",
  "bucket": "audio-files",
  "size": 1048576,
  "contentType": "audio/webm"
}
```

### File Access Endpoints

```
GET /api/files/[...path]           # Stream file
GET /api/files/[...path]?download=true  # Download file
DELETE /api/files/[...path]        # Delete file
```

### Management Endpoints

```
GET /api/files                     # List user files
GET /api/files?temp=true          # List temporary files
DELETE /api/files?action=cleanup-temp&hours=24  # Cleanup
```

### Cleanup Endpoint

```
GET /api/cleanup                   # Manual cleanup (cron)
```

## Security

### Access Control

- **Authentication**: Clerk-based user authentication
- **Authorization**: User-specific file access
- **File Validation**: Type and size restrictions
- **Path Traversal Protection**: Secure file path handling

### File Permissions

- Users can only access their own files
- Temporary files are publicly accessible
- Administrative cleanup requires special authentication

## Monitoring and Maintenance

### Health Checks

Check service status:

```bash
# MinIO health
curl http://localhost:9000/minio/health/live

# Redis health
docker exec whisper-redis redis-cli -a redis123 ping
```

### Logs

View service logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f minio
docker-compose logs -f redis
```

### Backup

#### MinIO Backup

```bash
# Export MinIO data
docker exec whisper-minio-init mc mirror minio/audio-files /backup/audio-files
docker exec whisper-minio-init mc mirror minio/temp-files /backup/temp-files
```

#### Filesystem Backup

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/
```

### Cleanup

#### Manual Cleanup

```bash
# Remove old temporary files
curl -X DELETE "http://localhost:3000/api/files?action=cleanup-temp&hours=24"
```

#### Scheduled Cleanup

Add to crontab for automated cleanup:

```bash
# Run cleanup every hour
0 * * * * curl -H "Authorization: Bearer local-cron-secret" http://localhost:3000/api/cleanup
```

## Troubleshooting

### Common Issues

#### MinIO Not Starting

```bash
# Check Docker logs
docker-compose logs minio

# Restart services
docker-compose restart minio
```

#### Permission Errors

```bash
# Fix directory permissions
sudo chown -R $USER:$USER uploads/
chmod -R 755 uploads/
```

#### Storage Full

```bash
# Check disk usage
df -h

# Clean temporary files
rm -rf uploads/temp/*
```

#### Connection Refused

- Ensure Docker services are running
- Check port conflicts (9000, 9001, 6379)
- Verify firewall settings

### Performance Optimization

#### MinIO Performance

- Use SSD storage for better performance
- Increase MinIO memory limits in docker-compose.yml
- Enable compression for large files

#### Application Performance

- Implement file caching
- Use streaming for large file uploads
- Add CDN for static file serving

## Production Deployment

### Security Hardening

1. **Change Default Credentials**
```env
MINIO_ACCESS_KEY=your-secure-access-key
MINIO_SECRET_KEY=your-secure-secret-key-min-8-chars
```

2. **Enable HTTPS**
```env
MINIO_ENDPOINT=https://your-domain.com:9000
MINIO_USE_SSL=true
```

3. **Configure Firewall**
```bash
# Allow only necessary ports
ufw allow 3000  # Next.js
ufw allow 9000  # MinIO API
ufw allow 9001  # MinIO Console (admin only)
```

4. **Set Resource Limits**
```yaml
# docker-compose.yml
services:
  minio:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

### Scaling Considerations

- Use external Redis for session storage
- Implement load balancing for multiple app instances
- Consider MinIO clustering for high availability
- Set up monitoring and alerting

## Migration from AWS S3

If migrating from AWS S3:

1. Export existing files from S3
2. Update environment variables
3. Import files to MinIO
4. Update application configuration
5. Test file access and uploads

The API remains compatible, so no frontend changes are required.

## Support

For issues and questions:

1. Check Docker service logs
2. Verify environment configuration
3. Test with minimal setup
4. Review file permissions
5. Check network connectivity

## License

This local storage solution is part of the Whisper app and follows the same license terms.
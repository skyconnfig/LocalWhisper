import { NextRequest, NextResponse } from 'next/server';
import { createStorageService } from '@/lib/localStorageService';
import { auth } from '@clerk/nextjs/server';

// Initialize storage service
const storageService = createStorageService();

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize storage service if not already done
    await storageService.initialize();

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav', 
      'audio/mp4',
      'audio/m4a',
      'audio/ogg',
      'audio/flac',
      'audio/aac',
      'audio/wma',
      'audio/webm',
      'video/webm', // For recorded audio
      'video/mp4'   // For recorded audio
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload file
    const result = await storageService.uploadFile(
      buffer,
      file.name,
      file.type,
      {
        originalName: file.name,
        size: file.size,
        userId: userId
      }
    );

    // Return upload result in format expected by frontend
    return NextResponse.json({
      url: result.url,
      key: result.key,
      bucket: result.bucket,
      size: result.size,
      contentType: result.contentType
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createStorageService } from '@/lib/localStorageService';
import { auth } from '@clerk/nextjs/server';

const storageService = createStorageService();

// List files endpoint
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await storageService.initialize();

    const { searchParams } = new URL(request.url);
    const isTemp = searchParams.get('temp') === 'true';
    const prefix = searchParams.get('prefix') || `users/${userId}/`;

    // List files for the user
    const files = await storageService.listFiles(prefix, isTemp);
    
    // Get file info for each file
    const filesWithInfo = await Promise.all(
      files.map(async (key) => {
        const info = await storageService.getFileInfo(key, isTemp);
        return {
          key,
          ...info,
          url: `/api/files/${isTemp ? 'temp/' : ''}${key}`
        };
      })
    );

    return NextResponse.json({
      files: filesWithInfo,
      total: filesWithInfo.length
    });

  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}

// Cleanup endpoint
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await storageService.initialize();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'cleanup-temp') {
      const hoursParam = searchParams.get('hours');
      const hours = hoursParam ? parseInt(hoursParam) : 24;
      
      const deletedCount = await storageService.cleanupTempFiles(hours);
      
      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} temporary files older than ${hours} hours`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}
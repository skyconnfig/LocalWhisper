import { NextRequest, NextResponse } from 'next/server';
import { createStorageService } from '@/lib/localStorageService';

const storageService = createStorageService();

// Cleanup cron job endpoint
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (optional security measure)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'local-cron-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await storageService.initialize();

    // Clean up temporary files older than 24 hours
    const tempCleanupCount = await storageService.cleanupTempFiles(24);

    // TODO: Add more cleanup tasks here
    // - Delete old audio files based on retention policy
    // - Clean up orphaned metadata
    // - Archive old files to cheaper storage

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      tasks: {
        tempFilesCleanup: {
          deletedCount: tempCleanupCount,
          status: 'completed'
        }
      }
    };

    console.log('Cleanup cron job completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Cleanup cron job failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
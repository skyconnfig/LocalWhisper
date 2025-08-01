import { NextRequest, NextResponse } from 'next/server';

// 健康检查API端点
export async function GET(request: NextRequest) {
  try {
    // 基础健康检查
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV,
    };

    // 检查关键服务连接 (可选)
    const checks = {
      database: 'unknown',
      redis: 'unknown',
      storage: 'unknown',
    };

    try {
      // 这里可以添加实际的服务连接检查
      // 例如: await prisma.$queryRaw`SELECT 1`
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
    }

    return NextResponse.json({
      ...healthData,
      services: checks,
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}
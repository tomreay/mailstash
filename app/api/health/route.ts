import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { virusScanner } from '@/lib/security/virus-scanner';

export async function GET() {
  try {
    // Check database connectivity
    await db.$queryRaw`SELECT 1`;

    // Check virus scanner
    const scannerAvailable = await virusScanner.isAvailable();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        virusScanner: scannerAvailable ? 'healthy' : 'unavailable',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

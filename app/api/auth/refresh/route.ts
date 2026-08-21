import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  handleApiError,
  parseJson,
  rotateRefreshToken,
  UnauthorizedError,
} from '@/lib/api';

const bodySchema = z.object({
  refresh: z.string().min(1),
});

/**
 * Rotates a refresh token: the presented token is revoked and a fresh
 * access+refresh pair is returned. The refresh token itself is the credential,
 * so no session/bearer is required. An invalid/expired/revoked token yields 401.
 */
export async function POST(request: Request) {
  try {
    const { refresh } = await parseJson(request, bodySchema);

    const rotated = await rotateRefreshToken(refresh);
    if (!rotated) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    return NextResponse.json({
      access: rotated.access,
      refresh: rotated.refresh,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

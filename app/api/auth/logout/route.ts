import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, parseJson, revokeRefreshToken } from '@/lib/api';

const bodySchema = z.object({
  refresh: z.string().min(1),
});

/**
 * Revokes a refresh token (mobile logout / device deregistration). Idempotent —
 * always returns success and never reveals whether the token existed. Any
 * already-issued access token expires on its own short TTL.
 */
export async function POST(request: Request) {
  try {
    const { refresh } = await parseJson(request, bodySchema);
    await revokeRefreshToken(refresh);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

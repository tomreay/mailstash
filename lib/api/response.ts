import { NextResponse } from 'next/server';
import { ApiError } from './errors';

/**
 * Maps any thrown value to a consistent JSON error response.
 *
 * - `ApiError` subclasses → their `status` + message.
 * - anything else → 500 with a generic message (the real error is logged, never
 *   leaked to the client).
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

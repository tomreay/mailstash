import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors';

/**
 * Maps any thrown value to a consistent JSON error response.
 *
 * - `ApiError` subclasses → their `status` + message.
 * - `ZodError` → 400 with the first issue's message.
 * - anything else → 500 with a generic message (the real error is logged, never
 *   leaked to the client).
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    const message = first
      ? `${first.path.join('.') || 'request'}: ${first.message}`
      : 'Invalid request';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

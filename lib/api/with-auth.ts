import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError } from './response';
import { UnauthorizedError } from './errors';
import { verifyAccessToken } from './tokens';

/**
 * Resolves the authenticated user's id from a request, accepting EITHER
 * credential type so web and iOS share the same routes:
 *
 *  1. next-auth **session cookie** (web) — checked first.
 *  2. `Authorization: Bearer <accessToken>` (iOS) — a signed access JWT.
 *
 * Returns `null` if neither yields a valid user.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return verifyAccessToken(header.slice('Bearer '.length).trim());
  }

  return null;
}

/** Context handed to an authenticated route handler. */
export interface AuthContext<Params = unknown> {
  /** The authenticated user's id. Guaranteed present. */
  userId: string;
  /** Resolved dynamic route params (e.g. `{ id }`), if the route has any. */
  params: Params;
}

type RouteHandler<Params> = (
  request: Request,
  context: AuthContext<Params>
) => Promise<NextResponse> | NextResponse;

/**
 * The second arg Next.js passes to a route handler. For dynamic routes `params`
 * resolves to the segment values; for static routes it resolves to `{}`. Typed
 * to match Next's generated `RouteContext` so wrapped handlers can be exported
 * directly as route handlers.
 */
interface NextRouteContext<Params> {
  params: Promise<Params>;
}

/**
 * Wraps an API route handler with authentication + centralized error handling.
 *
 * - Resolves `userId` from either a session cookie (web) or a bearer access
 *   token (iOS) via {@link resolveUserId}; 401 if neither is valid. Every route
 *   checks auth the same way and accepts both clients.
 * - Awaits and forwards dynamic route params.
 * - Routes any thrown value through {@link handleApiError}, so handlers can throw
 *   typed errors instead of hand-rolling try/catch + status mapping.
 */
export function withAuth<Params = Record<string, never>>(
  handler: RouteHandler<Params>
): (
  request: Request,
  context: NextRouteContext<Params>
) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      const userId = await resolveUserId(request);

      if (!userId) {
        throw new UnauthorizedError();
      }

      const params = (await context.params) as Params;

      return await handler(request, { userId, params });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

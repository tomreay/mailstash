import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError } from './response';
import { UnauthorizedError } from './errors';

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
 * - Resolves the session and yields `userId` (401 if there is no authenticated
 *   user), so every route checks auth the same way — a single grep for
 *   `withAuth` answers "is this route protected?".
 * - Awaits and forwards dynamic route params.
 * - Routes any thrown value through {@link handleApiError}, so handlers can throw
 *   typed errors (or let a `ZodError` propagate) instead of hand-rolling
 *   try/catch + status mapping.
 *
 * Auth currently resolves the next-auth session cookie. Bearer-token support for
 * the iOS client (issue #12) extends this one function without changing any
 * route signature.
 */
export function withAuth<Params = Record<string, never>>(
  handler: RouteHandler<Params>
): (
  request: Request,
  context: NextRouteContext<Params>
) => Promise<NextResponse> {
  return async (request, context) => {
    try {
      const session = await auth();

      if (!session?.user?.id) {
        throw new UnauthorizedError();
      }

      const params = (await context.params) as Params;

      return await handler(request, { userId: session.user.id, params });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  parseJson,
  signAccessToken,
  issueRefreshToken,
  UnauthorizedError,
} from '@/lib/api';

const bodySchema = z.object({
  /** Opaque, client-generated stable identifier for this device/install. */
  deviceId: z.string().min(1).max(200),
});

/**
 * Exchanges an authenticated web session for an API token pair (access +
 * refresh) bound to a device. This is how the iOS app bootstraps: the user signs
 * in through the normal web OAuth flow, then this endpoint mints app tokens.
 *
 * Session-cookie only — a bearer token cannot mint new device credentials here;
 * ongoing renewal goes through /api/auth/refresh.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const { deviceId } = await parseJson(request, bodySchema);

    const [access, refresh] = await Promise.all([
      signAccessToken(session.user.id),
      issueRefreshToken(session.user.id, deviceId),
    ]);

    return NextResponse.json({ access, refresh });
  } catch (error) {
    return handleApiError(error);
  }
}

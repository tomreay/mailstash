import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '@/lib/db';

/**
 * API token service for non-cookie clients (the iOS app).
 *
 * - **Access token**: a short-lived signed JWT carrying `userId`. Stateless —
 *   verified by signature, never looked up in the DB. Signed with the same
 *   `NEXTAUTH_SECRET` the rest of auth uses.
 * - **Refresh token**: a long-lived opaque random string, device-bound. Only its
 *   SHA-256 hash is stored (`RefreshToken`), so a DB leak can't mint tokens.
 *   Rotated on every refresh; revocable on logout.
 */

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const ISSUER = 'mailstash';
const AUDIENCE = 'mailstash-api';

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Signs a short-lived access JWT for the given user. */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Verifies an access JWT and returns its `userId`, or `null` if the token is
 * missing/expired/invalid.
 */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Issues a new refresh token for a user+device, persisting only its hash.
 * Returns the raw token (shown to the client once).
 */
export async function issueRefreshToken(
  userId: string,
  deviceId: string
): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await db.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId,
      deviceId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

export interface RefreshedTokens {
  userId: string;
  access: string;
  refresh: string;
}

/**
 * Validates a refresh token and rotates it: the presented token is revoked and a
 * fresh access+refresh pair is issued (bound to the same device). Returns `null`
 * if the token is unknown, expired, or already revoked.
 */
export async function rotateRefreshToken(
  rawToken: string
): Promise<RefreshedTokens | null> {
  const record = await db.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (
    !record ||
    record.revokedAt !== null ||
    record.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  // Rotate: revoke the presented token, mint a new pair for the same device.
  await db.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const [access, refresh] = await Promise.all([
    signAccessToken(record.userId),
    issueRefreshToken(record.userId, record.deviceId),
  ]);

  return { userId: record.userId, access, refresh };
}

/**
 * Revokes a refresh token (logout). No-op if the token is unknown — revocation
 * is idempotent and must not reveal whether a token existed.
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

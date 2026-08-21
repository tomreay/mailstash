import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import path from 'path';
import { promises as fs } from 'fs';
import { auth } from '@/lib/auth';

// Create upload directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'tmp', 'mbox-uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

const datastore = new FileStore({ directory: uploadDir });

/**
 * Metadata key used to bind an upload to the user who created it. Persisted by
 * the FileStore in the upload's `.json` info file, so ownership survives across
 * the separate requests of a resumable (tus) upload.
 */
const OWNER_METADATA_KEY = 'ownerId';

/**
 * A tus-shaped error. The tus `Server` reads `status_code`/`body` off thrown
 * values to build the HTTP response (see `@tus/server` server.js), so we can't
 * reuse the `lib/api` `ApiError` (which carries `status`, not `status_code`)
 * here — the server owns the raw Request/Response and never runs through
 * `handleApiError`. This keeps the *behaviour* consistent with the rest of the
 * API layer (401 when unauthenticated, 403 when accessing someone else's
 * upload) even though the transport differs.
 */
function tusError(status_code: number, body: string) {
  return Object.assign(new Error(body), { status_code, body: `${body}\n` });
}

/**
 * Resolves the authenticated user's id, or throws a tus 401.
 *
 * This is the tus equivalent of `withAuth` (lib/api/with-auth.ts): the upload
 * route can't use that wrapper because tus owns the raw request lifecycle, so
 * we gate every verb here instead. A single grep for `requireUserId` answers
 * "is the upload route protected?".
 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw tusError(401, 'Unauthorized');
  }
  return session.user.id;
}

// Create TUS server instance
const server = new Server({
  path: '/api/accounts/upload',
  respectForwardedHeaders: true,
  generateUrl: (req, { host, path, id }) => {
    // Get protocol from forwarded headers or request
    const protocol = req.headers.get('x-forwarded-proto') ||
                     req.headers.get('x-scheme') ||
                     (req.url?.startsWith('https') ? 'https' : 'http');
    const hostname = req.headers.get('x-forwarded-host') ||
                    req.headers.get('host') ||
                    host;

    // Ensure we use HTTPS in production
    const finalProtocol = hostname?.includes('localhost') ? protocol : 'https';

    return `${finalProtocol}://${hostname}${path}/${id}`;
  },
  datastore,
  namingFunction: () => {
    // Generate unique filename with timestamp
    return `${Date.now()}-${Math.random().toString(36).substring(7)}.mbox`;
  },
  /**
   * Runs before every tus request (POST/PATCH/HEAD/GET/DELETE). Enforces:
   *   1. Authentication — no session ⇒ 401, closing the anonymous upload/read
   *      hole. On POST the upload doesn't exist yet (the id is freshly
   *      generated), so this is the only check that applies; ownership is
   *      stamped afterwards in `onUploadCreate`.
   *   2. Ownership — for an existing upload, the session user must match the
   *      `ownerId` stamped at creation, so one user can't read, resume, or
   *      delete another user's upload session (uploads land in a shared
   *      directory keyed only by a guessable timestamp id).
   */
  onIncomingRequest: async (req, uploadId) => {
    const userId = await requireUserId();

    // POST creates the upload; there's nothing to own yet.
    if (req.method === 'POST') {
      return;
    }

    let upload;
    try {
      upload = await datastore.getUpload(uploadId);
    } catch {
      // Unknown/expired id — let the handler return its normal 404.
      return;
    }

    const ownerId = upload.metadata?.[OWNER_METADATA_KEY];
    // Reject uploads owned by someone else, and legacy uploads created before
    // ownership was tracked (no owner stamped) rather than leaking them.
    if (ownerId !== userId) {
      throw tusError(403, 'Forbidden');
    }
  },
  onUploadCreate: async (req, upload) => {
    // Bind the upload to its creator so later requests can verify ownership.
    const userId = await requireUserId();
    console.log('Upload created:', upload.id, 'Size:', upload.size);
    return {
      metadata: { ...upload.metadata, [OWNER_METADATA_KEY]: userId },
    };
  },
  onUploadFinish: async (req, upload) => {
    console.log('Upload finished:', upload.id, 'Storage:', upload.storage);
    return { status_code: 200 };
  },
});

export const GET = (req: Request) => server.handleWeb(req);
export const POST = (req: Request) => server.handleWeb(req);
export const PATCH = (req: Request) => server.handleWeb(req);
export const DELETE = (req: Request) => server.handleWeb(req);
export const OPTIONS = (req: Request) => server.handleWeb(req);
export const HEAD = (req: Request) => server.handleWeb(req);

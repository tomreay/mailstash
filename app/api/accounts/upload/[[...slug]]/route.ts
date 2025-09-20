import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import path from 'path';
import { promises as fs } from 'fs';

// Create upload directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'tmp', 'mbox-uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

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
  datastore: new FileStore({
    directory: uploadDir,
  }),
  namingFunction: () => {
    // Generate unique filename with timestamp
    return `${Date.now()}-${Math.random().toString(36).substring(7)}.mbox`;
  },
  onUploadCreate: async (req, upload) => {
    console.log('Upload created:', upload.id, 'Size:', upload.size);
    return { metadata: upload.metadata };
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

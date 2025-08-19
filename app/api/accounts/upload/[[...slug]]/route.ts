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

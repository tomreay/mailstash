#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

// Run worker with tsx
const tsx = spawn('npx', ['tsx', join(__dirname, '../lib/jobs/worker.ts')], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      'postgresql://mailstash:mailstash_password@localhost:5432/mailstash',
  },
});

tsx.on('error', err => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});

tsx.on('exit', code => {
  process.exit(code || 0);
});

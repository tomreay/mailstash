import { run, Task, Runner, Logger } from 'graphile-worker';
import { fullSyncHandler } from './handlers/full-sync';
import { incrementalSyncHandler } from './handlers/incremental-sync';
import { folderSyncHandler } from './handlers/folder-sync';
import { autoDeleteHandler } from './handlers/auto-delete';
import { mboxImportHandler } from './handlers/mbox-import';

const taskList: Record<string, Task> = {
  'email:full_sync': fullSyncHandler,
  'email:incremental_sync': incrementalSyncHandler,
  'email:folder_sync': folderSyncHandler,
  'email:auto_delete': autoDeleteHandler,
  'email:mbox_import': mboxImportHandler,
  'auto-delete': autoDeleteHandler, // Legacy task name support
};

let runner: Runner | null = null;

export async function startWorker() {
  if (runner) {
    console.warn('Worker already started');
    return runner;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  runner = await run({
    connectionString,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    noHandleSignals: false,
    pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '1000', 10),
    taskList,
    logger: new Proxy({}, {
      get(target, prop) {
        if (prop === 'scope') {
          return () => new Proxy({}, {
            get(_, logLevel) {
              return (message: string, meta?: unknown) => {
                const timestamp = new Date().toISOString();
                console.log(`[${timestamp}] [${String(logLevel)}] ${message}`, meta);
              };
            }
          });
        }
        return (message: string, meta?: unknown) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [${String(prop)}] ${message}`, meta);
        };
      }
    }) as Logger,
  });

  console.log('Worker started successfully');
  
  runner.events.on('job:success', ({ job }) => {
    console.log(`Job ${job.task_identifier} completed successfully`, {
      jobId: job.id,
      duration: job.last_error ? Date.now() - new Date(job.run_at).getTime() : undefined,
    });
  });

  runner.events.on('job:error', ({ job, error }) => {
    console.error(`Job ${job.task_identifier} failed`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
      attempts: job.attempts,
    });
  });

  return runner;
}

export async function stopWorker() {
  if (!runner) {
    console.warn('No worker to stop');
    return;
  }

  await runner.stop();
  runner = null;
  console.log('Worker stopped successfully');
}

export function getWorkerStatus() {
  return {
    running: !!runner,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  };
}

if (require.main === module) {
  startWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await stopWorker();
    process.exit(0);
  });
}
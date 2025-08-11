import {makeWorkerUtils, WorkerUtils} from 'graphile-worker';
import type {FolderSyncPayload, FullSyncPayload, IncrementalSyncPayload} from './types';
import type {MboxImportPayload} from './handlers/mbox-import';

let workerUtils: WorkerUtils | null = null;

async function getWorkerUtils(): Promise<WorkerUtils> {
  if (!workerUtils) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    workerUtils = await makeWorkerUtils({
      connectionString,
    });
  }
  
  return workerUtils;
}

export async function
scheduleFullSync(
  accountId: string,
  payload?: Partial<FullSyncPayload>,
  options?: { runAt?: Date; priority?: number }
) {
  const utils = await getWorkerUtils();
  
  const jobPayload: FullSyncPayload = {
    accountId,
    ...payload,
  };

  return await utils.addJob('email:full_sync', jobPayload, {
    ...options,
    jobKey: `full_sync:${accountId}`,
    maxAttempts: 3,
  });
}

export async function scheduleIncrementalSync(
  accountId: string,
  payload?: Partial<IncrementalSyncPayload>,
  options?: { runAt?: Date; priority?: number }
) {
  const utils = await getWorkerUtils();
  
  const jobPayload: IncrementalSyncPayload = {
    accountId,
    ...payload,
  };

  return await utils.addJob('email:incremental_sync', jobPayload, {
    ...options,
    jobKey: `incremental_sync:${accountId}`,
    maxAttempts: 5,
  });
}

export async function addJob(
  taskIdentifier: string,
  payload: Record<string, unknown>,
  options?: { runAt?: Date; priority?: number; jobKey?: string; maxAttempts?: number }
) {
  const utils = await getWorkerUtils();
  return await utils.addJob(taskIdentifier, payload, options);
}

export async function scheduleFolderSync(
  accountId: string,
  folderId: string,
  folderPath: string,
  payload?: Partial<FolderSyncPayload>,
  options?: { runAt?: Date; priority?: number }
) {
  const utils = await getWorkerUtils();
  
  const jobPayload: FolderSyncPayload = {
    accountId,
    folderId,
    folderPath,
    ...payload,
  };

  return await utils.addJob('email:folder_sync', jobPayload, {
      ...options,
      jobKey: `folder_sync:${accountId}:${folderId}`,
      maxAttempts: 3,
  });
}

export async function getActiveJobs() {
  const utils = await getWorkerUtils();
  
  const query = `
    SELECT 
      j.id,
      j.task_identifier,
      pj.payload,
      j.run_at,
      j.attempts,
      j.max_attempts,
      j.created_at,
      j.locked_at,
      j.locked_by
    FROM graphile_worker.jobs j
    LEFT JOIN graphile_worker._private_jobs pj ON j.id = pj.id
    WHERE j.locked_at IS NOT NULL
    ORDER BY j.locked_at DESC
  `;

  return await utils.withPgClient(async (pgClient) => {
      const {rows} = await pgClient.query(query);
      return rows;
  });
}

export async function getPendingJobs(limit = 100) {
  const utils = await getWorkerUtils();
  
  const query = `
    SELECT 
      j.id,
      j.task_identifier,
      pj.payload,
      j.run_at,
      j.attempts,
      j.max_attempts,
      j.created_at
    FROM graphile_worker.jobs j
    LEFT JOIN graphile_worker._private_jobs pj ON j.id = pj.id
    WHERE j.locked_at IS NULL
      AND j.attempts < j.max_attempts
    ORDER BY j.run_at
    LIMIT $1
  `;

  return await utils.withPgClient(async (pgClient) => {
    const {rows} = await pgClient.query(query, [limit]);
    return rows;
  });
}

export async function getFailedJobs(limit = 100) {
  const utils = await getWorkerUtils();
  
  const query = `
    SELECT 
      j.id,
      j.task_identifier,
      pj.payload,
      j.run_at,
      j.attempts,
      j.max_attempts,
      j.last_error,
      j.created_at
    FROM graphile_worker.jobs j
    LEFT JOIN graphile_worker._private_jobs pj ON j.id = pj.id
    WHERE j.attempts >= j.max_attempts
    ORDER BY j.run_at DESC
    LIMIT $1
  `;

  return await utils.withPgClient(async (pgClient) => {
    const {rows} = await pgClient.query(query, [limit]);
    return rows;
  });
}

export async function retryJob(jobId: string) {
  const utils = await getWorkerUtils();
  
  // Use graphile-worker's reschedule_jobs function
  await utils.withPgClient(async (pgClient) => {
    await pgClient.query(
      `SELECT graphile_worker.reschedule_jobs(ARRAY[$1::bigint])`,
      [jobId]
    );
  });
}

export async function cancelJob(jobId: string) {
  const utils = await getWorkerUtils();
  await utils.permanentlyFailJobs([jobId], 'Cancelled by user');
}

export async function scheduleMboxImport(
  accountId: string,
  mboxFilePath: string,
  options?: { runAt?: Date; priority?: number }
) {
  const utils = await getWorkerUtils();
  
  const jobPayload: MboxImportPayload = {
    accountId,
    mboxFilePath,
  };

  return await utils.addJob('email:mbox_import', jobPayload, {
    ...options,
    jobKey: `mbox_import:${accountId}`
  });
}

export async function cleanup() {
  if (workerUtils) {
    await workerUtils.release();
    workerUtils = null;
  }
}
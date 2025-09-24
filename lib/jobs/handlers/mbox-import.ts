import { createJobHandler } from '../create-handler';
import { performMboxImport, cleanupMboxFile } from '@/lib/services/mbox-import-service';

export interface MboxImportPayload {
  accountId: string;
  mboxFilePath: string;
}

export const mboxImportHandler = createJobHandler<MboxImportPayload>(
  'mbox_import',
  async ({ payload, account }) => {
    const { mboxFilePath } = payload;

    // Perform the import
    const result = await performMboxImport(account.id, mboxFilePath);

    // Clean up temporary file on successful import
    if (result.processed > 0) {
      await cleanupMboxFile(mboxFilePath);
    } else {
      // Keep file for debugging if nothing was processed
      console.log(
        `[mbox-import] Keeping mbox file after import (no emails processed): ${mboxFilePath}`
      );
    }

    console.log(
      `[mbox-import] Import completed for account ${account.id}: ` +
      `${result.processed} imported, ${result.failed} failed`
    );

    return {
      processed: result.processed,
      failed: result.failed,
      mboxFilePath,
      fileSize: result.fileSize,
    };
  }
);
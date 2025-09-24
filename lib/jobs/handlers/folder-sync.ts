import { createJobHandler } from '../create-handler';
import { FolderSyncPayload } from '../types';
import { performFolderSync } from '@/lib/services/sync/folder-sync-service';
import { db } from '@/lib/db';

export const folderSyncHandler = createJobHandler<FolderSyncPayload>(
  'folder_sync',
  async ({ payload, account }) => {
    const { folderId, folderPath } = payload;

    console.log(`[folder-sync] Starting folder sync for ${folderPath}`, {
      accountId: account.id,
      folderId,
    });

    // Get folder details
    const folder = await db.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new Error(`Folder ${folderId} not found`);
    }

    // Perform the sync
    const result = await performFolderSync(account, folder);

    // Update folder sync metadata
    if (result.lastSyncId) {
      await db.folder.update({
        where: { id: folderId },
        data: {
          lastSyncId: result.lastSyncId,
          updatedAt: new Date(),
        },
      });
    }

    console.log(
      `[folder-sync] Folder sync completed for ${folderPath}. ` +
      `Processed: ${result.emailsProcessed}`
    );

    return {
      emailsProcessed: result.emailsProcessed,
      folderId,
      folderPath,
    };
  }
);
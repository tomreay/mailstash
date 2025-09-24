import {db} from "@/lib/db";

export default async function updateSyncState(accountId: string, historyId: string) {
    await db.folder.upsert({
        where: {
            accountId_path: {
                accountId,
                path: '_SYNC_STATE',
            },
        },
        update: {
            lastSyncId: historyId,
        },
        create: {
            name: '_SYNC_STATE',
            path: '_SYNC_STATE',
            accountId,
            lastSyncId: historyId,
        },
    });
}
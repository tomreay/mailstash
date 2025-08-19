import { Task } from 'graphile-worker';
import { promises as fs } from 'fs';
import { MboxParser } from '@/lib/email/parsers/mbox-parser';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';

export interface MboxImportPayload {
  accountId: string;
  mboxFilePath: string;
}

export const mboxImportHandler: Task = async payload => {
  const { accountId, mboxFilePath } = payload as MboxImportPayload;

  let syncJob = null;
  const parser = new MboxParser();
  const storage = new EmailStorage();

  console.log(
    `[mbox-import] Starting import for account ${accountId} from ${mboxFilePath}`
  );

  // Check if file exists before proceeding
  const fileExists = await fs
    .access(mboxFilePath)
    .then(() => true)
    .catch(() => false);
  console.log(`[mbox-import] File exists check: ${fileExists}`);

  if (!fileExists) {
    throw new Error(`File not found: ${mboxFilePath}`);
  }

  // Get file stats
  const stats = await fs.stat(mboxFilePath);
  console.log(`[mbox-import] File size: ${stats.size} bytes`);

  try {
    // Set sync status to syncing immediately
    await db.syncStatus.upsert({
      where: { accountId },
      create: {
        accountId,
        syncStatus: 'syncing',
        lastSyncAt: null,
        errorMessage: null,
      },
      update: {
        syncStatus: 'syncing',
        errorMessage: null,
      },
    });
    console.log(
      `[mbox-import] Set sync status to 'syncing' for account ${accountId}`
    );

    // Create sync job record
    syncJob = await db.syncJob.create({
      data: {
        type: 'mbox_import',
        status: 'processing',
        accountId,
        startedAt: new Date(),
        emailsProcessed: 0,
        metadata: {
          mboxFilePath,
          totalEstimated: 0,
          processed: 0,
          failed: 0,
          errors: [],
        },
      },
    });

    // Validate the mbox file
    const isValid = await parser.validate(mboxFilePath);
    if (!isValid) {
      throw new Error('Invalid mbox file format');
    }

    // Initialize storage
    await storage.init();

    // Process emails from mbox file
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];
    const batchSize = 10;
    let lastProgressLog = Date.now();

    console.log(`[mbox-import] Starting to parse and import emails...`);

    for await (const emailData of parser.parseMessages(mboxFilePath)) {
      try {
        // Convert to EmailMessage format
        const emailMessage = parser.convertToEmailMessage(emailData);

        // Check if email already exists
        const existing = await db.email.findUnique({
          where: { messageId: emailMessage.messageId },
        });

        if (!existing) {
          // Store the email
          await storage.storeEmail(
            emailMessage,
            emailData.rawContent,
            accountId
          );

          // Store attachments if any
          if (emailData.attachments && emailData.attachments.length > 0) {
            const emailRecord = await db.email.findUnique({
              where: { messageId: emailMessage.messageId },
            });

            if (emailRecord) {
              for (const attachment of emailData.attachments) {
                const attachmentPath = await storage.storeAttachment(
                  {
                    filename: attachment.filename,
                    contentType: attachment.contentType,
                    size: attachment.size,
                    content: attachment.content,
                  },
                  accountId,
                  emailRecord.id
                );

                await db.attachment.create({
                  data: {
                    filename: attachment.filename,
                    contentType: attachment.contentType,
                    size: attachment.size,
                    filePath: attachmentPath,
                    emailId: emailRecord.id,
                  },
                });
              }
            }
          }
        }

        processed++;

        // Log first email to confirm processing started
        if (processed === 1) {
          console.log(
            `[mbox-import] Successfully processed first email: ${emailMessage.subject || 'No subject'}`
          );
        }

        // Update progress every batch or every 5 seconds
        const now = Date.now();
        if (processed % batchSize === 0 || now - lastProgressLog > 5000) {
          await db.syncJob.update({
            where: { id: syncJob.id },
            data: {
              emailsProcessed: processed,
              metadata: {
                ...(syncJob.metadata as Record<string, unknown>),
                processed,
                failed,
                errors: errors.slice(-10), // Keep last 10 errors
              },
            },
          });

          console.log(
            `[mbox-import] Progress: ${processed} emails - ${failed} failed`
          );
          lastProgressLog = now;
        }
      } catch (error) {
        failed++;
        const errorMsg = `Failed to import email: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`[mbox-import] ${errorMsg}`);
      }
    }

    // Final update
    await db.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        emailsProcessed: processed,
        metadata: {
          mboxFilePath,
          processed,
          failed,
          errors: errors.slice(-10),
          summary: `Successfully imported ${processed} emails, ${failed} failed`,
        },
      },
    });

    // Update sync status
    await db.syncStatus.upsert({
      where: { accountId },
      update: {
        syncStatus: 'idle',
        lastSyncAt: new Date(),
        errorMessage: null,
      },
      create: {
        accountId,
        syncStatus: 'idle',
        lastSyncAt: new Date(),
      },
    });

    console.log(
      `[mbox-import] Import completed: ${processed} imported, ${failed} failed`
    );

    // Clean up temporary file ONLY on successful import
    try {
      await fs.unlink(mboxFilePath);
      console.log(
        `[mbox-import] Successfully cleaned up temporary file after import: ${mboxFilePath}`
      );
    } catch (error) {
      console.error(
        `[mbox-import] Failed to clean up temporary file: ${error}`
      );
      // Non-critical error, continue
    }

    // Task handlers should return void or unknown[]
    return;
  } catch (error) {
    console.error(`[mbox-import] Import failed:`, error);

    // Update job status
    if (syncJob) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    // Update sync status
    await db.syncStatus.upsert({
      where: { accountId },
      update: {
        syncStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Import failed',
      },
      create: {
        accountId,
        syncStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Import failed',
      },
    });

    // DO NOT delete the file on error - keep it for debugging and retry
    console.log(
      `[mbox-import] Keeping mbox file after error for debugging: ${mboxFilePath}`
    );

    throw error;
  }
};

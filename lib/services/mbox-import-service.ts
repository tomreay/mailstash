import { promises as fs } from 'fs';
import {MboxEmailAttachment, MboxParser} from '@/lib/email/parsers/mbox-parser';
import { EmailStorage } from '@/lib/storage/email-storage';
import { db } from '@/lib/db';

export type MboxImportResult = {
  processed: number;
  failed: number;
  errors: string[];
  fileSize: number;
};

export type MboxImportDependencies = {
  parser?: MboxParser;
  storage?: EmailStorage;
  logger?: Console;
};

const defaultDeps: MboxImportDependencies = {
  parser: new MboxParser(),
  storage: new EmailStorage(),
  logger: console,
};

export async function performMboxImport(
  accountId: string,
  mboxFilePath: string,
  deps: MboxImportDependencies = {}
): Promise<MboxImportResult> {
  const { parser, storage, logger } = { ...defaultDeps, ...deps };

  logger?.log(`[mbox-import] Starting import for account ${accountId} from ${mboxFilePath}`);

  // Check if file exists
  const fileExists = await fs
    .access(mboxFilePath)
    .then(() => true)
    .catch(() => false);

  if (!fileExists) {
    throw new Error(`File not found: ${mboxFilePath}`);
  }

  // Get file stats
  const stats = await fs.stat(mboxFilePath);
  logger?.log(`[mbox-import] File size: ${stats.size} bytes`);

  // Validate the mbox file
  const isValid = await parser!.validate(mboxFilePath);
  if (!isValid) {
    throw new Error('Invalid mbox file format');
  }

  // Initialize storage
  await storage!.init();

  // Process emails from mbox file
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  const batchSize = 10;
  let lastProgressLog = Date.now();

  logger?.log(`[mbox-import] Starting to parse and import emails...`);

  for await (const emailData of parser!.parseMessages(mboxFilePath)) {
    try {
      // Convert to EmailMessage format
      const emailMessage = parser!.convertToEmailMessage(emailData);

      // Check if email already exists
      const existing = await db.email.findUnique({
        where: {
          accountId_messageId: {
            messageId: emailMessage.messageId,
            accountId,
          },
        },
      });

      if (!existing) {
        // Store the email
        await storage!.storeEmail(emailMessage, emailData.rawContent, accountId);

        // Store attachments if any
        if (emailData.attachments && emailData.attachments.length > 0) {
          await storeAttachments(
            emailData.attachments,
            emailMessage.messageId,
            accountId,
            storage!
          );
        }
      }

      processed++;

      // Log first email to confirm processing started
      if (processed === 1) {
        logger?.log(
          `[mbox-import] Successfully processed first email: ${emailMessage.subject || 'No subject'}`
        );
      }

      // Log progress periodically
      const now = Date.now();
      if (processed % batchSize === 0 || now - lastProgressLog > 5000) {
        logger?.log(`[mbox-import] Progress: ${processed} emails - ${failed} failed`);
        lastProgressLog = now;
      }
    } catch (error) {
      failed++;
      const errorMsg = `Failed to import email: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      errors.push(errorMsg);
      logger?.error(`[mbox-import] ${errorMsg}`);
    }
  }

  logger?.log(`[mbox-import] Import completed: ${processed} imported, ${failed} failed`);

  return {
    processed,
    failed,
    errors,
    fileSize: stats.size,
  };
}

async function storeAttachments(
  attachments: MboxEmailAttachment[],
  messageId: string,
  accountId: string,
  storage: EmailStorage
): Promise<void> {
  const emailRecord = await db.email.findUnique({
    where: {
      accountId_messageId: {
        messageId,
        accountId,
      },
    },
  });

  if (!emailRecord) {
    return;
  }

  for (const attachment of attachments) {
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

export async function cleanupMboxFile(
  mboxFilePath: string,
  logger?: Console
): Promise<boolean> {
  try {
    await fs.unlink(mboxFilePath);
    logger?.log(`[mbox-import] Successfully cleaned up temporary file: ${mboxFilePath}`);
    return true;
  } catch (error) {
    logger?.error(`[mbox-import] Failed to clean up temporary file: ${error}`);
    return false;
  }
}
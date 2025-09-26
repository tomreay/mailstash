import {EmailAccount} from '@/types/email';
import { EmailAccountSettings } from '@/lib/types/account-settings';
import { createEmailClient, isGmailClient } from '@/lib/email/client-factory';
import { db } from '@/lib/db';
import { JOB_CONFIG } from '@/lib/jobs/config';
import { Prisma } from '@prisma/client';

export type AutoDeleteResult = {
  success: boolean;
  count: number;
  mode: string;
  error?: string;
};

export type AutoDeleteDependencies = {
  logger?: Console;
};

const defaultDeps: AutoDeleteDependencies = {
  logger: console,
};

export async function performAutoDelete(
  account: EmailAccount,
  settings: EmailAccountSettings,
  deps: AutoDeleteDependencies = {}
): Promise<AutoDeleteResult> {
  const { logger } = { ...defaultDeps, ...deps };

  logger?.log(`[auto-delete] Starting auto-delete processing for account ${account.id}`);

  // Skip if auto-delete is off
  if (settings.autoDeleteMode === 'off') {
    logger?.log(`[auto-delete] Auto-delete is off for account ${account.id}`);

    // Clear any stale marked-for-deletion flags
    await clearMarkedForDeletion(account.id);

    return {
      success: false,
      count: 0,
      mode: 'off',
      error: 'Auto-delete is disabled',
    };
  }

  // Skip if no deletion rules configured
  if (settings.deleteDelayHours === null && settings.deleteAgeMonths === null) {
    logger?.log(`[auto-delete] No deletion rules configured for account ${account.id}`);
    return {
      success: false,
      count: 0,
      mode: settings.autoDeleteMode,
      error: 'No deletion rules configured',
    };
  }

  // Find emails matching deletion criteria
  const whereClause = buildDeleteWhereClause(
    account.id,
    settings.deleteDelayHours,
    settings.deleteAgeMonths,
    settings.deleteOnlyArchived
  );

  const emailsToProcess: {
      id: string,
      markedForDeletion: boolean,
      gmailId: string | null
    }[] = await db.email.findMany({
    where: whereClause,
    select: {
      id: true,
      gmailId: true,
      markedForDeletion: true,
    },
    take: JOB_CONFIG.autoDelete.batchSize,
  });

  logger?.log(
    `[auto-delete] Found ${emailsToProcess.length} emails to process for account ${account.id}`
  );

  if (emailsToProcess.length === 0) {
    return {
      success: true,
      count: 0,
      mode: settings.autoDeleteMode,
    };
  }

  // Process based on mode
  if (settings.autoDeleteMode === 'dry-run') {
    return processDryRun(emailsToProcess, logger);
  } else if (settings.autoDeleteMode === 'on') {
    return processLiveDeletion(emailsToProcess, account, logger);
  }

  return {
    success: true,
    count: 0,
    mode: settings.autoDeleteMode,
  };
}

function buildDeleteWhereClause(
  accountId: string,
  deleteDelayHours: number | null,
  deleteAgeMonths: number | null,
  deleteOnlyArchived: boolean
): Prisma.EmailWhereInput {
  const now = new Date();
  const dateConditions: Prisma.EmailWhereInput[] = [];

  // Delete delay condition (based on syncedAt)
  if (deleteDelayHours !== null) {
    const delayDate = new Date(now.getTime() - deleteDelayHours * 60 * 60 * 1000);
    dateConditions.push({
      syncedAt: { lte: delayDate },
    });
  }

  // Delete age condition (based on email date)
  if (deleteAgeMonths !== null) {
    const ageDate = new Date();
    ageDate.setMonth(ageDate.getMonth() - deleteAgeMonths);
    dateConditions.push({
      date: { lte: ageDate },
    });
  }

  return {
    accountId,
    isDeleted: false, // Don't process already deleted emails
    ...(deleteOnlyArchived && { isArchived: true }),
    ...(dateConditions.length > 0 && { OR: dateConditions }),
  };
}

async function clearMarkedForDeletion(accountId: string): Promise<void> {
  await db.email.updateMany({
    where: {
      accountId,
      markedForDeletion: true,
    },
    data: {
      markedForDeletion: false,
      markedForDeletionAt: null,
    },
  });
}

async function processDryRun(
  emails: {
      id: string,
      markedForDeletion: boolean
  }[],
  logger?: Console
): Promise<AutoDeleteResult> {
  const emailsToMark = emails.filter(email => !email.markedForDeletion);

  logger?.log(
    `[auto-delete] Dry-run mode: marking ${emailsToMark.length} emails for deletion`
  );

  if (emailsToMark.length > 0) {
    const emailIds = emailsToMark.map(email => email.id);

    await db.email.updateMany({
      where: {
        id: { in: emailIds },
      },
      data: {
        markedForDeletion: true,
        markedForDeletionAt: new Date(),
      },
    });

    logger?.log(
      `[auto-delete] Marked ${emailIds.length} emails for deletion in dry-run mode`
    );
  }

  return {
    success: true,
    count: emailsToMark.length,
    mode: 'dry-run',
  };
}

async function processLiveDeletion(
  emails: {
      id: string
      markedForDeletion: boolean
      gmailId: string | null
  }[],
  account: EmailAccount,
  logger?: Console
): Promise<AutoDeleteResult> {
  logger?.log(
    `[auto-delete] Live mode: deleting ${emails.length} emails from server`
  );

  let deletedCount = 0;
  let errorCount = 0;

  // Delete emails from the server based on provider
  if (account.provider === 'gmail' && account.accessToken) {
    const client = createEmailClient(account);

    if (!isGmailClient(client)) {
      return {
        success: false,
        count: 0,
        mode: 'on',
        error: 'Invalid Gmail client',
      };
    }

    for (const email of emails) {
      if (!email.gmailId) continue;

      try {
        // Delete from Gmail (move to trash)
        await client.deleteMessage(email.gmailId);

        // Mark as deleted in our database
        await db.email.update({
          where: { id: email.id },
          data: {
            isDeleted: true,
            markedForDeletion: false,
            markedForDeletionAt: null,
          },
        });

        deletedCount++;
      } catch (error) {
        logger?.error(`[auto-delete] Failed to delete email ${email.id}:`, error);
        errorCount++;
      }
    }
  } else if (account.provider === 'imap') {
    // TODO: Implement IMAP deletion
    logger?.log(`[auto-delete] IMAP deletion not yet implemented`);
    return {
      success: false,
      count: 0,
      mode: 'on',
      error: 'IMAP deletion not yet implemented',
    };
  }

  logger?.log(
    `[auto-delete] Deleted ${deletedCount} emails, ${errorCount} errors`
  );

  return {
    success: true,
    count: deletedCount,
    mode: 'on',
  };
}
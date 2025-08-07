import { db } from '@/lib/db'
import { GmailClient } from '@/lib/email/gmail-client'
import { Prisma } from '@prisma/client'
import { EmailAccount } from '@/types/email'
import {AutoDeleteMode, EmailAccountSettings} from '@/lib/types/account-settings'
import { Task } from 'graphile-worker'

export interface AutoDeleteJobData {
  accountId: string
}

/**
 * Build the where clause for finding emails to delete
 */
function buildDeleteWhereClause(
  accountId: string,
  deleteDelayHours: number | null,
  deleteAgeMonths: number | null,
  deleteOnlyArchived: boolean
): Prisma.EmailWhereInput {
  const now = new Date()
  const dateConditions: Prisma.EmailWhereInput[] = []

  // Delete delay condition (based on syncedAt)
  if (deleteDelayHours !== null) {
    const delayDate = new Date(now.getTime() - deleteDelayHours * 60 * 60 * 1000)
    dateConditions.push({
      syncedAt: {
        lte: delayDate
      }
    })
  }

  // Delete age condition (based on email date)
  if (deleteAgeMonths !== null) {
    const ageDate = new Date()
    ageDate.setMonth(ageDate.getMonth() - deleteAgeMonths)
    dateConditions.push({
      date: {
        lte: ageDate
      }
    })
  }

  return {
    accountId,
    isDeleted: false, // Don't process already deleted emails
    ...(deleteOnlyArchived && { isArchived: true }),
    ...(dateConditions.length > 0 && { OR: dateConditions })
  }
}

/**
 * Core auto-delete logic
 */
async function processAutoDelete(
  account: EmailAccount,
  settings: EmailAccountSettings,
  syncJobId: string
) {
  console.log(`[AutoDelete] Starting auto-delete processing for account ${account.id}`)

  // Skip if auto-delete is off
  if (settings.autoDeleteMode === 'off') {
    console.log(`[AutoDelete] Auto-delete is off for account ${account.id}`)
    
    // Clear any stale marked-for-deletion flags when turning off
    await db.email.updateMany({
      where: {
        accountId: account.id,
        markedForDeletion: true,
      },
      data: {
        markedForDeletion: false,
        markedForDeletionAt: null,
      }
    })

    return { success: false, error: 'autoDeleteMode is off - job should not have run' }
  }

  // Skip if no deletion rules configured
  if (settings.deleteDelayHours === null && settings.deleteAgeMonths === null) {
    console.log(`[AutoDelete] No deletion rules configured for account ${account.id}`)
    return { success: false, error: 'No deletion rules configured' }
  }

  // Build the where clause using the helper function
  const whereClause = buildDeleteWhereClause(
    account.id,
    settings.deleteDelayHours,
    settings.deleteAgeMonths,
    settings.deleteOnlyArchived
  )
  
  const now = new Date()

  // Check if job has been cancelled
  const jobStatus = await db.syncJob.findUnique({
    where: { id: syncJobId },
    select: { status: true }
  })
  
  if (jobStatus?.status === 'failed') {
    console.log(`[AutoDelete] Job ${syncJobId} has been cancelled`)
    return { success: false, error: 'Job cancelled' }
  }

  // Count total emails that match criteria
  const totalCount = await db.email.count({
    where: whereClause
  })

  // Find emails matching the deletion criteria
  const emailsToProcess = await db.email.findMany({
    where: whereClause,
    select: {
      id: true,
      messageId: true,
      subject: true,
      from: true,
      date: true,
      gmailId: true,
      markedForDeletion: true,
    },
    take: 100, // Process in batches
  })

  // Update job progress
  await db.syncJob.update({
    where: { id: syncJobId },
    data: {
      emailsProcessed: Math.min(100, totalCount),
      metadata: { totalEmails: totalCount }
    }
  })

  console.log(`[AutoDelete] Found ${emailsToProcess.length} emails to process for account ${account.id}`)

  if (emailsToProcess.length === 0) {
    return { success: true, count: 0 }
  }

  // Process based on mode
  if (settings.autoDeleteMode === 'dry-run') {
    // In dry-run mode, just mark emails for deletion
    console.log(`[AutoDelete] Dry-run mode: marking ${emailsToProcess.length} emails for deletion`)
    
    const emailIds = emailsToProcess
      .filter(email => !email.markedForDeletion)
      .map(email => email.id)

    if (emailIds.length > 0) {
      await db.email.updateMany({
        where: {
          id: {
            in: emailIds
          }
        },
        data: {
          markedForDeletion: true,
          markedForDeletionAt: now,
        }
      })
      
      console.log(`[AutoDelete] Marked ${emailIds.length} emails for deletion in dry-run mode`)
    }
    
    // Update job with final count
    await db.syncJob.update({
      where: { id: syncJobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        emailsProcessed: totalCount,
        metadata: {
          totalEmails: totalCount,
          markedCount: emailIds.length
        }
      }
    })
    
    return { success: true, count: emailIds.length }
  } else if (settings.autoDeleteMode === 'on') {
    // In 'on' mode, actually delete emails from the server
    console.log(`[AutoDelete] Live mode: deleting ${emailsToProcess.length} emails from server`)
    
    let deletedCount = 0
    let errorCount = 0

    // Delete emails from the server based on provider
    if (account.provider === 'gmail' && account.accessToken) {
      // Create EmailAccount object for GmailClient
      const emailAccount: EmailAccount = {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        provider: account.provider,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        expiresAt: account.expiresAt,
        isActive: account.isActive,
        gmailId: account.gmailId,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        imapSecure: account.imapSecure,
        imapUser: account.imapUser,
        imapPass: account.imapPass,
      }
      const gmailClient = new GmailClient(emailAccount)

      for (const email of emailsToProcess) {
        if (!email.gmailId) continue

        try {
          // Delete from Gmail (move to trash)
          await gmailClient.deleteMessage(email.gmailId)
          
          // Mark as deleted in our database
          await db.email.update({
            where: { id: email.id },
            data: {
              isDeleted: true,
              markedForDeletion: false,
              markedForDeletionAt: null,
            }
          })
          
          deletedCount++
        } catch (error) {
          console.error(`[AutoDelete] Failed to delete email ${email.id}:`, error)
          errorCount++
        }
      }
    } else if (account.provider === 'imap') {
      // TODO: Implement IMAP deletion
      console.log(`[AutoDelete] IMAP deletion not yet implemented`)
      return { success: false, error: 'IMAP deletion not yet implemented' }
    }

    console.log(`[AutoDelete] Deleted ${deletedCount} emails, ${errorCount} errors`)
    return { success: true, count: deletedCount }
  }

  // This should never be reached due to the mode checks above
  return { success: true, count: 0 }
}

/**
 * Main auto-delete job handler for graphile-worker
 */
export const autoDeleteHandler: Task = async (payload) => {
  const { accountId } = payload as AutoDeleteJobData

  // Get account settings
  const account = await db.emailAccount.findUnique({
    where: { id: accountId },
    include: { settings: true }
  })

  if (!account || !account.settings) {
    console.log(`[AutoDelete] No account or settings found for ${accountId}`)
    return
  }

  const settings = { ...account.settings, autoDeleteMode: account.settings.autoDeleteMode as AutoDeleteMode }

  // Determine job type based on mode
  const jobType = settings.autoDeleteMode === 'dry-run' ? 'auto_delete_dry_run' : 'auto_delete'

  // Create SyncJob record
  const syncJob = await db.syncJob.create({
    data: {
      type: jobType,
      status: 'processing',
      accountId,
      startedAt: new Date(),
      emailsProcessed: 0,
    }
  })

  try {
    // If this is a dry-run, update the currentDryRunJobId
    if (settings.autoDeleteMode === 'dry-run') {
      await db.emailAccountSettings.update({
        where: { accountId },
        data: { currentDryRunJobId: syncJob.id }
      })
    }

    const result = await processAutoDelete(account, settings, syncJob.id)

    if (!result.success) {
      // Update job status to failed
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: result.error
        }
      })
    }

    // Graphile worker expects void return
    console.log('[AutoDelete] Job completed:', result)
    return
  } catch (error) {
    console.error('[AutoDelete] Error processing auto-delete:', error)
    
    // Update job status to failed
    await db.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })

    
    console.error('[AutoDelete] Job failed:', error instanceof Error ? error.message : 'Unknown error')
    throw error
  }
}
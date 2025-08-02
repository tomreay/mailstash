import { promises as fs } from 'fs'
import { join } from 'path'
import { EmailMessage, EmailAttachment } from '@/types/email'
import { db } from '@/lib/db'

export class EmailStorage {
  private emailStoragePath: string
  private attachmentStoragePath: string

  constructor() {
    this.emailStoragePath = process.env.EMAIL_STORAGE_PATH || './storage/emails'
    this.attachmentStoragePath = process.env.ATTACHMENT_STORAGE_PATH || './storage/attachments'
  }

  async init(): Promise<void> {
    await fs.mkdir(this.emailStoragePath, { recursive: true })
    await fs.mkdir(this.attachmentStoragePath, { recursive: true })
  }

  async storeEmail(email: EmailMessage, rawContent: string, accountId: string): Promise<void> {
    await this.init()

    // Create account-specific directory
    const accountPath = join(this.emailStoragePath, accountId)
    await fs.mkdir(accountPath, { recursive: true })

    // Store EML file
    const emlPath = join(accountPath, `${email.id}.eml`)
    await fs.writeFile(emlPath, rawContent)

    // Store attachments if any
    const attachmentPaths: string[] = []
    if (email.attachments && email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        const attachmentPath = await this.storeAttachment(attachment, accountId, email.id)
        attachmentPaths.push(attachmentPath)
      }
    }

    // Store email metadata in database
    await db.email.upsert({
      where: { messageId: email.messageId },
      update: {
        subject: email.subject,
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        date: email.date,
        hasAttachments: email.hasAttachments,
        isRead: email.isRead,
        isImportant: email.isImportant,
        isSpam: email.isSpam,
        isArchived: email.isArchived,
        isDeleted: email.isDeleted,
        category: email.category,
        labels: email.labels ? JSON.stringify(email.labels) : null,
        emlPath,
        size: email.size,
        gmailId: email.id,
        gmailThreadId: email.threadId,
      },
      create: {
        messageId: email.messageId,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        date: email.date,
        hasAttachments: email.hasAttachments,
        isRead: email.isRead,
        isImportant: email.isImportant,
        isSpam: email.isSpam,
        isArchived: email.isArchived,
        isDeleted: email.isDeleted,
        category: email.category,
        labels: email.labels ? JSON.stringify(email.labels) : null,
        emlPath,
        size: email.size,
        gmailId: email.id,
        gmailThreadId: email.threadId,
        accountId,
      },
    })

    // Store attachments metadata
    if (email.attachments && email.attachments.length > 0) {
      const emailRecord = await db.email.findUnique({
        where: { messageId: email.messageId },
      })

      if (emailRecord) {
        for (let i = 0; i < email.attachments.length; i++) {
          const attachment = email.attachments[i]
          await db.attachment.create({
            data: {
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              filePath: attachmentPaths[i],
              emailId: emailRecord.id,
            },
          })
        }
      }
    }
  }

  async storeAttachment(attachment: EmailAttachment, accountId: string, emailId: string): Promise<string> {
    await this.init()

    // Create account-specific directory
    const accountPath = join(this.attachmentStoragePath, accountId, emailId)
    await fs.mkdir(accountPath, { recursive: true })

    // Generate safe filename
    const safeFilename = this.sanitizeFilename(attachment.filename)
    const filePath = join(accountPath, safeFilename)

    // Write attachment to file
    await fs.writeFile(filePath, attachment.content)

    return filePath
  }

  async getEmailContent(emlPath: string): Promise<string> {
    try {
      return await fs.readFile(emlPath, 'utf-8')
    } catch (error) {
      console.error('Error reading EML file:', error)
      throw error
    }
  }

  async getAttachmentContent(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath)
    } catch (error) {
      console.error('Error reading attachment file:', error)
      throw error
    }
  }

  async deleteEmail(email: { id: string; emlPath?: string; attachments?: { filePath: string }[] }): Promise<void> {
    // Delete EML file
    if (email.emlPath) {
      try {
        await fs.unlink(email.emlPath)
      } catch (error) {
        console.error('Error deleting EML file:', error)
      }
    }

    // Delete attachments
    if (email.attachments) {
      for (const attachment of email.attachments) {
        try {
          await fs.unlink(attachment.filePath)
        } catch (error) {
          console.error('Error deleting attachment file:', error)
        }
      }
    }

    // Delete from database
    await db.email.delete({
      where: { id: email.id },
    })
  }

  private sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  }

  async getStorageStats(accountId: string): Promise<{ totalEmails: number; totalSize: number }> {
    const result = await db.email.aggregate({
      where: { accountId },
      _count: { id: true },
      _sum: { size: true },
    })

    return {
      totalEmails: result._count.id || 0,
      totalSize: result._sum.size || 0,
    }
  }
}
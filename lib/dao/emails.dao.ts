import { db } from '@/lib/db'

export interface EmailQueryParams {
  page: number
  limit: number
  search?: string
  accountId?: string
  filter?: string
}

export interface EmailListResult {
  emails: {
    id: string
    messageId: string
    subject: string | null
    from: string
    to: string
    date: Date
    isRead: boolean
    isImportant: boolean
    hasAttachments: boolean
    labels: string | null
    emlPath: string | null
    markedForDeletion: boolean
  }[]
  total: number
}

export interface EmailWhereCondition {
  accountId: string | { in: string[] }
  isDeleted: boolean
  markedForDeletion?: boolean
  OR?: Array<{
    subject?: { contains: string; mode: 'insensitive' }
    from?: { contains: string; mode: 'insensitive' }
    to?: { contains: string; mode: 'insensitive' }
  }>
}

/**
 * Data Access Object for email-related database operations
 */
export class EmailsDAO {
  /**
   * Find emails with pagination and search
   */
  static async findEmailsWithPagination(
    accountIds: string[],
    params: EmailQueryParams
  ): Promise<EmailListResult> {
    const { page, limit, search, accountId, filter } = params
    const skip = (page - 1) * limit

    // Build query conditions
    const where: EmailWhereCondition = {
      accountId: accountId ? accountId : { in: accountIds },
      isDeleted: false,
    }

    // Apply filter
    if (filter === 'marked-for-deletion') {
      where.markedForDeletion = true
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' as const } },
        { from: { contains: search, mode: 'insensitive' as const } },
        { to: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    // Get emails with pagination
    const [emails, total] = await Promise.all([
      db.email.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          messageId: true,
          subject: true,
          from: true,
          to: true,
          date: true,
          isRead: true,
          isImportant: true,
          hasAttachments: true,
          labels: true,
          emlPath: true,
          markedForDeletion: true,
        },
      }),
      db.email.count({ where }),
    ])

    return { emails, total }
  }

  /**
   * Find email by ID and account ID
   */
  static async findEmailByIdAndAccount(emailId: string, accountId: string) {
    return await db.email.findFirst({
      where: {
        id: emailId,
        accountId,
        isDeleted: false,
      },
      include: {
        attachments: true,
        folder: true,
      },
    })
  }

  /**
   * Mark email as read
   */
  static async markAsRead(emailId: string) {
    return await db.email.update({
      where: { id: emailId },
      data: { isRead: true },
    })
  }

}
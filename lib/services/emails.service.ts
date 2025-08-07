import {EmailsDAO} from '@/lib/dao/emails.dao'
import {AccountsDAO} from '@/lib/dao/accounts.dao'
import {parseEmlContent} from '@/lib/utils/eml-parser'
import {EmailDetail, EmailListItem, EmailsResponse} from '@/types'

export interface GetEmailsRequest {
  page: number
  limit: number
  search?: string
  accountId?: string
  filter?: string
}

/**
 * Service layer for email business logic
 */
export class EmailsService {
  /**
   * Get emails with pagination and search for a user
   */
  static async getUserEmails(userId: string, request: GetEmailsRequest): Promise<EmailsResponse> {
    const { page, limit, search, accountId, filter } = request

    // Get user's email account(s)
    const accounts = await AccountsDAO.findActiveAccounts(userId, accountId)

    if (accounts.length === 0) {
      return {
        emails: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      }
    }

    const accountIds = accounts.map(a => a.id)

    // Get emails with pagination
    const { emails, total } = await EmailsDAO.findEmailsWithPagination(accountIds, {
      page,
      limit,
      search,
      accountId,
      filter,
    })

    // Format emails and generate snippets
    const formattedEmails: EmailListItem[] = await Promise.all(
      emails.map(async (email) => {
        let snippet = ''

        // Try to generate snippet from EML file
        if (email.emlPath) {
          try {
            const content = await parseEmlContent(email.emlPath)
            if (content.textContent) {
              snippet = content.textContent.substring(0, 200) + '...'
            }
          } catch (error) {
            console.error(`Error parsing EML for snippet (${email.id}):`, error)
          }
        }

        return {
          ...email,
          date: email.date.toISOString(),
          labels: email.labels ? JSON.parse(email.labels) : [],
          snippet,
          markedForDeletion: email.markedForDeletion,
        }
      })
    )

    return {
      emails: formattedEmails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get detailed email by ID
   */
  static async getEmailDetails(emailId: string, userId: string): Promise<EmailDetail> {
    const accounts = await AccountsDAO.findActiveAccounts(userId)

    if (accounts.length === 0) {
      throw new Error('No active accounts found')
    }

    // Find the email across all user accounts
    let email = null
    for (const account of accounts) {
      email = await EmailsDAO.findEmailByIdAndAccount(emailId, account.id)
      if (email) break
    }

    if (!email) {
      throw new Error('Email not found')
    }

    // Mark as read if not already
    if (!email.isRead) {
      await EmailsDAO.markAsRead(email.id)
    }

    // Parse email content from EML file
    let textContent: string | undefined
    let htmlContent: string | undefined

    if (email.emlPath) {
      try {
        const content = await parseEmlContent(email.emlPath)
        textContent = content.textContent
        htmlContent = content.htmlContent
      } catch (error) {
        console.error('Error parsing EML file:', error)
      }
    }

    // Format response
    return {
      ...email,
      textContent,
      htmlContent,
      date: email.date.toISOString(),
      createdAt: email.createdAt,
      updatedAt: email.updatedAt,
      labels: email.labels ? JSON.parse(email.labels) : [],
      attachments: email.attachments.map((att) => ({
        ...att,
        createdAt: att.createdAt,
        updatedAt: att.updatedAt,
      })),
      folder: email.folder
          ? {
            ...email.folder,
            createdAt: email.folder.createdAt,
            updatedAt: email.folder.updatedAt,
          }
          : null,
    }
  }
}
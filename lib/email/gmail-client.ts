import { google, gmail_v1 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { EmailMessage, EmailAccount, EmailFolder } from '@/types/email'
import { db } from '@/lib/db'

interface GoogleApiError extends Error {
  code?: number
}

function isGoogleApiError(error: unknown): error is GoogleApiError {
  return error instanceof Error && 'code' in error
}

export class GmailClient {
  private oauth2Client: OAuth2Client
  private gmail: gmail_v1.Gmail

  constructor(private account: EmailAccount) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    this.oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt?.getTime(),
    })

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
  }

  async refreshAccessToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      // Update the email account with new tokens
      await db.emailAccount.update({
        where: { id: this.account.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        },
      })

      this.oauth2Client.setCredentials(credentials)
      return credentials
    } catch (error) {
      console.error('Error refreshing access token:', error)
      throw error
    }
  }

  async getLabels(): Promise<EmailFolder[]> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me',
      })

      return (response.data.labels || []).map((label: gmail_v1.Schema$Label) => ({
        id: label.id || '',
        name: label.name || '',
        path: label.name || '',
        accountId: this.account.id,
        gmailLabelId: label.id || undefined,
      }))
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken()
        return this.getLabels()
      }
      throw error
    }
  }

  async getMessages(
    labelId = 'INBOX',
    maxResults = 100,
    pageToken?: string
  ): Promise<{ messages: EmailMessage[]; nextPageToken?: string }> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        labelIds: [labelId],
        maxResults,
        pageToken,
      })

      const messages = await Promise.all(
        response.data.messages?.map((msg: gmail_v1.Schema$Message) => this.getMessageDetails(msg.id!)) || []
      )

      return {
        messages: messages.filter((msg): msg is EmailMessage => msg !== null),
        nextPageToken: response.data.nextPageToken || undefined,
      }
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken()
        return this.getMessages(labelId, maxResults, pageToken)
      }
      throw error
    }
  }

  async getMessageDetails(messageId: string): Promise<EmailMessage | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const message = response.data
      if (!message.payload) {
        return null
      }
      
      const headers = message.payload.headers || []
      
      const getHeader = (name: string) => 
        headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name?.toLowerCase() === name.toLowerCase())?.value

      // Parse the message body
      const { textContent, htmlContent } = this.extractMessageContent(message.payload)

      return {
        id: message.id || '',
        messageId: getHeader('Message-ID') || message.id || '',
        threadId: message.threadId || undefined,
        subject: getHeader('Subject') || undefined,
        from: getHeader('From') || '',
        to: getHeader('To') || '',
        cc: getHeader('Cc') || undefined,
        bcc: getHeader('Bcc') || undefined,
        replyTo: getHeader('Reply-To') || undefined,
        date: message.internalDate ? new Date(parseInt(message.internalDate)) : new Date(),
        textContent,
        htmlContent,
        hasAttachments: this.hasAttachments(message.payload),
        labels: message.labelIds || [],
        size: message.sizeEstimate || 0,
        isRead: !(message.labelIds || []).includes('UNREAD'),
        isImportant: (message.labelIds || []).includes('IMPORTANT'),
        isSpam: (message.labelIds || []).includes('SPAM'),
        isArchived: !(message.labelIds || []).includes('INBOX'),
        isDeleted: (message.labelIds || []).includes('TRASH'),
      }
    } catch (error) {
      console.error('Error getting message details:', error)
      return null
    }
  }

  async getRawMessage(messageId: string): Promise<string> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw',
      })

      return Buffer.from(response.data.raw || '', 'base64').toString()
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken()
        return this.getRawMessage(messageId)
      }
      throw error
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.delete({
        userId: 'me',
        id: messageId,
      })
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken()
        return this.deleteMessage(messageId)
      }
      throw error
    }
  }

  async archiveMessage(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
        },
      })
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken()
        return this.archiveMessage(messageId)
      }
      throw error
    }
  }

  private extractMessageContent(payload: gmail_v1.Schema$MessagePart): { textContent?: string; htmlContent?: string } {
    let textContent = ''
    let htmlContent = ''

    const extractParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          textContent += Buffer.from(part.body.data, 'base64').toString()
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlContent += Buffer.from(part.body.data, 'base64').toString()
        } else if (part.parts) {
          extractParts(part.parts)
        }
      }
    }

    if (payload.parts) {
      extractParts(payload.parts)
    } else if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        textContent = Buffer.from(payload.body.data, 'base64').toString()
      } else if (payload.mimeType === 'text/html') {
        htmlContent = Buffer.from(payload.body.data, 'base64').toString()
      }
    }

    return { textContent: textContent || undefined, htmlContent: htmlContent || undefined }
  }

  private hasAttachments(payload: gmail_v1.Schema$MessagePart): boolean {
    if (payload.parts) {
      return payload.parts.some((part: gmail_v1.Schema$MessagePart) => 
        part.filename && part.filename.length > 0
      )
    }
    return false
  }
}
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  EmailMessage,
  EmailAccount,
  EmailFolder,
  EmailAttachment,
} from '@/types/email';
import { db } from '@/lib/db';

interface GoogleApiError extends Error {
  code?: number;
}

function isGoogleApiError(error: unknown): error is GoogleApiError {
  return error instanceof Error && 'code' in error;
}

export class GmailClient {
  private readonly oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;

  constructor(private account: EmailAccount) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    this.oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.expiresAt?.getTime(),
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async refreshAccessToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update the email account with new tokens
      await db.emailAccount.update({
        where: { id: this.account.id },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });

      this.oauth2Client.setCredentials(credentials);
      return credentials;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  async getLabels(): Promise<EmailFolder[]> {
    try {
      const response = await this.gmail.users.labels.list({
        userId: 'me',
      });

      return (response.data.labels || []).map(
        (label: gmail_v1.Schema$Label) => ({
          id: label.id || '',
          name: label.name || '',
          path: label.name || '',
          accountId: this.account.id,
          gmailLabelId: label.id || undefined,
        })
      );
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.getLabels();
      }
      throw error;
    }
  }

  async getMessages(
    maxResults: number,
    pageToken?: string
  ): Promise<{ messages: EmailMessage[]; nextPageToken?: string }> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        // No labelIds means all messages
      });

      const messages = await Promise.all(
        response.data.messages?.map((msg: gmail_v1.Schema$Message) =>
          this.getMessageDetails(msg.id!)
        ) || []
      );

      return {
        messages: messages.filter((msg): msg is EmailMessage => msg !== null),
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.getMessages(maxResults, pageToken);
      } else if (isGoogleApiError(error) && (error.code === 429 || error.code === 403  || error.message.includes("Quota exceeded"))) {
          console.log('Quota exceeded, waiting 1 minute before retry...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.getMessages(maxResults, pageToken);
      }
      throw error;
    }
  }

  async getMessageDetails(messageId: string): Promise<EmailMessage | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message.payload) {
        return null;
      }

      const headers = message.payload.headers || [];

      const getHeader = (name: string) =>
        headers.find(
          (h: gmail_v1.Schema$MessagePartHeader) =>
            h.name?.toLowerCase() === name.toLowerCase()
        )?.value;

      // Parse the message body
      const { textContent, htmlContent } = this.extractMessageContent(
        message.payload
      );

      // Extract attachments
      const attachments = await this.extractAttachments(
        messageId,
        message.payload
      );

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
        date: message.internalDate
          ? new Date(parseInt(message.internalDate))
          : new Date(),
        textContent,
        htmlContent,
        hasAttachments: this.hasAttachments(message.payload),
        attachments,
        labels: message.labelIds || [],
        size: message.sizeEstimate || 0,
        isRead: !(message.labelIds || []).includes('UNREAD'),
        isImportant: (message.labelIds || []).includes('IMPORTANT'),
        isSpam: (message.labelIds || []).includes('SPAM'),
        isArchived: !(message.labelIds || []).includes('INBOX'),
        isDeleted: (message.labelIds || []).includes('TRASH'),
      };
    } catch (error) {
      console.error('Error getting message details:', error);
      return null;
    }
  }

  async getRawMessage(messageId: string): Promise<string> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw',
      });

      return Buffer.from(response.data.raw || '', 'base64').toString();
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.getRawMessage(messageId);
      }
      throw error;
    }
  }

  private extractMessageContent(payload: gmail_v1.Schema$MessagePart): {
    textContent?: string;
    htmlContent?: string;
  } {
    let textContent = '';
    let htmlContent = '';

    const extractParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          textContent += Buffer.from(part.body.data, 'base64').toString();
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlContent += Buffer.from(part.body.data, 'base64').toString();
        } else if (part.parts) {
          extractParts(part.parts);
        }
      }
    };

    if (payload.parts) {
      extractParts(payload.parts);
    } else if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        textContent = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.mimeType === 'text/html') {
        htmlContent = Buffer.from(payload.body.data, 'base64').toString();
      }
    }

    return {
      textContent: textContent || undefined,
      htmlContent: htmlContent || undefined,
    };
  }

  private hasAttachments(payload: gmail_v1.Schema$MessagePart): boolean {
    if (payload.parts) {
      return payload.parts.some(
        (part: gmail_v1.Schema$MessagePart) =>
          part.filename && part.filename.length > 0
      );
    }
    return false;
  }

  private async extractAttachments(
    messageId: string,
    payload: gmail_v1.Schema$MessagePart
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    const extractParts = async (parts: gmail_v1.Schema$MessagePart[]) => {
      for (const part of parts) {
        if (
          part.filename &&
          part.filename.length > 0 &&
          part.body?.attachmentId
        ) {
          try {
            // Download the attachment
            const attachmentResponse =
              await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId,
                id: part.body.attachmentId,
              });

            if (attachmentResponse.data.data) {
              attachments.push({
                filename: part.filename,
                contentType: part.mimeType || 'application/octet-stream',
                size: part.body.size || 0,
                content: Buffer.from(attachmentResponse.data.data, 'base64'),
              });
            }
          } catch (error) {
            console.error(
              `Error downloading attachment ${part.filename}:`,
              error
            );
          }
        } else if (part.parts) {
          await extractParts(part.parts);
        }
      }
    };

    if (payload.parts) {
      await extractParts(payload.parts);
    }

    return attachments;
  }

  async getHistory(
    startHistoryId: string,
    maxResults = 500
  ): Promise<{
    history: gmail_v1.Schema$History[];
    historyId: string;
    messagesAdded: string[];
    messagesDeleted: string[];
    labelsAdded: Map<string, string[]>;
    labelsRemoved: Map<string, string[]>;
  }> {
    try {
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        maxResults,
        historyTypes: [
          'messageAdded',
          'messageDeleted',
          'labelAdded',
          'labelRemoved',
        ],
      });

      if (!response.data.history) {
        return {
          history: [],
          historyId: response.data.historyId || startHistoryId,
          messagesAdded: [],
          messagesDeleted: [],
          labelsAdded: new Map(),
          labelsRemoved: new Map(),
        };
      }

      const messagesAdded = new Set<string>();
      const messagesDeleted = new Set<string>();
      const labelsAdded = new Map<string, Set<string>>();
      const labelsRemoved = new Map<string, Set<string>>();

      for (const historyItem of response.data.history) {
        // Process added messages
        if (historyItem.messagesAdded) {
          for (const msg of historyItem.messagesAdded) {
            if (msg.message?.id) {
              messagesAdded.add(msg.message.id);
            }
          }
        }

        // Process deleted messages
        if (historyItem.messagesDeleted) {
          for (const msg of historyItem.messagesDeleted) {
            if (msg.message?.id) {
              messagesDeleted.add(msg.message.id);
            }
          }
        }

        // Process added labels
        if (historyItem.labelsAdded) {
          for (const labelChange of historyItem.labelsAdded) {
            if (labelChange.message?.id && labelChange.labelIds) {
              const messageId = labelChange.message.id;
              if (!labelsAdded.has(messageId)) {
                labelsAdded.set(messageId, new Set());
              }
              labelChange.labelIds.forEach(labelId =>
                labelsAdded.get(messageId)!.add(labelId)
              );
            }
          }
        }

        // Process removed labels
        if (historyItem.labelsRemoved) {
          for (const labelChange of historyItem.labelsRemoved) {
            if (labelChange.message?.id && labelChange.labelIds) {
              const messageId = labelChange.message.id;
              if (!labelsRemoved.has(messageId)) {
                labelsRemoved.set(messageId, new Set());
              }
              labelChange.labelIds.forEach(labelId =>
                labelsRemoved.get(messageId)!.add(labelId)
              );
            }
          }
        }
      }

      return {
        history: response.data.history,
        historyId: response.data.historyId || startHistoryId,
        messagesAdded: Array.from(messagesAdded),
        messagesDeleted: Array.from(messagesDeleted),
        labelsAdded: new Map(
          Array.from(labelsAdded.entries()).map(([k, v]) => [k, Array.from(v)])
        ),
        labelsRemoved: new Map(
          Array.from(labelsRemoved.entries()).map(([k, v]) => [
            k,
            Array.from(v),
          ])
        ),
      };
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.getHistory(startHistoryId, maxResults);
      }
      throw error;
    }
  }

  async getProfile(): Promise<{ emailAddress: string; historyId: string }> {
    try {
      const response = await this.gmail.users.getProfile({
        userId: 'me',
      });

      return {
        emailAddress: response.data.emailAddress || '',
        historyId: response.data.historyId || '',
      };
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.getProfile();
      }
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      // Move message to trash (doesn't permanently delete)
      await this.gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });
    } catch (error) {
      if (isGoogleApiError(error) && error.code === 401) {
        await this.refreshAccessToken();
        return this.deleteMessage(messageId);
      }
      throw error;
    }
  }
}

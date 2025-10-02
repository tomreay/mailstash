import { google, gmail_v1 } from 'googleapis';
import {
  EmailMessage,
  EmailAccount,
  EmailFolder,
  EmailAttachment,
} from '@/types/email';
import { retryGmailOperation } from '@/lib/utils/retry';
import { GmailTokenManager } from '@/lib/services/gmail-token-manager';

export class GmailClient {
  private tokenManager: GmailTokenManager;
  private gmail: gmail_v1.Gmail | null = null;

  constructor(private account: EmailAccount) {
    this.tokenManager = new GmailTokenManager(account);
  }

  /**
   * Initialize the Gmail API client with valid tokens
   */
  private async initializeGmail(): Promise<gmail_v1.Gmail> {
    if (!this.gmail) {
      const oauth2Client = await this.tokenManager.getValidClient();
      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    } else {
      // Ensure token is still valid
      await this.tokenManager.getValidClient();
    }
    return this.gmail;
  }

  async getLabels(): Promise<EmailFolder[]> {
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.labels.list({ userId: 'me' }),
      'getLabels',
      { accountId: this.account.id }
    );

    return (response.data.labels || []).map(
      (label: gmail_v1.Schema$Label) => ({
        id: label.id || '',
        name: label.name || '',
        path: label.name || '',
        accountId: this.account.id,
        gmailLabelId: label.id || undefined,
      })
    );
  }

  async getMessagesList(
    maxResults: number,
    pageToken?: string
  ): Promise<{ messages: gmail_v1.Schema$Message[]; nextPageToken?: string }> {
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        // Exclude SPAM and TRASH messages from sync
        q: '-in:spam -in:trash',
      }),
      'getMessagesList',
      { accountId: this.account.id, pageToken, maxResults }
    );

    return {
      messages: response.data.messages || [],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }
  
  async getMessagesBatch(
    messageIds: string[]
  ): Promise<{
    messages: EmailMessage[];
    failures: Array<{ messageId: string; error: string }>
  }> {
    const gmail = await this.initializeGmail();
    const messages: EmailMessage[] = [];
    const failures: Array<{ messageId: string; error: string }> = [];

    // Process in chunks of 50 (Gmail batch limit recommendation)
    const chunkSize = 50;

    for (let i = 0; i < messageIds.length; i += chunkSize) {
      const chunk = messageIds.slice(i, i + chunkSize);

      try {
        // Execute batch request using Promise.allSettled for individual error handling
        const batchResults = await Promise.allSettled(
          chunk.map(async (messageId) => {
            try {
              const response = await retryGmailOperation(
                () => gmail.users.messages.get({
                  userId: 'me',
                  id: messageId,
                  format: 'full',
                }),
                'getMessageBatch',
                { messageId }
              );

              const parsed = this.parseMessageResponse(response.data);
              if (parsed) {
                return { success: true, message: parsed };
              } else {
                return { success: false, messageId, error: 'Failed to parse message' };
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Failed to fetch message ${messageId}:`, errorMsg);
              return { success: false, messageId, error: errorMsg };
            }
          })
        );

        // Process results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.success && result.value.message) {
              messages.push(result.value.message);
            } else if (!result.value.success) {
              failures.push({
                messageId: result.value.messageId!,
                error: result.value.error!
              });
            }
          } else {
            // This shouldn't happen with our error handling, but just in case
            console.error('Batch request rejected:', result.reason);
          }
        }

        // Log progress
        console.log(
          `[Batch] Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(messageIds.length / chunkSize)}: ` +
          `${messages.length} success, ${failures.length} failures`
        );

      } catch (error) {
        console.error(`Batch request failed for chunk starting at ${i}:`, error);
        // Add all messages in this chunk as failures
        for (const messageId of chunk) {
          failures.push({
            messageId,
            error: `Batch request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }

    return { messages, failures };
  }

  private parseMessageResponse(message: gmail_v1.Schema$Message): EmailMessage | null {
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

    // Note: Attachments are not downloaded in batch mode to avoid memory issues
    // They can be fetched separately if needed

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
      attachments: [], // Skip attachments in batch mode
      labels: message.labelIds || [],
      size: message.sizeEstimate || 0,
      isRead: !(message.labelIds || []).includes('UNREAD'),
      isImportant: (message.labelIds || []).includes('IMPORTANT'),
      isSpam: (message.labelIds || []).includes('SPAM'),
      isArchived: !(message.labelIds || []).includes('INBOX'),
      isDeleted: (message.labelIds || []).includes('TRASH'),
    };
  }

  async getMessageDetails(messageId: string): Promise<EmailMessage | null> {
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      }),
      'getMessageDetails',
      { messageId }
    );

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
  }

  async getRawMessage(messageId: string): Promise<string> {
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw',
      }),
      'getRawMessage',
      { messageId }
    );

    return Buffer.from(response.data.raw || '', 'base64').toString();
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
    const gmail = await this.initializeGmail();
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
              await gmail.users.messages.attachments.get({
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
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        maxResults,
        historyTypes: [
          'messageAdded',
          'messageDeleted',
          'labelAdded',
          'labelRemoved',
        ],
      }),
      'getHistory',
      { startHistoryId, maxResults }
    );

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
            // Skip messages in SPAM or TRASH
            const labelIds = msg.message.labelIds || [];
            if (!labelIds.includes('SPAM') && !labelIds.includes('TRASH')) {
              messagesAdded.add(msg.message.id);
            }
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
  }

  async getProfile(): Promise<{ emailAddress: string; historyId: string }> {
    const gmail = await this.initializeGmail();

    const response = await retryGmailOperation(
      () => gmail.users.getProfile({ userId: 'me' }),
      'getProfile',
      { accountId: this.account.id }
    );

    return {
      emailAddress: response.data.emailAddress || '',
      historyId: response.data.historyId || '',
    };
  }

  async deleteMessage(messageId: string): Promise<void> {
    const gmail = await this.initializeGmail();

    // Move message to trash (doesn't permanently delete)
    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });
  }
}

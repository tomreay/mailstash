import { ImapFlow, FetchMessageObject, SearchObject } from 'imapflow';
import {
  simpleParser,
  ParsedMail,
  Attachment,
  AddressObject,
} from 'mailparser';
import { EmailMessage, EmailAccount, EmailFolder } from '@/types/email';

export class ImapClient {
  private client: ImapFlow;

  constructor(private account: EmailAccount) {
    this.client = new ImapFlow({
      host: account.imapHost!,
      port: account.imapPort || 993,
      secure: account.imapSecure !== false,
      auth: {
        user: account.imapUser!,
        pass: account.imapPass!,
      },
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.logout();
  }

  async getMailboxes(): Promise<EmailFolder[]> {
    const mailboxes = await this.client.list();

    return mailboxes.map(mailbox => ({
      id: mailbox.path,
      name: mailbox.name,
      path: mailbox.path,
      accountId: this.account.id,
    }));
  }

  async getMessages(
    mailbox = 'INBOX',
    limit = 100,
    since?: Date
  ): Promise<EmailMessage[]> {
    const lock = await this.client.getMailboxLock(mailbox);

    try {
      const searchQuery: SearchObject = {};
      if (since) {
        searchQuery.since = since;
      }

      const messages: EmailMessage[] = [];
      const searchResult = await this.client.search(searchQuery);

      if (!searchResult) {
        return [];
      }

      const messageIds = Array.isArray(searchResult) ? searchResult : [];

      // Get the most recent messages first
      const recentIds = messageIds.slice(-limit).reverse();

      for (const uid of recentIds) {
        const message = await this.client.fetchOne(uid, {
          source: true,
          flags: true,
          envelope: true,
          bodyStructure: true,
        });

        if (message && message.source) {
          const parsed = await simpleParser(message.source);
          const emailMessage = this.parseImapMessage(message, parsed);
          messages.push(emailMessage);
        }
      }

      return messages;
    } finally {
      lock.release();
    }
  }

  async getRawMessage(mailbox: string, uid: number): Promise<string> {
    const lock = await this.client.getMailboxLock(mailbox);

    try {
      const message = await this.client.fetchOne(uid, { source: true });
      if (message && typeof message === 'object' && 'source' in message) {
        return message.source?.toString() || '';
      }
      return '';
    } finally {
      lock.release();
    }
  }

  private parseImapMessage(
    imapMessage: FetchMessageObject,
    parsed: ParsedMail
  ): EmailMessage {
    const flags = imapMessage.flags || new Set();

    return {
      id: imapMessage.uid.toString(),
      messageId: parsed.messageId || imapMessage.uid.toString(),
      threadId: parsed.references?.[0] || undefined,
      subject: parsed.subject,
      from: this.formatAddress(parsed.from),
      to: this.formatAddress(parsed.to),
      cc: this.formatAddress(parsed.cc),
      bcc: this.formatAddress(parsed.bcc),
      replyTo: this.formatAddress(parsed.replyTo),
      date: parsed.date || new Date(),
      textContent: parsed.text || undefined,
      htmlContent: typeof parsed.html === 'string' ? parsed.html : undefined,
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      attachments: parsed.attachments?.map((att: Attachment) => ({
        filename: att.filename || 'unknown',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        content: att.content,
      })),
      labels: Array.from(flags),
      size: imapMessage.size,
      isRead: flags.has('\\Seen'),
      isImportant: flags.has('\\Flagged'),
      isSpam: false, // IMAP doesn't have a standard spam flag
      isArchived: false, // Will be determined by mailbox
      isDeleted: flags.has('\\Deleted'),
    };
  }

  private formatAddress(
    addresses: AddressObject | AddressObject[] | undefined
  ): string {
    if (!addresses) return '';
    if (Array.isArray(addresses)) {
      return addresses
        .map(addr => addr.value[0]?.address || '')
        .filter(Boolean)
        .join(', ');
    }
    return addresses.value[0]?.address || '';
  }
}

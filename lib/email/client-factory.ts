import { EmailAccount } from '@/types/email';
import { GmailClient } from './gmail-client';
import { ImapClient } from './imap-client';

export type EmailClient = GmailClient | ImapClient;

export function createEmailClient(account: EmailAccount): EmailClient {
  switch (account.provider) {
    case 'gmail':
      return new GmailClient(account);
    case 'imap':
      return new ImapClient(account);
    default:
      throw new Error(`Unsupported email provider: ${account.provider}`);
  }
}

export function isGmailClient(client: EmailClient): client is GmailClient {
  return 'getHistory' in client && 'getMessageDetails' in client;
}

export function isImapClient(client: EmailClient): client is ImapClient {
  return 'connect' in client && 'disconnect' in client;
}
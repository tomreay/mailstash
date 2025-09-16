import { createReadStream, promises as fs } from 'fs';
import { simpleParser, ParsedMail } from 'mailparser';
import { EmailMessage } from '@/types/email';

// Use dynamic import for node-mbox as it's a CommonJS module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MboxStream } = require('node-mbox');

export interface MboxEmailData {
  messageId: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  date: Date;
  rawContent: string;
  hasAttachments: boolean;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

export class MboxParser {
  /**
   * Validate that the file is in mbox format
   */
  async validate(filePath: string): Promise<boolean> {
    try {
      console.log(`[mbox-parser] Validating file: ${filePath}`);

      // Check if file exists
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!fileExists) {
        console.error(`[mbox-parser] File does not exist: ${filePath}`);
        return false;
      }

      const file = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(100);
      const { bytesRead } = await file.read(buffer, 0, 100, 0);
      await file.close();

      if (bytesRead === 0) {
        console.error(`[mbox-parser] File is empty: ${filePath}`);
        return false;
      }

      const firstBytes = buffer.subarray(0, bytesRead).toString('utf-8');
      console.log(
        `[mbox-parser] First 100 bytes of file:`,
        JSON.stringify(firstBytes)
      );
      console.log(
        `[mbox-parser] First 5 chars:`,
        JSON.stringify(firstBytes.substring(0, 5))
      );
      console.log(
        `[mbox-parser] Hex of first 10 bytes:`,
        buffer.subarray(0, Math.min(10, bytesRead)).toString('hex')
      );

      // Mbox files typically start with "From "
      const isValid = firstBytes.startsWith('From ');
      console.log(`[mbox-parser] Is valid mbox format: ${isValid}`);

      return isValid;
    } catch (error) {
      console.error('[mbox-parser] Error validating mbox file:', error);
      return false;
    }
  }

  /**
   * Parse messages from mbox file using async generator for memory efficiency
   * Uses node-mbox for robust parsing of various mbox formats
   */
  async *parseMessages(filePath: string): AsyncGenerator<MboxEmailData> {
    const stream = createReadStream(filePath);
    const mbox = MboxStream(stream);

    console.log(`[mbox-parser] Starting to parse messages from ${filePath}`);

    // Create a promise-based wrapper for the event-based mbox parser
    const messages: Buffer[] = [];
    let resolver: ((value: Buffer | null) => void) | null = null;
    let rejecter: ((error: Error) => void) | null = null;
    let streamEnded = false;
    let errorOccurred: Error | null = null;

    mbox.on('data', (msg: Buffer) => {
      if (resolver) {
        resolver(msg);
        resolver = null;
      } else {
        messages.push(msg);
      }
    });

    mbox.on('error', (err: Error) => {
      console.error(`[mbox-parser] Error in parse stream:`, err);
      errorOccurred = err;
      streamEnded = true;
      if (rejecter) {
        rejecter(err);
        rejecter = null;
      } else if (resolver) {
        resolver(null);
        resolver = null;
      }
    });

    mbox.on('end', () => {
      console.log(`[mbox-parser] Stream ended. Total messages buffered: ${messages.length}`);
      streamEnded = true;
      if (resolver) {
        resolver(null);
        resolver = null;
      }
    });

    // Generator to yield parsed messages
    let yieldCount = 0;
    let parseErrors = 0;

    while (true) {
      let rawMessage: Buffer | null;

      if (messages.length > 0) {
        rawMessage = messages.shift()!;
      } else if (streamEnded) {
        // Stream has ended and no more messages in buffer
        console.log(
          `[mbox-parser] Finished parsing. Total yielded: ${yieldCount}, Parse errors: ${parseErrors}`
        );
        if (errorOccurred) {
          throw errorOccurred;
        }
        break;
      } else {
        // Wait for next message or stream end
        rawMessage = await new Promise<Buffer | null>((resolve, reject) => {
          // Check if stream already ended while we were setting up the promise
          if (streamEnded) {
            resolve(null);
            return;
          }
          resolver = resolve;
          rejecter = reject;
        });
      }

      if (rawMessage === null) {
        // End of stream
        console.log(
          `[mbox-parser] Finished parsing. Total yielded: ${yieldCount}, Parse errors: ${parseErrors}`
        );
        break;
      }

      const rawContent = rawMessage.toString('utf-8');
      const emailData = await this.parseRawEmail(rawContent);
      if (emailData) {
        yieldCount++;
        if (yieldCount === 1 || yieldCount % 100 === 0) {
          console.log(`[mbox-parser] Yielded ${yieldCount} parsed emails`);
        }
        yield emailData;
      } else {
        parseErrors++;
        if (parseErrors % 100 === 0) {
          console.log(`[mbox-parser] Parse errors so far: ${parseErrors}`);
        }
      }
    }
  }

  /**
   * Parse raw email content into structured data
   */
  private async parseRawEmail(
    rawContent: string
  ): Promise<MboxEmailData | null> {
    try {
      // Use mailparser to parse the email
      const parsed: ParsedMail = await simpleParser(rawContent);

      // Extract message ID or generate one
      const messageId =
        parsed.messageId ||
        `generated-${Date.now()}-${Math.random().toString(36).substring(2, 11)}@mailstash`;

      // Extract from address
      const from = parsed.from?.text || 'unknown@unknown';

      // Extract to addresses
      const to = Array.isArray(parsed.to)
        ? parsed.to.map(addr => addr.text).join(', ')
        : parsed.to?.text || '';

      // Extract cc addresses
      const cc = Array.isArray(parsed.cc)
        ? parsed.cc.map(addr => addr.text).join(', ')
        : parsed.cc?.text;

      // Extract bcc addresses
      const bcc = Array.isArray(parsed.bcc)
        ? parsed.bcc.map(addr => addr.text).join(', ')
        : parsed.bcc?.text;

      // Process attachments
      const attachments = parsed.attachments?.map(att => ({
        filename: att.filename || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        content: att.content as Buffer,
      }));

      return {
        messageId,
        from,
        to,
        cc,
        bcc,
        subject: parsed.subject,
        date: parsed.date || new Date(),
        rawContent,
        hasAttachments: (attachments?.length || 0) > 0,
        attachments,
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Convert parsed email to EmailMessage format for storage
   */
  convertToEmailMessage(data: MboxEmailData): EmailMessage {
    return {
      id: data.messageId, // Will be replaced with proper ID during storage
      messageId: data.messageId,
      threadId: undefined,
      from: data.from,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      replyTo: undefined,
      subject: data.subject,
      date: data.date,
      hasAttachments: data.hasAttachments,
      isRead: false,
      isImportant: false,
      isSpam: false,
      isArchived: true, // Archive imports are considered archived
      isDeleted: false,
      category: 'inbox',
      labels: undefined,
      size: Buffer.byteLength(data.rawContent),
      attachments: data.attachments?.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: att.content,
      })),
    };
  }
}

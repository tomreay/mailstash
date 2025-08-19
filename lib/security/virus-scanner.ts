import NodeClam from 'clamscan';
import { db } from '@/lib/db';
import { Readable } from 'stream';

export class VirusScanner {
  private clamscan: NodeClam | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.clamscan = new NodeClam();
      await this.clamscan.init({
        removeInfected: false, // Don't automatically remove infected files
        quarantineInfected: false, // Don't quarantine infected files
        scanLog: undefined, // Don't log scan results
        debugMode: false,
        fileList: undefined,
        scanRecursively: true,
        clamscan: {
          path: '/usr/bin/clamscan', // Default ClamAV path
          db: undefined, // Use default database location
          scanArchives: true,
          active: true,
        },
        clamdscan: {
          socket: false, // Use TCP connection
          host: 'localhost',
          port: 3310,
          timeout: 60000,
          localFallback: true,
          path: '/usr/bin/clamdscan',
          configFile: undefined,
          multiscan: true,
          reloadDb: false,
          active: true,
          bypassTest: false,
        },
        preference: 'clamdscan', // Prefer daemon over direct scan
      });

      this.isInitialized = true;
      console.log('Virus scanner initialized successfully');
    } catch (error) {
      console.error('Failed to initialize virus scanner:', error);
      console.log('Virus scanning will be disabled');
    }
  }

  async scanAttachment(
    attachmentId: string,
    filePath: string
  ): Promise<'clean' | 'virus' | 'error'> {
    if (!this.clamscan) {
      console.log('Virus scanner not available, marking as error');
      return 'error';
    }

    try {
      const scanResult = await this.clamscan.scanFile(filePath);

      let result: 'clean' | 'virus' | 'error' = 'clean';

      if (scanResult.isInfected) {
        result = 'virus';
        console.warn(
          `Virus detected in attachment ${attachmentId}:`,
          scanResult.viruses
        );
      }

      // Update attachment scan status
      await db.attachment.update({
        where: { id: attachmentId },
        data: {
          isScanned: true,
          scanResult: result,
        },
      });

      return result;
    } catch (error) {
      console.error('Error scanning attachment:', error);

      // Update attachment scan status as error
      await db.attachment.update({
        where: { id: attachmentId },
        data: {
          isScanned: true,
          scanResult: 'error',
        },
      });

      return 'error';
    }
  }

  async scanBuffer(buffer: Buffer): Promise<'clean' | 'virus' | 'error'> {
    if (!this.clamscan) {
      return 'error';
    }

    try {
      const stream = Readable.from(buffer);
      const scanResult = await this.clamscan.scanStream(stream);

      if (scanResult.isInfected) {
        return 'virus';
      }

      return 'clean';
    } catch (error) {
      console.error('Error scanning buffer:', error);
      return 'error';
    }
  }

  async getVersion(): Promise<string | null> {
    if (!this.clamscan) return null;

    try {
      const version = await this.clamscan.getVersion();
      return version;
    } catch (error) {
      console.error('Error getting ClamAV version:', error);
      return null;
    }
  }

  async updateDatabase(): Promise<boolean> {
    // Database updates would typically be done via freshclam
    console.log('Database updates should be handled by freshclam');
    return false;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.clamscan) return false;

    try {
      const version = await this.getVersion();
      return version !== null;
    } catch {
      return false;
    }
  }

  async scanAllAttachments(): Promise<void> {
    if (!this.clamscan) {
      console.log('Virus scanner not available, skipping scan');
      return;
    }

    const unscannedAttachments = await db.attachment.findMany({
      where: { isScanned: false },
      select: { id: true, filePath: true },
    });

    console.log(
      `Scanning ${unscannedAttachments.length} unscanned attachments`
    );

    for (const attachment of unscannedAttachments) {
      await this.scanAttachment(attachment.id, attachment.filePath);
    }
  }
}

// Singleton instance
export const virusScanner = new VirusScanner();

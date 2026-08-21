/**
 * Backfills Email.bodyText for emails stored before full-text search existed.
 *
 * Bodies were only ever written to the EML file on disk, so each row is
 * refilled by re-parsing its own .eml. Safe to interrupt and re-run: it only
 * ever selects rows where bodyText IS NULL, so a second run resumes where the
 * first stopped.
 *
 * Usage:
 *   yarn tsx scripts/backfill-body-text.ts [--batch-size=200] [--dry-run]
 */

import { promises as fs } from 'fs';
import { db } from '../lib/db';
import { extractBodyText } from '../lib/search/body-text';

interface Options {
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { batchSize: 200, dryRun: false };

  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid --batch-size: ${arg.split('=')[1]}`);
      }
      options.batchSize = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function main() {
  const { batchSize, dryRun } = parseArgs(process.argv);

  const total = await db.email.count({
    where: { bodyText: null, emlPath: { not: null } },
  });

  console.log(
    `[backfill] ${total} emails need a bodyText${dryRun ? ' (dry run)' : ''}`
  );
  if (total === 0) return;

  let processed = 0;
  let filled = 0;
  let missingFile = 0;
  let empty = 0;

  // Keyset pagination on id: rows drop out of the result set as they are
  // filled, so a numeric offset would skip records.
  let cursor: string | undefined;

  for (;;) {
    const batch = await db.email.findMany({
      where: {
        bodyText: null,
        emlPath: { not: null },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, emlPath: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    });

    if (batch.length === 0) break;

    for (const email of batch) {
      processed++;

      try {
        const raw = await fs.readFile(email.emlPath!, 'utf-8');
        const bodyText = await extractBodyText(raw);

        if (!bodyText) {
          empty++;
          continue;
        }

        if (!dryRun) {
          await db.email.update({
            where: { id: email.id },
            data: { bodyText },
          });
        }
        filled++;
      } catch (error) {
        // A missing or unreadable EML leaves bodyText NULL; the email is still
        // findable by subject/from/to, just not by body.
        missingFile++;
        console.warn(
          `[backfill] Could not read EML for ${email.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    console.log(
      `[backfill] ${processed}/${total} processed (${filled} filled)`
    );

    // In a dry run nothing is written, so the same rows would be returned
    // forever without advancing the cursor.
    cursor = batch[batch.length - 1].id;
  }

  console.log(
    `[backfill] Done. ${filled} filled, ${empty} had no body, ${missingFile} unreadable.`
  );
}

main()
  .catch(error => {
    console.error('[backfill] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

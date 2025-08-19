'use server';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AccountsService } from '@/lib/services/accounts.service';
import { scheduleMboxImport } from '@/lib/jobs/queue';
import path from 'path';
import { promises as fs } from 'fs';

export async function createArchiveAccount(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const email = formData.get('email') as string;
  const displayName = formData.get('displayName') as string;
  const mboxFilePath = formData.get('mboxFilePath') as string;

  // Validate required fields
  if (!email || !mboxFilePath) {
    throw new Error('Please select a file and enter an email address');
  }

  // Resolve the file path (handle TUS uploads)
  let resolvedPath = mboxFilePath;

  if (mboxFilePath.startsWith('tus:')) {
    const uploadId = mboxFilePath.substring(4);

    if (!uploadId.endsWith('.mbox')) {
      resolvedPath = path.join(
        process.cwd(),
        'tmp',
        'mbox-uploads',
        uploadId + '.mbox'
      );
    } else {
      resolvedPath = path.join(process.cwd(), 'tmp', 'mbox-uploads', uploadId);
    }

    // Verify file exists
    const fileExists = await fs
      .access(resolvedPath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      throw new Error('Upload file not found');
    }
  }

  // Create archive account using the service layer
  const account = await AccountsService.createAccount(session.user.id, {
    provider: 'archive',
    email,
    displayName: displayName || email,
  });

  // Schedule mbox import job
  await scheduleMboxImport(account.id, resolvedPath);

  redirect('/accounts');
}

'use server';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AccountsService } from '@/lib/services/accounts.service';

export async function createImapAccount(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const email = formData.get('email') as string;
  const displayName = formData.get('displayName') as string;
  const host = formData.get('host') as string;
  const port = formData.get('port') as string;
  const secure = formData.get('secure') === 'true';
  const user = formData.get('user') as string;
  const pass = formData.get('pass') as string;

  // Validate required fields
  if (!email || !host || !user || !pass) {
    throw new Error('Please fill in all required fields');
  }

  try {
    await AccountsService.createAccount(session.user.id, {
      provider: 'imap',
      email,
      displayName: displayName || email,
      imapConfig: {
        host,
        port: parseInt(port),
        secure,
        user,
        pass,
      },
    });

    redirect('/accounts');
  } catch (error) {
    console.error('Error creating IMAP account:', error);
    throw new Error(
      'Failed to add account. Please check your credentials and try again.'
    );
  }
}

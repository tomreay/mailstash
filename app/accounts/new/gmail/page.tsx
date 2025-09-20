'use client';

import { useState } from 'react';
import { Mail, Loader2, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AccountCreationLayout } from '@/components/account-creation-layout';

export default function GmailAccountPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGmailConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use our custom OAuth flow that doesn't affect the user session
      window.location.href = '/api/auth/gmail?action=connect';
    } catch {
      setError('Failed to connect with Google. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AccountCreationLayout
      title='Connect Gmail Account'
      description='Securely connect your Gmail account using OAuth authentication'
      error={error}
    >
      <Card>
        <CardHeader>
          <CardTitle>Connect Gmail Account</CardTitle>
          <CardDescription>
            You&apos;ll be redirected to Google to authorize MailStash to access
            your emails
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
            <div className='flex items-start gap-3'>
              <Shield className='h-5 w-5 text-blue-600 mt-0.5' />
              <div>
                <p className='text-sm font-medium text-blue-900'>
                  Secure Authentication
                </p>
                <p className='text-sm text-blue-700 mt-1'>
                  We use OAuth 2.0 for secure authentication. Your password is
                  never shared with MailStash.
                </p>
              </div>
            </div>
          </div>

          <div className='flex gap-3'>
            <Link href='/accounts/new'>
              <Button variant='outline' disabled={loading}>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back
              </Button>
            </Link>
            <Button
              onClick={handleGmailConnect}
              disabled={loading}
              className='flex-1'
            >
              {loading ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Mail className='h-4 w-4 mr-2' />
              )}
              Connect with Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </AccountCreationLayout>
  );
}

'use client';

import { useState } from 'react';
import { Archive, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MboxUpload } from '@/components/mbox-upload';
import { AccountCreationLayout } from '@/components/account-creation-layout';

export default function ArchiveAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveFilePath, setArchiveFilePath] = useState<string | null>(null);
  const [archiveEmail, setArchiveEmail] = useState('');
  const [archiveDisplayName, setArchiveDisplayName] = useState('');

  const handleArchiveImport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (!archiveFile || !archiveEmail || !archiveFilePath) {
        setError('Please select a file and enter an email address');
        setLoading(false);
        return;
      }

      // Create the account with the uploaded file path
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'archive',
          email: archiveEmail,
          displayName: archiveDisplayName || archiveEmail,
          mboxFilePath: archiveFilePath,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import archive');
      }

      // Success - redirect to accounts page
      router.push('/accounts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import archive');
      setLoading(false);
    }
  };

  return (
    <AccountCreationLayout
      title='Import Email Archive'
      description='Upload an mbox file to import your archived emails'
      error={error}
    >
      <Card>
        <CardHeader>
          <CardTitle>Import Email Archive</CardTitle>
          <CardDescription>
            Upload an mbox file to import your emails
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4'>
            <div className='grid gap-2'>
              <Label>Mbox File *</Label>
              <MboxUpload
                onFileSelect={file => {
                  console.log('Parent received file:', file);
                  setArchiveFile(file);
                }}
                onUploadComplete={path => {
                  console.log('Parent received upload path:', path);
                  setArchiveFilePath(path);
                }}
                selectedFile={archiveFile}
                disabled={loading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='archiveEmail'>Email Address *</Label>
              <Input
                id='archiveEmail'
                type='email'
                placeholder='archive@example.com'
                value={archiveEmail}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setArchiveEmail(e.target.value)
                }
                disabled={loading}
              />
              <p className='text-sm text-gray-500'>
                This email address will identify the account
              </p>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='archiveDisplayName'>Display Name</Label>
              <Input
                id='archiveDisplayName'
                placeholder='My Old Email Archive'
                value={archiveDisplayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setArchiveDisplayName(e.target.value)
                }
                disabled={loading}
              />
            </div>
          </div>

          <div className='p-4 bg-amber-50 border border-amber-200 rounded-lg'>
            <p className='text-sm text-amber-800'>
              <strong>Note:</strong> Archive accounts are for one-time import
              only. They won&apos;t sync with any email server. The import
              process may take several minutes depending on the file size.
            </p>
          </div>

          <div className='flex gap-3'>
            <Link href='/accounts/new'>
              <Button variant='outline' disabled={loading}>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Back
              </Button>
            </Link>
            <Button
              onClick={handleArchiveImport}
              disabled={(() => {
                return loading || !archiveFile || !archiveEmail;
              })()}
              className='flex-1'
            >
              {loading ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Archive className='h-4 w-4 mr-2' />
              )}
              Import Archive
            </Button>
          </div>
        </CardContent>
      </Card>
    </AccountCreationLayout>
  );
}

'use client';

import { useState } from 'react';
import { Archive, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MboxUpload } from '@/components/mbox-upload';
import { createArchiveAccount } from './actions';
import { useFormStatus } from 'react-dom';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' disabled={disabled || pending} className='flex-1'>
      {pending ? (
        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
      ) : (
        <Archive className='h-4 w-4 mr-2' />
      )}
      Import Archive
    </Button>
  );
}

export function ArchiveAccountForm() {
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveFilePath, setArchiveFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      if (archiveFilePath) {
        formData.append('mboxFilePath', archiveFilePath);
      }
      await createArchiveAccount(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import archive');
    }
  }

  return (
    <>
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700'>
          {error}
        </div>
      )}

      <form action={handleSubmit} className='space-y-4'>
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
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='email'>Email Address *</Label>
            <Input
              id='email'
              name='email'
              type='email'
              placeholder='archive@example.com'
              required
            />
            <p className='text-sm text-gray-500'>
              This email address will identify the account
            </p>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='displayName'>Display Name</Label>
            <Input
              id='displayName'
              name='displayName'
              placeholder='My Old Email Archive'
            />
          </div>
        </div>

        <div className='flex gap-3'>
          <Link href='/accounts/new'>
            <Button type='button' variant='outline'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back
            </Button>
          </Link>
          <SubmitButton disabled={!archiveFile || !archiveFilePath} />
        </div>
      </form>
    </>
  );
}

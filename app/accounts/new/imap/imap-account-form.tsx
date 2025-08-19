'use client';

import { useState } from 'react';
import { Server, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createImapAccount } from './actions';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' disabled={pending} className='flex-1'>
      {pending ? (
        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
      ) : (
        <Server className='h-4 w-4 mr-2' />
      )}
      Connect Account
    </Button>
  );
}

export function ImapAccountForm() {
  const [secure, setSecure] = useState(true);
  const [port, setPort] = useState('993');
  const [error, setError] = useState<string | null>(null);

  const handleSecureChange = (checked: boolean) => {
    setSecure(checked);
    setPort(checked ? '993' : '143');
  };

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      formData.append('secure', secure.toString());
      await createImapAccount(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
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
            <Label htmlFor='email'>Email Address *</Label>
            <Input
              id='email'
              name='email'
              type='email'
              placeholder='you@example.com'
              required
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='displayName'>Display Name</Label>
            <Input
              id='displayName'
              name='displayName'
              placeholder='My Work Email'
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='host'>IMAP Server *</Label>
            <Input
              id='host'
              name='host'
              placeholder='imap.example.com'
              required
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='port'>Port *</Label>
              <Input
                id='port'
                name='port'
                type='number'
                placeholder='993'
                value={port}
                onChange={e => setPort(e.target.value)}
                required
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='secure'>Security</Label>
              <div className='flex items-center space-x-2 pt-2'>
                <Switch
                  id='secure'
                  checked={secure}
                  onCheckedChange={handleSecureChange}
                />
                <Label htmlFor='secure' className='font-normal'>
                  Use SSL/TLS
                </Label>
              </div>
            </div>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='user'>Username *</Label>
            <Input
              id='user'
              name='user'
              placeholder='username or email'
              required
            />
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='pass'>Password *</Label>
            <Input
              id='pass'
              name='pass'
              type='password'
              placeholder='••••••••'
              required
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
          <SubmitButton />
        </div>
      </form>
    </>
  );
}

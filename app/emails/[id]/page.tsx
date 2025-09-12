import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  ArrowLeft,
  Calendar,
  User,
  Paperclip,
  Download,
  Reply,
  Forward,
  Trash,
  Archive,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  extractNameFromEmail,
  formatFileSize,
  formatDate,
} from '@/lib/utils/email';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { EmailsService } from '@/lib/services/emails.service';

export const dynamic = 'force-dynamic';

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { id } = await params;

  let email;
  try {
    email = await EmailsService.getEmailDetails(id, session.user.id);
  } catch {
    notFound();
  }

  const { name: senderName, email: senderEmail } = extractNameFromEmail(
    email.from
  );

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='bg-white border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-4'>
            <div className='flex items-center'>
              <Link href='/' className='flex items-center'>
                <Mail className='h-8 w-8 text-blue-600 mr-3' />
                <h1 className='text-2xl font-bold text-gray-900'>MailStash</h1>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Back Button and Actions */}
        <div className='mb-6 flex items-center justify-between'>
          <Link href='/emails'>
            <Button variant='ghost' size='sm'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Back to Emails
            </Button>
          </Link>

          <div className='flex gap-2'>
            <Button variant='outline' size='sm'>
              <Reply className='h-4 w-4 mr-2' />
              Reply
            </Button>
            <Button variant='outline' size='sm'>
              <Forward className='h-4 w-4 mr-2' />
              Forward
            </Button>
            <Button variant='outline' size='sm'>
              <Archive className='h-4 w-4 mr-2' />
              Archive
            </Button>
            <Button variant='outline' size='sm'>
              <Trash className='h-4 w-4 mr-2' />
              Delete
            </Button>
            <Button variant='outline' size='sm'>
              <Star
                className={`h-4 w-4 ${email.isImportant ? 'fill-current text-yellow-500' : ''}`}
              />
            </Button>
          </div>
        </div>

        {/* Email Content */}
        <Card>
          <CardContent className='p-6'>
            {/* Email Header */}
            <div className='mb-6'>
              <h1 className='text-2xl font-bold text-gray-900 mb-4'>
                {email.subject || '(No subject)'}
              </h1>

              <div className='flex items-start justify-between mb-4'>
                <div>
                  <div className='flex items-center gap-3 mb-2'>
                    <div className='h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center'>
                      <User className='h-5 w-5 text-gray-600' />
                    </div>
                    <div>
                      <p className='font-medium text-gray-900'>{senderName}</p>
                      <p className='text-sm text-gray-500'>
                        &lt;{senderEmail}&gt;
                      </p>
                    </div>
                  </div>

                  <div className='text-sm text-gray-600 space-y-1 ml-13'>
                    <p>To: {email.to}</p>
                    {email.cc && <p>Cc: {email.cc}</p>}
                    {email.bcc && <p>Bcc: {email.bcc}</p>}
                  </div>
                </div>

                <div className='text-right'>
                  <p className='text-sm text-gray-600 flex items-center gap-2'>
                    <Calendar className='h-4 w-4' />
                    {formatDate(email.date)}
                  </p>
                  {email.folder && (
                    <p className='text-sm text-gray-500 mt-1'>
                      Folder: {email.folder.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Labels */}
              {email.labels.length > 0 && (
                <div className='flex gap-2 mb-4'>
                  {email.labels.map(label => (
                    <Badge key={label} variant='secondary'>
                      {label}
                    </Badge>
                  ))}
                  {email.isSpam && <Badge variant='destructive'>Spam</Badge>}
                  {email.isImportant && (
                    <Badge variant='default'>Important</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Email Body */}
            <div className='prose prose-sm max-w-none'>
              {email.htmlContent ? (
                <div
                  dangerouslySetInnerHTML={{ __html: email.htmlContent }}
                  className='email-content'
                />
              ) : (
                <div className='whitespace-pre-wrap font-mono text-sm'>
                  {email.textContent || 'No content'}
                </div>
              )}
            </div>

            {/* Attachments */}
            {email.attachments.length > 0 && (
              <div className='mt-6 pt-6 border-t border-gray-200'>
                <h3 className='text-sm font-medium text-gray-900 mb-3 flex items-center gap-2'>
                  <Paperclip className='h-4 w-4' />
                  Attachments ({email.attachments.length})
                </h3>
                <div className='space-y-2'>
                  {email.attachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className='flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors'
                    >
                      <div className='flex items-center gap-3'>
                        <Paperclip className='h-4 w-4 text-gray-400' />
                        <div>
                          <p className='text-sm font-medium text-gray-900'>
                            {attachment.filename}
                          </p>
                          <p className='text-xs text-gray-500'>
                            {attachment.contentType} •{' '}
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                      </div>
                      <Button variant='ghost' size='sm'>
                        <Download className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

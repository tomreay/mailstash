import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmailListItem } from '@/types';
import { extractNameFromEmail } from '@/lib/utils/email';

interface EmailItemProps {
  email: EmailListItem;
}

export function EmailItem({ email }: EmailItemProps) {
  const { name, email: emailAddress } = extractNameFromEmail(email.from);
  const date = new Date(email.date);

  return (
    <Card className='hover:shadow-md transition-shadow cursor-pointer'>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-1'>
              <h3
                className={`text-sm font-medium truncate ${!email.isRead ? 'font-semibold' : ''}`}
              >
                {email.subject || '(No subject)'}
              </h3>
              {!email.isRead && (
                <Badge variant='default' className='text-xs'>
                  New
                </Badge>
              )}
              {email.isImportant && (
                <Badge variant='destructive' className='text-xs'>
                  Important
                </Badge>
              )}
              {email.hasAttachments && (
                <Badge variant='secondary' className='text-xs'>
                  📎
                </Badge>
              )}
              {email.markedForDeletion && (
                <Badge variant='destructive' className='text-xs'>
                  Marked for deletion
                </Badge>
              )}
            </div>
            <p className='text-sm text-gray-600 mb-1'>
              {name} &lt;{emailAddress}&gt;
            </p>
            <p className='text-sm text-gray-500 truncate'>{email.snippet}</p>
            {email.labels.length > 0 && (
              <div className='flex items-center gap-2 mt-2'>
                {email.labels.map(label => (
                  <Badge key={label} variant='secondary' className='text-xs'>
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className='ml-4 text-sm text-gray-500 whitespace-nowrap'>
            {date.toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

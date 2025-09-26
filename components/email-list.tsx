import Link from 'next/link';
import { Mail } from 'lucide-react';
import { EmailListItem } from '@/types';
import { EmailSearch } from './email-search';
import { EmailItem } from './email-item';
import { Pagination } from './pagination';
import { EmptyState } from '@/components/ui/empty-state';

interface EmailListProps {
  initialEmails: EmailListItem[];
  total: number;
  totalPages: number;
  currentPage: number;
  searchQuery: string;
  accountId?: string;
  filter?: string;
}

export function EmailList({
  initialEmails,
  total,
  totalPages,
  currentPage,
  searchQuery,
  accountId,
  filter,
}: EmailListProps) {
  return (
    <>
      {/* Search */}
      <EmailSearch
        initialQuery={searchQuery}
        accountId={accountId}
        filter={filter}
      />

      {/* Empty State */}
      {initialEmails.length === 0 && (
        <EmptyState
          icon={Mail}
          title={searchQuery ? 'No emails found' : 'No emails yet'}
          description={
            searchQuery
              ? 'Try adjusting your search query'
              : 'Sync your email account to see your emails here'
          }
        />
      )}

      {/* Email List */}
      {initialEmails.length > 0 && (
        <>
          <div className='space-y-2'>
            {initialEmails.map(email => (
              <Link
                key={email.id}
                href={`/emails/${email.id}`}
                className='block'
              >
                <EmailItem email={email} />
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            itemsPerPage={20}
            searchQuery={searchQuery}
            accountId={accountId}
            filter={filter}
          />
        </>
      )}
    </>
  );
}

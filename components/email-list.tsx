import Link from 'next/link';
import { Mail } from 'lucide-react';
import { EmailListItem } from '@/types';
import { EmailSearch } from './email-search';
import { EmailItem } from './email-item';
import { Pagination } from './pagination';

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
        <div className='text-center py-12'>
          <Mail className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            {searchQuery ? 'No emails found' : 'No emails yet'}
          </h3>
          <p className='text-gray-500'>
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Sync your email account to see your emails here'}
          </p>
        </div>
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

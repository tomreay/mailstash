'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2 } from 'lucide-react';
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSearch = (query: string) => {
    const params = new URLSearchParams();
    params.set('page', '1');
    if (query) params.set('search', query);
    if (accountId) params.set('accountId', accountId);
    if (filter) params.set('filter', filter);

    router.push(`/emails?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (searchQuery) params.set('search', searchQuery);
    if (accountId) params.set('accountId', accountId);
    if (filter) params.set('filter', filter);

    setLoading(true);
    router.push(`/emails?${params.toString()}`);
  };

  const handleEmailClick = (emailId: string) => {
    router.push(`/emails/${emailId}`);
  };

  return (
    <>
      {/* Search */}
      <EmailSearch initialQuery={searchQuery} onSearch={handleSearch} />

      {/* Loading State */}
      {loading && (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
        </div>
      )}

      {/* Empty State */}
      {!loading && initialEmails.length === 0 && (
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
      {!loading && initialEmails.length > 0 && (
        <>
          <div className='space-y-2'>
            {initialEmails.map(email => (
              <EmailItem
                key={email.id}
                email={email}
                onClick={() => handleEmailClick(email.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            itemsPerPage={20}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  searchQuery?: string;
  accountId?: string;
  filter?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  itemsPerPage,
  searchQuery,
  accountId,
  filter,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (searchQuery) params.set('search', searchQuery);
    if (accountId) params.set('accountId', accountId);
    if (filter) params.set('filter', filter);
    return `/emails?${params.toString()}`;
  };

  return (
    <div className='mt-6 flex items-center justify-between'>
      <p className='text-sm text-gray-600'>
        Showing {startItem}-{endItem} of {total} emails
      </p>
      <div className='flex gap-2'>
        {currentPage > 1 ? (
          <Link href={buildPageUrl(currentPage - 1)}>
            <Button variant='outline'>Previous</Button>
          </Link>
        ) : (
          <Button variant='outline' disabled>
            Previous
          </Button>
        )}
        {currentPage < totalPages ? (
          <Link href={buildPageUrl(currentPage + 1)}>
            <Button variant='outline'>Next</Button>
          </Link>
        ) : (
          <Button variant='outline' disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

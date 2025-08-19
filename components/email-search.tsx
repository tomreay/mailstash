'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface EmailSearchProps {
  initialQuery: string;
  accountId?: string;
  filter?: string;
}

export function EmailSearch({
  initialQuery,
  accountId,
  filter,
}: EmailSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    params.set('page', '1');
    if (query) params.set('search', query);
    if (accountId) params.set('accountId', accountId);
    if (filter) params.set('filter', filter);

    router.push(`/emails?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className='mb-6'>
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
        <Input
          type='text'
          placeholder='Search emails...'
          value={query}
          onChange={e => setQuery(e.target.value)}
          className='pl-10'
        />
      </div>
    </form>
  );
}

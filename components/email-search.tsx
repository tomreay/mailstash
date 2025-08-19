'use client';

import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface EmailSearchProps {
  initialQuery: string;
  onSearch: (query: string) => void;
}

export function EmailSearch({ initialQuery, onSearch }: EmailSearchProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query);
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

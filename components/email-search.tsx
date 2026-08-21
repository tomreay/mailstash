'use client';

import { useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  X,
  Paperclip,
  MailOpen,
  Globe,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildEmailsUrl } from '@/lib/utils/urls';
import { parseSearchQuery } from '@/lib/search/query-parser';
import { serializeSearchQuery } from '@/lib/search/serialize';

interface EmailSearchProps {
  initialQuery: string;
  accountId?: string;
  filter?: string;
  /** Display name of the account currently scoping the search, if any. */
  accountName?: string | null;
}

const OPERATOR_HINTS = [
  { operator: 'from:', example: 'from:alice@example.com' },
  { operator: 'to:', example: 'to:team' },
  { operator: 'subject:', example: 'subject:"quarterly report"' },
  { operator: 'body:', example: 'body:electrician' },
  { operator: 'has:', example: 'has:attachment' },
  { operator: 'is:', example: 'is:unread' },
  { operator: 'after:', example: 'after:2025-01-01' },
  { operator: 'before:', example: 'before:2025-06-30' },
];

export function EmailSearch({
  initialQuery,
  accountId,
  filter,
  accountName,
}: EmailSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);

  // The text box is the source of truth: the widgets read their state from the
  // parsed query and write changes back into the text.
  const parsed = useMemo(() => parseSearchQuery(query), [query]);

  const navigate = (search: string, scopedAccountId: string | undefined) => {
    router.push(
      buildEmailsUrl({
        page: 1,
        search,
        accountId: scopedAccountId,
        filter,
      })
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(query, accountId);
  };

  /** Applies a widget change and searches immediately. */
  const applyChange = (change: Partial<typeof parsed>) => {
    const next = serializeSearchQuery({ ...parsed, ...change });
    setQuery(next);
    navigate(next, accountId);
  };

  const toggleUnread = () => {
    applyChange({ isRead: parsed.isRead === false ? undefined : false });
  };

  const toggleAttachments = () => {
    applyChange({
      hasAttachment: parsed.hasAttachment === true ? undefined : true,
    });
  };

  const setDate = (key: 'after' | 'before', value: string) => {
    applyChange({ [key]: value ? new Date(value) : undefined });
  };

  const clearSearch = () => {
    setQuery('');
    navigate('', accountId);
  };

  const dateValue = (date: Date | undefined) =>
    date ? date.toISOString().slice(0, 10) : '';

  const hasActiveFilters =
    parsed.isRead !== undefined ||
    parsed.hasAttachment !== undefined ||
    parsed.after !== undefined ||
    parsed.before !== undefined;

  return (
    <div className='mb-6 space-y-3'>
      <form onSubmit={handleSubmit}>
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <Input
              type='text'
              placeholder='Search emails — try from:alice@example.com or body:invoice'
              value={query}
              onChange={e => setQuery(e.target.value)}
              className='pl-10 pr-10'
            />
            {query && (
              <button
                type='button'
                onClick={clearSearch}
                aria-label='Clear search'
                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => setShowFilters(current => !current)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className='h-4 w-4' />
            Filters
            {hasActiveFilters && (
              <span className='ml-1 h-2 w-2 rounded-full bg-primary' />
            )}
          </Button>
          <Button type='submit'>Search</Button>
        </div>
      </form>

      {/* Scope: which accounts this search covers, and how to widen it. */}
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span className='text-gray-500'>Searching:</span>
        {accountId ? (
          <>
            <Badge variant='secondary'>{accountName || 'This account'}</Badge>
            <button
              type='button'
              onClick={() => navigate(query, undefined)}
              className='inline-flex items-center gap-1 text-primary hover:underline'
            >
              <Globe className='h-3.5 w-3.5' />
              Search all accounts
            </button>
          </>
        ) : (
          <Badge variant='secondary'>All accounts</Badge>
        )}
      </div>

      {showFilters && (
        <div className='rounded-md border border-input bg-background p-4 space-y-4'>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              size='sm'
              variant={parsed.isRead === false ? 'default' : 'outline'}
              onClick={toggleUnread}
              aria-pressed={parsed.isRead === false}
            >
              <MailOpen className='h-4 w-4' />
              Unread only
            </Button>
            <Button
              type='button'
              size='sm'
              variant={parsed.hasAttachment === true ? 'default' : 'outline'}
              onClick={toggleAttachments}
              aria-pressed={parsed.hasAttachment === true}
            >
              <Paperclip className='h-4 w-4' />
              Has attachments
            </Button>
          </div>

          <div className='flex flex-wrap items-end gap-4'>
            <div className='space-y-1'>
              <label
                htmlFor='search-after'
                className='block text-xs font-medium text-gray-600'
              >
                After
              </label>
              <Input
                id='search-after'
                type='date'
                className='h-9 w-auto'
                value={dateValue(parsed.after)}
                onChange={e => setDate('after', e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <label
                htmlFor='search-before'
                className='block text-xs font-medium text-gray-600'
              >
                Before
              </label>
              <Input
                id='search-before'
                type='date'
                className='h-9 w-auto'
                value={dateValue(parsed.before)}
                onChange={e => setDate('before', e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className='text-xs font-medium text-gray-600 mb-2'>
              Search operators
            </p>
            <div className='flex flex-wrap gap-x-4 gap-y-1'>
              {OPERATOR_HINTS.map(hint => (
                <button
                  key={hint.operator}
                  type='button'
                  onClick={() =>
                    setQuery(current =>
                      current
                        ? `${current.trimEnd()} ${hint.operator}`
                        : hint.operator
                    )
                  }
                  className='text-xs text-gray-500 hover:text-gray-900'
                  title={hint.example}
                >
                  <code className='font-mono'>{hint.operator}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

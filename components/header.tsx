import Link from 'next/link';
import { Mail } from 'lucide-react';
import { UserNav } from '@/components/user-nav';
import { User } from 'next-auth';

interface HeaderProps {
  user?: User;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className='bg-white border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center py-4'>
          <Link href='/' className='flex items-center'>
            <Mail className='h-8 w-8 text-blue-600 mr-3' />
            <h1 className='text-2xl font-bold text-gray-900'>MailStash</h1>
          </Link>
          {user && <UserNav user={user} />}
        </div>
      </div>
    </header>
  );
}

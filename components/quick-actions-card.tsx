import Link from 'next/link';
import { Mail, Activity, Settings } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and navigation</CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Link href='/emails' className='block'>
          <Button variant='outline' className='w-full justify-start'>
            <Mail className='h-4 w-4 mr-2' />
            View All Emails
          </Button>
        </Link>
        <Link href='/jobs' className='block'>
          <Button variant='outline' className='w-full justify-start'>
            <Activity className='h-4 w-4 mr-2' />
            View Sync Jobs
          </Button>
        </Link>
        <Link href='/accounts' className='block'>
          <Button variant='outline' className='w-full justify-start'>
            <Settings className='h-4 w-4 mr-2' />
            Manage All Accounts
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

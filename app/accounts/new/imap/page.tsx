import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AccountCreationLayout } from '@/components/account-creation-layout';
import { ImapAccountForm } from './imap-account-form';

export default function ImapAccountPage() {
  return (
    <AccountCreationLayout
      title='Configure IMAP Account'
      description='Connect any email account that supports IMAP'
    >
      <Card>
        <CardHeader>
          <CardTitle>Configure IMAP Account</CardTitle>
          <CardDescription>
            Enter your email server details to connect your account
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <ImapAccountForm />

          <div className='p-4 bg-amber-50 border border-amber-200 rounded-lg'>
            <p className='text-sm text-amber-800'>
              <strong>Note:</strong> For Gmail accounts, you&apos;ll need to use
              an app-specific password. For other providers, ensure IMAP access
              is enabled in your email settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </AccountCreationLayout>
  );
}

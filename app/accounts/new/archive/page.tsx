import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AccountCreationLayout } from '@/components/account-creation-layout';
import { ArchiveAccountForm } from './archive-account-form';

export default function ArchiveAccountPage() {
  return (
    <AccountCreationLayout
      title='Import Email Archive'
      description='Upload an mbox file to import your archived emails'
    >
      <Card>
        <CardHeader>
          <CardTitle>Import Email Archive</CardTitle>
          <CardDescription>
            Upload an mbox file to import your emails
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <ArchiveAccountForm />

          <div className='p-4 bg-amber-50 border border-amber-200 rounded-lg'>
            <p className='text-sm text-amber-800'>
              <strong>Note:</strong> Archive accounts are for one-time import
              only. They won&apos;t sync with any email server. The import
              process may take several minutes depending on the file size.
            </p>
          </div>
        </CardContent>
      </Card>
    </AccountCreationLayout>
  );
}

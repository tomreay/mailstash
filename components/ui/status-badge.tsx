import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'sync' | 'job' | 'account';
  className?: string;
}

const statusStyles = {
  sync: {
    syncing: 'bg-blue-100 text-blue-800 border-blue-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    idle: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  job: {
    active: 'bg-blue-100 text-blue-800 border-blue-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  account: {
    active: 'bg-green-100 text-green-800 border-green-200',
    inactive: 'bg-gray-100 text-gray-800 border-gray-200',
    disabled: 'bg-gray-100 text-gray-800 border-gray-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
  },
};

const statusLabels = {
  sync: {
    syncing: 'Syncing',
    error: 'Error',
    idle: 'Idle',
    pending: 'Pending',
  },
  job: {
    active: 'Active',
    failed: 'Failed',
    pending: 'Pending',
    completed: 'Completed',
  },
  account: {
    active: 'Active',
    inactive: 'Inactive',
    disabled: 'Disabled',
  },
};

export function StatusBadge({ status, variant = 'sync', className }: StatusBadgeProps) {
  const styles = statusStyles[variant];
  const labels = statusLabels[variant];
  const style = styles[status as keyof typeof styles] || styles.default;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {label}
    </Badge>
  );
}
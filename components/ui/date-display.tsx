import { formatDistanceToNow } from 'date-fns';

interface DateDisplayProps {
  date: string | Date | null | undefined;
  format?: 'relative' | 'absolute' | 'full';
  className?: string;
  prefix?: string;
}

export function DateDisplay({ date, format = 'relative', className, prefix }: DateDisplayProps) {
  if (!date) return null;

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatDate = () => {
    switch (format) {
      case 'relative':
        return formatDistanceToNow(dateObj, { addSuffix: true });
      case 'absolute':
        return dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      case 'full':
        return dateObj.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      default:
        return dateObj.toLocaleString();
    }
  };

  return (
    <span className={className}>
      {prefix && `${prefix} `}
      {formatDate()}
    </span>
  );
}
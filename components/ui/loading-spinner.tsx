import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  fullScreen = false,
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinner = (
    <Loader2
      className={`animate-spin text-gray-400 ${sizeClasses[size]} ${className}`}
    />
  );

  if (fullScreen) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        {spinner}
      </div>
    );
  }

  return spinner;
}

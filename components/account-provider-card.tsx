import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ReactNode } from 'react';

interface AccountProviderCardProps {
  icon: ReactNode;
  iconBgColor: string;
  title: string;
  description: string;
  features: string[];
  onClick: () => void;
}

export function AccountProviderCard({
  icon,
  iconBgColor,
  title,
  description,
  features,
  onClick,
}: AccountProviderCardProps) {
  return (
    <Card
      className='cursor-pointer hover:shadow-lg transition-shadow'
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className='flex items-center gap-3'>
          <div className={`p-2 ${iconBgColor} rounded-lg`}>{icon}</div>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {features.map((feature, index) => (
          <p key={index} className='text-sm text-gray-600'>
            • {feature}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

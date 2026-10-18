import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { control, controlHeight } from '../styles';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, controlHeight, className)} {...props} />;
}

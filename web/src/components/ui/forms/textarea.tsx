import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { control } from '../styles';

export function Textarea({ className, rows = 6, ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} className={cn(control, 'resize-y py-2', className)} {...props} />;
}

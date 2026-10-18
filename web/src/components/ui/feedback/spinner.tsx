import { cn } from '@/lib/cn';

const SIZES = { sm: 'size-(--app-icon-sm)', md: 'size-(--app-icon-md)', lg: 'size-(--app-icon-2xl)' } as const;

export function Spinner({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-r-transparent opacity-70',
        SIZES[size],
        className,
      )}
    />
  );
}

import { formatDateTime } from '@/lib/format';
import { relativeTime } from '@/lib/time';

/** "3 minutes ago", with the exact local time in a tooltip and a machine-readable datetime. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} {...(className && { className })}>
      {relativeTime(iso)}
    </time>
  );
}

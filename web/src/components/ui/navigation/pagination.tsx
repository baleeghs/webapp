import { Button } from '../actions/button';

export interface PaginationProps {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Previous / next with a "21–40 of 95" summary. Renders nothing when everything fits on one page. */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <p className="text-compact-sm text-fg-muted tabular-nums">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button size="sm" icon="CHEVRON_LEFT" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}

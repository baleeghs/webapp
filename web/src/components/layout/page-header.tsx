import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary page actions, right-aligned (wraps under the title on narrow screens). */
  actions?: ReactNode;
}

/** The title block every page starts with. Also sets the document title. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="app-chrome-bar flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-6 pb-4">
      <title>{`${title} · App`}</title>
      <div className="min-w-0">
        <h1 className="text-display-sm text-fg">{title}</h1>
        {description && <p className="mt-1 text-compact-base text-fg-muted">{description}</p>}
      </div>
      {actions && (
        <div data-testid="page-actions" className="flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}

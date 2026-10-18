import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PageBody, PageHeader } from '@/components/layout';
import { Badge, Panel, Skeleton } from '@/components/ui';
import { notesListQuery } from '@/features/notes';
import { healthQuery } from '@/lib/api/health';
import { formatNumber } from '@/lib/format';

function ApiStatus() {
  const { data, isPending, isError } = useQuery(healthQuery);
  if (isPending) return <Skeleton className="h-4 w-32" />;
  if (isError) return <Badge tone="danger">Unreachable</Badge>;
  return (
    <div className="flex items-center gap-2">
      <Badge tone="success">Online</Badge>
      <span className="text-compact-sm text-fg-muted">v{data.version}</span>
    </div>
  );
}

function NotesCount() {
  const { data, isPending, isError } = useQuery(notesListQuery(1));
  if (isPending) return <Skeleton className="h-8 w-16" />;
  if (isError) return <span className="text-fg-muted">–</span>;
  return <span className="text-display-md tabular-nums">{formatNumber(data.total)}</span>;
}

export function HomePage() {
  return (
    <>
      <PageHeader title="Overview" description="A full-stack template: Rust (actix-web + tonic) and React." />
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Panel title="API">
            <ApiStatus />
          </Panel>
          <Panel
            title="Notes"
            actions={
              <Link to="/notes" className="text-compact-sm text-accent-text hover:underline">
                View all
              </Link>
            }
          >
            <NotesCount />
          </Panel>
          <Panel title="Next steps" className="sm:col-span-2 xl:col-span-1">
            <ul className="list-inside list-disc space-y-1 text-compact-base text-fg-muted">
              <li>Rename the app: README.md, “Renaming the template”.</li>
              <li>Add a feature: copy the notes feature on both sides.</li>
              <li>Conventions for people and AI: CLAUDE.md and docs/ai/.</li>
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

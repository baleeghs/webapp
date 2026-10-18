import { Link } from '@tanstack/react-router';
import { buttonVariants, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="app-chrome-bar py-10">
      <title>Not found · App</title>
      <EmptyState
        icon="CANCEL"
        title="Page not found"
        description="The page you are looking for does not exist or was moved."
        action={
          <Link to="/" className={buttonVariants({ variant: 'primary' })}>
            Go to overview
          </Link>
        }
      />
    </div>
  );
}

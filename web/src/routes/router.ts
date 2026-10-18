import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  stripSearchParams,
  type RouterHistory,
} from '@tanstack/react-router';
import { AppRoot } from '@/app/app-root';
import { RoutePending } from '@/app/route-pending';
import { RouteError } from '@/components/errors';
import { noteQuery, notesListQuery } from '@/features/notes';
import { NotFoundPage } from '@/pages/errors/not-found';
import { NOTES_SEARCH_DEFAULTS, validateNotesSearch } from './search';

/**
 * The route tree, in code. Each route: path, search schema, a loader that prefetches its queries
 * (so data loads in parallel with the page's code), and a lazily loaded page component, so every
 * page is its own chunk. To add a page: create it under pages/, add a route here, add it to
 * `routeTree`, and link it from the sidebar.
 */
export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppRoot,
  notFoundComponent: NotFoundPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/pages/home/home-page'), 'HomePage'),
});

const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes',
  validateSearch: validateNotesSearch,
  // Keep defaults out of the URL: /notes, not /notes?page=1.
  search: { middlewares: [stripSearchParams(NOTES_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(notesListQuery(deps.page)),
  component: lazyRouteComponent(() => import('@/pages/notes/notes-page'), 'NotesPage'),
});

const noteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes/$noteId',
  loader: ({ context, params }) => context.queryClient.ensureQueryData(noteQuery(params.noteId)),
  component: lazyRouteComponent(() => import('@/pages/notes/note-page'), 'NotePage'),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('@/pages/settings/settings-page'), 'SettingsPage'),
});

export const routeTree = rootRoute.addChildren([homeRoute, notesRoute, noteRoute, settingsRoute]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    ...(history && { history }),
    // Hovering a link starts loading its code and data. Query owns caching, so the router
    // always calls loaders and lets ensureQueryData decide.
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

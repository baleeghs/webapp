import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from './client';

/** Server liveness, polled for the status indicator in the top bar. */
export const healthQuery = queryOptions({
  queryKey: ['system', 'health'],
  queryFn: () => unwrap(api.GET('/healthz')),
  refetchInterval: 30_000,
  retry: false,
  staleTime: 15_000,
});

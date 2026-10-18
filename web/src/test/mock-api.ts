import type { Note } from '@/features/notes';
import type { ErrorBody } from '@/lib/api/types';

/**
 * An in-memory fake of the HTTP API for DOM tests, installed as `globalThis.fetch` by setup.ts.
 * It mirrors the server's contract (status codes, error envelope, camelCase JSON), which the Rust
 * tests in server/crates/app-http/tests pin down.
 *
 *   db.notes = [makeNote()]                                       // seed data
 *   server.use(route('GET', '/api/v1/notes', () => json(body, { status: 503 })))  // per-test override
 *
 * Any request no route handles is recorded and fails the test (see setup.ts), so a test can never
 * silently depend on a real network.
 */

// ── A tiny request router ────────────────────────────────────────────────────

export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
}

export interface Route {
  method: string;
  path: string;
  matches: (method: string, pathname: string) => Record<string, string> | null;
  handle: (ctx: RouteContext) => Response | Promise<Response>;
}

/** `route('GET', '/api/v1/notes/:id', ({ params }) => json(...))`. Matches the URL path exactly. */
export function route(method: string, path: string, handle: Route['handle']): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    })}$`,
  );
  return {
    method,
    path,
    handle,
    matches: (m, pathname) => {
      if (m !== method) return null;
      const match = pattern.exec(pathname);
      if (!match) return null;
      return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(match[i + 1] ?? '')]));
    },
  };
}

export const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...init.headers } });

export const noContent = () => new Response(null, { status: 204 });

const errorResponse = (status: number, code: string, message: string, details?: ErrorBody['error']['details']) =>
  json({ error: { code, message, ...(details && { details }) } } satisfies ErrorBody, { status });

// ── Fake data and the API's routes ───────────────────────────────────────────

export const db: { notes: Note[] } = { notes: [] };

const notFound = (id: string) => errorResponse(404, 'not_found', `note ${id} not found`);

function invalid(body: { title?: unknown }): Response | null {
  if (typeof body.title === 'string' && body.title.trim() === '') {
    return errorResponse(400, 'validation_failed', 'validation failed', [
      { field: 'title', message: 'must not be empty' },
    ]);
  }
  return null;
}

const defaultRoutes: Route[] = [
  route('GET', '/healthz', () => json({ status: 'ok', version: '0.1.0' })),

  route('GET', '/api/v1/notes', ({ url }) => {
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const sorted = [...db.notes].sort((a, b) => b.id.localeCompare(a.id));
    return json({ items: sorted.slice(offset, offset + limit), total: db.notes.length, limit, offset });
  }),

  route('GET', '/api/v1/notes/:id', ({ params }) => {
    const note = db.notes.find((n) => n.id === params['id']);
    return note ? json(note) : notFound(params['id'] ?? '');
  }),

  route('POST', '/api/v1/notes', async ({ request }) => {
    const body = (await request.json()) as { title: string; body?: string };
    const rejected = invalid(body);
    if (rejected) return rejected;
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      title: body.title.trim(),
      body: body.body ?? '',
      createdAt: now,
      updatedAt: now,
    };
    db.notes.push(note);
    return json(note, { status: 201 });
  }),

  route('PATCH', '/api/v1/notes/:id', async ({ params, request }) => {
    const note = db.notes.find((n) => n.id === params['id']);
    if (!note) return notFound(params['id'] ?? '');
    const body = (await request.json()) as { title?: string; body?: string };
    const rejected = invalid(body);
    if (rejected) return rejected;
    Object.assign(note, body, { updatedAt: new Date().toISOString() });
    return json(note);
  }),

  route('DELETE', '/api/v1/notes/:id', ({ params }) => {
    const before = db.notes.length;
    db.notes = db.notes.filter((n) => n.id !== params['id']);
    return db.notes.length === before ? notFound(params['id'] ?? '') : noContent();
  }),
];

// ── The fake server ──────────────────────────────────────────────────────────

let overrides: Route[] = [];
/** Requests no route handled since the last reset; setup.ts fails the test if any. */
export const unhandled: string[] = [];

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  for (const r of [...overrides, ...defaultRoutes]) {
    const params = r.matches(request.method, url.pathname);
    if (params) return r.handle({ request, url, params });
  }
  unhandled.push(`${request.method} ${url.pathname}${url.search}`);
  throw new TypeError(`mock-api: no route for ${request.method} ${url.pathname}`);
}

export const server = {
  /** Replaces `globalThis.fetch` for the test run. */
  install(): void {
    globalThis.fetch = mockFetch as typeof fetch;
  },
  /** Per-test handlers, checked before the defaults; cleared by `reset`. */
  use(...routes: Route[]): void {
    overrides = [...routes, ...overrides];
  },
  reset(): void {
    overrides = [];
    unhandled.length = 0;
    db.notes = [];
  },
};

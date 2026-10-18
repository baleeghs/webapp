# Architecture

A short overview for people. The detailed reference (every crate and module, startup and
shutdown, request pipelines, error model, web boot sequence, extension points) is
[docs/ai/ARCHITECTURE.md](../ai/ARCHITECTURE.md).

## Overview

```
                 ┌──────────────── browser ────────────────┐
                 │ React app (web/)                        │
                 │ pages → features → components / lib     │
                 │ TanStack Query cache · openapi-fetch    │
                 └───────────────┬─────────────────────────┘
                                 │ HTTP/JSON  /api/v1/*      (same origin)
┌────────────────────────────────┼──────────────────── app-server (one binary) ───┐
│  app-http (actix-web)          │            app-grpc (tonic)  ◄── gRPC clients  │
│  modules/<feature>/handlers ───┴───┐   ┌─── services/<feature>                  │
│                                    ▼   ▼                                        │
│                         app-core  (domain: services, models, rules, ports)      │
│                                    │   ▲ implements                             │
│                     app-cache ─────┘   │                                        │
│                     (decorator) ──► app-db (sqlx) ──► Postgres                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

One process serves HTTP (`:8080`) and gRPC (`:50052`), and in production also the built web app
from `server/static` (built by `pnpm build`). Both transports call the **same** service instances, so behaviour is identical
whichever protocol a client uses.

## Server crates

| Crate | Role | May depend on |
| --- | --- | --- |
| `app-core` | Domain models, validation, services, repository and health-check traits | nothing app-specific |
| `app-common` | Configuration (`APP_*` env), tracing setup | – |
| `app-db` | Postgres repositories, pool, embedded migrations | core, common |
| `app-cache` | `TtlCache` and caching repository decorators | core, common |
| `app-proto` | Code generated from `server/proto` | – |
| `app-http` | actix-web routes, DTOs, error mapping, middleware, OpenAPI, SPA serving | core, common |
| `app-grpc` | tonic services, error mapping, health and reflection | core, common, proto |
| `app-server` | Composition root: builds everything, runs both servers, handles shutdown | all |

The rule that makes this hold up as the app grows: **dependencies point inward.** `app-core`
defines traits (ports) such as `NoteRepository`; `app-db` implements them; `app-server` plugs the
implementation in. The domain can be tested with in-memory adapters (feature `memory`), and
storage can change without touching business logic.

## A request, end to end

`PATCH /api/v1/notes/{id}`:

1. **Middleware** (`app-http/src/server.rs`): tracing span with a request id → `x-request-id`
   header, metrics, CORS (if configured), security headers, compression.
2. **Extractors** parse the path (`Uuid`) and JSON body (`UpdateNoteRequest`). Malformed input
   becomes a `400 validation_failed` envelope before any handler runs.
3. **Handler** (`modules/notes/handlers.rs`) converts the DTO to `NoteChanges` and calls
   `NoteService::update`.
4. **Service** (`app-core`) validates, then calls the repository.
5. **Repository chain**: `CachedNoteRepository` (evicts the cached note) → `PgNoteRepository`
   (one `UPDATE … RETURNING`). sqlx errors map to `CoreError` at this boundary.
6. The handler maps `Note` → `NoteDto` (camelCase JSON); a `CoreError` maps to status + envelope
   in `error.rs`.
7. **Web**: `useUpdateNote` updates the detail cache and invalidates note lists; the page
   re-renders from the cache.

## Contract between server and web

```
Rust annotations ──make gen-api──► server/openapi.yaml ──pnpm gen:api──► web/src/lib/api/schema.gen.ts
        ▲ test fails if stale                                  ▲ `pnpm check:api` fails if stale
```

Both generated files are committed and both checks run in CI, so the client can never silently
drift from the server. The web app calls the API only through the typed `api` client.

## Web app

- **Routing** (`src/routes/router.ts`): code-based TanStack Router. Each route validates its
  search params, prefetches its queries in a loader and lazily loads its page component.
- **Data**: TanStack Query owns all server state. Query options live with the feature
  (`features/notes/api/queries.ts`) and are shared by loaders and components.
- **Errors**: loader and render errors go to the route's error component (retry built in);
  failed mutations show a toast unless the form displays them.
- **Styling**: Tailwind v4 with design tokens in CSS; three palettes × light/dark × two densities,
  switched with attributes on `<html>`.

## Operational behaviour

- **Health**: `/healthz` (liveness), `/readyz` (runs every `HealthCheck`, 503 if any fails),
  gRPC `grpc.health.v1`.
- **Metrics**: `/metrics` in Prometheus format: `http_requests_total`,
  `http_request_duration_seconds`, labelled by route pattern.
- **Logs**: structured `tracing`; JSON in production (`APP_LOG__FORMAT=json`).
- **Shutdown**: SIGTERM/Ctrl-C stops both servers gracefully (in-flight requests finish, 30 s
  cap), then closes the pool. A server that fails also stops the other.
- **Storage selection** (`app-server/src/app.rs`): no `DATABASE_URL` → in-memory repositories
  (development only; production refuses to start). With a URL, the pool connects lazily: the
  server starts even while Postgres is down, `/readyz` returns 503 and data requests return
  `503 unavailable` until it is reachable, then it recovers without a restart.
- **Migrations**: applied at startup by default (a failure is fatal in production, a warning in
  development); for multi-replica deploys run
  `app-server migrate` as a release step and set `APP_DATABASE__RUN_MIGRATIONS=false`.

## Decisions

| Decision | Why |
| --- | --- |
| Layered crates instead of one crate | Compile-time enforcement of dependency direction; faster incremental builds |
| `async-trait` + `Arc<dyn Trait>` ports | Swappable adapters (Postgres, cache, in-memory) without generics leaking everywhere |
| sqlx runtime queries (`query_as` + `FromRow`) | Builds without a database; integration tests cover the SQL |
| UUIDv7 ids generated by the app | Sortable by creation time, no round trip to learn the id |
| Offset pagination | Simple and adequate for admin-style lists; switch to keyset for large, hot tables |
| utoipa (code-first OpenAPI) | The spec cannot drift from handlers; the web types come from it |
| protox | gRPC codegen with no `protoc` install, in CI or locally |
| Native `<dialog>` | Browser-provided focus trap, top layer and Escape handling |
| Mocked API in E2E | Fast, deterministic browser tests; the Rust tests own the API contract |

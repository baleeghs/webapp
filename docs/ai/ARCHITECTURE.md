# Architecture reference

The detailed technical map of the system: every crate and module, how a process starts and stops,
how a request flows, how the web app boots and fetches data, where to extend it, and why it is
built this way. For a shorter human-facing overview see
[architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

---

## 1. System overview

```
 Browser ─────────────────────────────────────────────────────────────────────────────┐
 │  index.html → theme-init.js (appearance before paint) → main.tsx                   │
 │  AppProviders (QueryClient, appearance sync, toasts) → RouterProvider               │
 │  routes/router.ts: loaders prefetch queries ⇢ lazy page chunks                      │
 │  features/<x>/api: queryOptions + mutations ⇢ lib/api/client (openapi-fetch, typed) │
 └──────────────┬──────────────────────────────────────────────────────────────────────┘
                │ same origin: /api/v1/*, /healthz, /readyz (Vite proxy in dev)
 ┌──────────────▼───────────────────────── app-server (single binary) ─────────────────┐
 │ CLI (clap) → config (defaults ← APP_* env ← flags) → telemetry → metrics recorder    │
 │ open_storage: Postgres (lazy pool + migrations) │ in-memory                         │
 │ Services { notes: Arc<NoteService> }   ← built once, shared by both transports       │
 │ ┌──────── app-http (actix-web :8080) ────────┐  ┌──── app-grpc (tonic :50052) ────┐  │
 │ │ TracingLogger → request_id → metrics → CORS │  │ trace span per call             │  │
 │ │ → cache headers → security headers → gzip   │  │ grpc.health.v1 · reflection    │  │
 │ │ /healthz /readyz /metrics /api/openapi.json │  │ app.v1.NoteService              │  │
 │ │ /api/v1/<feature>/…   SPA fallback (prod)   │  └───────────────┬─────────────────┘  │
 │ └──────────────────────┬──────────────────────┘                  │                    │
 │                        ▼                                         ▼                    │
 │                app-core services (validation, rules) → repository traits             │
 │                        │                                                            │
 │        CachedNoteRepository (moka) → PgNoteRepository (sqlx) ─────► PostgreSQL       │
 └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server crates in detail

### 2.1 `app-core`: the domain

No I/O, no framework types. Everything else depends on it; it depends on nothing in the app.

| File | Contents |
| --- | --- |
| `error.rs` | `CoreError { NotFound, Validation(Vec<FieldError>), Conflict, Unavailable, Internal }`, `CoreResult<T>`, `code()` (stable API code), `public_message()` (hides `Internal` details) |
| `pagination.rs` | `PageRequest::new(limit, offset)` (limit clamped 1..=100, default 20), `Page<T>` with `map` |
| `health.rs` | `HealthCheck` trait (`name`, `check`), `ComponentStatus`, `run_checks` |
| `notes/model.rs` | `Note`, `NewNote`, `NoteChanges`, `validate()` (trims, length limits, collects every field error) |
| `notes/repository.rs` | `NoteRepository` trait: `list`, `get`, `insert`, `update`, `delete` |
| `notes/service.rs` | `NoteService`: ids (UUIDv7) and timestamps assigned here, validation, `NotFound` mapping, tracing |
| `notes/memory.rs` | `InMemoryNoteRepository` (feature `memory`), for tests and database-less runs |

### 2.2 `app-common`: configuration and telemetry

- `config.rs`: `AppConfig { env, http, grpc, database, cache, log }`. Loading: `figment` merges
  `Serialized::defaults` ← `Env::prefixed("APP_").split("__")` ← `DATABASE_URL`. `validate()`
  enforces cross-field rules (pool sizes, distinct ports, production requires a database and
  forbids `*` CORS). `DatabaseConfig` redacts its URL in `Debug`.
- `telemetry.rs`: `init(&LogConfig)`: `EnvFilter` (`RUST_LOG` overrides `APP_LOG__FILTER`),
  pretty or JSON output.

Defaults:

| Setting | Default | Variable |
| --- | --- | --- |
| Environment | `development` | `APP_ENV` |
| HTTP host / port | `0.0.0.0` / `8080` | `APP_HTTP__HOST` / `APP_HTTP__PORT` / `--http-port` |
| CORS origins | none (same origin) | `APP_HTTP__CORS_ORIGINS='["https://…"]'` |
| Web build served at `/` | `static` (relative to the working directory; used only if it has `index.html`; empty disables) | `APP_HTTP__STATIC_DIR` |
| JSON body limit | 1 MiB | `APP_HTTP__JSON_LIMIT_BYTES` |
| Workers | CPU count | `APP_HTTP__WORKERS` |
| gRPC enabled / port / reflection | `true` / `50052` / `true` | `APP_GRPC__*` / `--grpc-port` |
| Database URL | empty (in-memory) | `DATABASE_URL` or `APP_DATABASE__URL` |
| Pool max / min / acquire timeout | 10 / 1 / 5 s | `APP_DATABASE__*` |
| Migrations at startup | `true` | `APP_DATABASE__RUN_MIGRATIONS` |
| Cache TTL / capacity | 60 s / 10 000 | `APP_CACHE__*` |
| Log filter / format | `info,sqlx=warn` / `pretty` | `APP_LOG__FILTER` / `APP_LOG__FORMAT` |

### 2.3 `app-db`: Postgres

- `pool.rs`: `connect` (eager, used by `migrate`), `connect_lazy` (used by `serve`), `migrate`.
- `MIGRATOR`: `sqlx::migrate!("../../migrations")`, embedded at compile time.
- `notes.rs`: `PgNoteRepository`. Runtime-checked `query_as` into a private `NoteRow: FromRow`,
  converted to `Note`. Column lists via `const_format::concatcp!`. One statement per operation
  (`UPDATE … COALESCE … RETURNING`).
- `error.rs`: `map_err`: pool timeouts / IO → `Unavailable`; unique violations → `Conflict`;
  everything else → `Internal` (logged).
- `health.rs`: `PgHealthCheck` runs `SELECT 1`.
- `tests/notes_repository.rs`: `#[sqlx::test(migrator = "app_db::MIGRATOR")]`, ignored unless
  run with `--ignored` (`make test-db`, and CI with `--include-ignored`).

### 2.4 `app-cache`

- `TtlCache<K, V>`: typed wrapper over `moka::future::Cache` (capacity + time-to-live).
- `CachedNoteRepository<R>`: decorator implementing `NoteRepository`. Read-through for `get`;
  `update`/`delete` evict after the write; lists are not cached. Swap for a shared cache (Redis)
  behind the same trait when several replicas need consistent reads.

### 2.5 `app-proto`

`build.rs` compiles `server/proto/**` with **protox** (pure Rust; no `protoc`), writes the encoded
descriptor set for reflection, and runs `tonic_prost_build` for messages, server and client.
`lib.rs` exposes `app::v1` and `FILE_DESCRIPTOR_SET`. Generated code is lint-exempt.

### 2.6 `app-http`

| File | Role |
| --- | --- |
| `server.rs` | `routes(state)`: every route + extractor config (tests mount this). `build_server`: middleware stack, workers, bind, `disable_signals`, 30 s shutdown timeout |
| `state.rs` | `AppState { notes, health_checks, metrics, json_limit_bytes }` (shared via `web::Data`) |
| `error.rs` | `ApiError(CoreError)` → status + `ErrorBody` envelope; extractor error handlers for JSON, query and path |
| `middleware.rs` | `request_id` (echo `x-request-id`), `metrics` (counter + histogram by route pattern), `static_cache_headers` |
| `modules/health` | `/healthz`, `/readyz`, `/metrics` |
| `modules/notes` | `mod.rs` routes, `handlers.rs` (`#[utoipa::path]`), `dto.rs` |
| `openapi.rs` | `ApiDoc` (`#[derive(OpenApi)]`), `spec()`, `spec_yaml()` |
| `spa.rs` | `actix-files` with `index.html` fallback for client-side routes |
| `tests/api.rs`, `tests/openapi.rs` | HTTP contract tests; committed-spec staleness test |

Route table:

| Method + path | Handler | Notes |
| --- | --- | --- |
| `GET /healthz` | liveness | always 200 + version |
| `GET /readyz` | readiness | 200 or 503 with failing components |
| `GET /metrics` | Prometheus text | 404 when metrics disabled |
| `GET /api/openapi.json` | live spec | |
| `GET /api/v1/notes?limit&offset` | list | `NotePage` |
| `POST /api/v1/notes` | create | 201 + `Location` |
| `GET /api/v1/notes/{id}` | get | |
| `PATCH /api/v1/notes/{id}` | update | omitted fields unchanged |
| `DELETE /api/v1/notes/{id}` | delete | 204 |
| any other `/api/*` | `api_not_found` | JSON 404 (every scope sets it) |
| anything else (prod) | SPA | file or `index.html` |

### 2.7 `app-grpc`

`serve(config, state, shutdown)` registers `grpc.health.v1` (NoteService marked serving),
optional reflection v1, and `NoteServiceServer`. `error::status` maps `CoreError` → `tonic::Status`
(exhaustive); `parse_id` validates UUIDs as `INVALID_ARGUMENT`. Each call gets a tracing span
named after the method path.

### 2.8 `app-server`

| File | Role |
| --- | --- |
| `main.rs` | loads `.env` (dotenvy), parses CLI, dispatches `serve` / `migrate` / `openapi` |
| `cli.rs` | `Cli`, `Command`, `ConfigOverrides` (`--http-port`, `--grpc-port`, global flags) layered onto figment |
| `app.rs` | `load_config`, `install_metrics`, `Storage` (Postgres / Memory), `open_storage`, `Services`, `serve`, `run`, the full-stack test |
| `shutdown.rs` | `Shutdown` (idempotent trigger: watch channel + actix handle), `signal()` (Ctrl-C, SIGTERM) |

---

## 3. Process lifecycle

### 3.1 Startup (`app-server serve`)

1. `dotenvy` loads `.env` if present (searched from the working directory upwards).
2. clap parses arguments; unknown flags or invalid ports exit with usage help.
3. Config: defaults ← env ← CLI flags, then `validate()`. Errors exit before anything starts.
4. Tracing subscriber installed (pretty or JSON).
5. Prometheus recorder installed with latency buckets for `*_duration_seconds`.
6. **Storage selection** (`open_storage`):
   - no database URL → in-memory repositories, warning logged (refused in production by config validation);
   - URL set → `connect_lazy` (no network yet); if `run_migrations`, try to migrate:
     failure is **fatal in production**, a **warning in development** (server keeps serving, `/readyz` reports it).
7. `Services` built: `NoteService` over `CachedNoteRepository<PgNoteRepository>` (or in-memory).
8. HTTP server built and bound (port errors name the address and the flag to change).
9. Signal task spawned; HTTP and gRPC futures joined.

### 3.2 Shutdown

- Ctrl-C or SIGTERM → `Shutdown::trigger`: sets the watch channel (gRPC `serve_with_shutdown`
  resolves) and calls `ServerHandle::stop(true)` (actix stops accepting, drains in-flight
  requests up to 30 s).
- If either server **fails** (bind error, transport error), its task triggers the same shutdown,
  so the process never runs half-alive. The first error is returned and the exit code is non-zero.
- The pool is closed after both servers stop.

### 3.3 Other commands

- `app-server migrate`: eager connect (fails fast), apply migrations, exit. Use as a release step
  for multi-replica deploys with `APP_DATABASE__RUN_MIGRATIONS=false`.
- `app-server openapi`: prints the spec YAML (used by `make gen-api`).

---

## 4. Request pipelines

### 4.1 HTTP

```
TCP ─► TracingLogger (span + RequestId) ─► request_id (sets x-request-id on the way out)
    ─► metrics (route pattern, method, status, duration) ─► CORS (only if origins configured)
    ─► static cache headers (only if serving the SPA) ─► security headers ─► gzip/brotli
    ─► router ─► extractors (Path / Query / Json with JSON-envelope error handlers)
    ─► handler ─► service ─► repository chain ─► Result
    ─► Ok: DTO → JSON   |   Err(ApiError) → status + ErrorBody (Internal logged, details hidden)
```

Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`. A Content-Security-Policy is app-specific:
add it in `build_server` once you know your sources.

### 4.2 gRPC

```
HTTP/2 ─► trace span "grpc" (method) ─► NoteServiceServer ─► GrpcNoteService
       ─► parse ids / map request ─► the same NoteService ─► Status via error::status
```

### 4.3 Error model end to end

| Origin | Domain | HTTP | gRPC | Web (`ApiError`) |
| --- | --- | --- | --- | --- |
| Bad JSON / unknown field / bad UUID / bad query | – | 400 `validation_failed` (`details[].field` = body/query/path) | `INVALID_ARGUMENT` | `code === 'validation_failed'` |
| `validate()` failure | `Validation` | 400 + field details | `INVALID_ARGUMENT` "field: msg; …" | `fieldErrors()` shown under fields |
| Missing row | `NotFound` | 404 `not_found` | `NOT_FOUND` | route error component |
| Unique violation | `Conflict` | 409 `conflict` | `ALREADY_EXISTS` | toast / form message |
| Pool timeout, IO | `Unavailable` | 503 `unavailable` | `UNAVAILABLE` | retried twice with backoff, then shown |
| Anything else | `Internal` | 500 `internal` (generic message) | `INTERNAL` | shown with request id |
| Network failure | – | – | – | `status 0`, `network_error`, retried |

---

## 5. Contracts between the halves

```
Rust handlers + DTOs ──(utoipa)──► make gen-api ──► server/openapi.yaml ──(openapi-typescript)──► web/src/lib/api/schema.gen.ts
        ▲ cargo test fails if the YAML is stale                         ▲ pnpm check:api fails if the TS is stale
```

- The web app calls the API only through `api` (openapi-fetch, typed by `paths`) and reads types
  via `Schema<'Name'>`. A renamed field is a compile error in every consumer.
- The fake API in `web/src/test/mock-api.ts` and the E2E mock in `web/e2e/app.ts` mirror the
  contract the Rust tests pin down in `app-http/tests/api.rs`. Keep the three consistent.
- gRPC clients use `server/proto` directly; reflection exposes it in development.

---

## 6. Web application

### 6.1 Boot sequence

1. `index.html` loads `public/theme-init.js` synchronously: reads `localStorage['app.ui']` and
   sets `data-theme`, `data-palette`, `data-density` on `<html>` before first paint.
2. `main.tsx`: `installPreloadRecovery()` (reload once if a lazy chunk from an old deploy is
   gone), `createQueryClient()`, `createAppRouter(queryClient)`, render
   `<AppProviders><RouterProvider/></AppProviders>` inside `StrictMode`.
3. `AppProviders`: `QueryClientProvider`, `AppearanceSync` (keeps `<html>` attributes in sync with
   the store and the OS colour scheme), `Toaster`.
4. Root route component `AppRoot`: `NavigationProgress` + `AppShell` (sidebar, top bar, `<main>`)
   + `<Outlet/>`.

### 6.2 Navigation and data

```
<Link to="/notes" search={{ page: 2 }}>  (hover → preload: code + loader)
      │
      ▼
router: validateSearch (in-house validator: defaults, bad input falls back) → stripSearchParams
      │
      ▼
loader: queryClient.ensureQueryData(notesListQuery(page))   ← data and page chunk load in parallel
      │                                   (pending UI only after the router's threshold)
      ▼
NotesPage: useSuspenseQuery(notesListQuery(page))           ← same key, already cached
      │
      ▼
errors (loader or render) → RouteError: reset query errors, "Try again" = router.invalidate()
```

Query defaults: `staleTime` 30 s; retries only for retryable `ApiError`s (network, 408, 429,
5xx except 501), at most twice, exponential backoff with jitter capped at 10 s; mutations never
retry. A failed mutation toasts unless `meta: { toastOnError: false }`.

### 6.3 State

| State | Owner | Persistence |
| --- | --- | --- |
| Server data | TanStack Query cache | memory (refetched) |
| URL state | router search params | URL |
| Theme, palette, density, sidebar collapse | `useUiStore` (Zustand + persist) | `localStorage['app.ui']` |
| Mobile drawer open | `useUiStore` | not persisted |
| Toasts | `useToastStore` | memory |
| Form inputs, dialog open | component `useState` | none |

### 6.4 Styling pipeline

`styles/main.css` imports, in order: Tailwind → fonts → tokens → themes → generated palettes →
base → component layers → print. Tokens (`@theme`, `@theme inline`) map semantic Tailwind
utilities to `--app-*` variables; themes and palettes set those variables per
`[data-palette][data-theme]`; density tokens per `[data-density]`. Any element can re-scope a
palette or theme by carrying the attributes (the palette previews do). Details: [DESIGN.md](DESIGN.md).

### 6.5 Build output and serving

`pnpm build` writes to **`server/static/`** (`vite.config.ts` `outDir`, `emptyOutDir`). The Rust
server serves that folder at `/` by default (`APP_HTTP__STATIC_DIR`, default `static` relative to
its working directory): files as-is, any other non-API GET falls back to `index.html` for
client-side routes, and `/api/*` misses stay JSON 404s because API scopes are registered first. If
the folder has no `index.html` the server runs API-only and logs a hint.

| Mode | Browser opens | UI from | API |
| --- | --- | --- | --- |
| `make dev` | :5173 | Vite dev server (HMR) | Vite proxies `/api`, `/healthz`, `/readyz` to `API_TARGET` (:8080) |
| `make start` / Docker | :8080 | Rust server, `server/static` | same server, `/api/v1/*` |

Vite 8 (rolldown) with code splitting groups: `react` (react, react-dom, scheduler), `vendor`
(other node_modules), `index` (app shell), one chunk per page. Hashed assets are served with
`immutable` caching; `index.html` with `no-cache`. CI enforces gzip budgets
(`.github/scripts/bundle-report.mts`: 100 kB per chunk, 250 kB total JS, 40 kB CSS).

---

## 7. Testing architecture

| Level | Tool | Where | Needs |
| --- | --- | --- | --- |
| Domain unit | cargo test + in-memory repo | `app-core/src/**` | nothing |
| Config | `figment::Jail` | `app-common/src/config.rs` | nothing |
| CLI | clap `try_parse_from` | `app-server/src/cli.rs` | nothing |
| HTTP contract | `actix_web::test` on `routes(state)` | `app-http/tests/api.rs` | nothing |
| SPA serving | temp dir + `spa::configure` | `app-http/src/spa.rs` | nothing |
| OpenAPI staleness | compare with committed YAML | `app-http/tests/openapi.rs` | nothing |
| gRPC mapping | call service impl | `app-grpc/src/notes.rs` | nothing |
| Whole binary | boot HTTP + gRPC on free ports, call both, shut down | `app-server/src/app.rs` | nothing |
| SQL | `#[sqlx::test]` (fresh DB per test) | `app-db/tests/` | Postgres |
| Web logic | Vitest (node) | `src/**/*.test.ts` | nothing |
| Web components / pages | Vitest (happy-dom) + Testing Library + in-house fake API, `renderApp` | `src/**/*.dom.test.tsx` | nothing |
| Style guards | Vitest (node) reading CSS | `src/styles/*.test.ts` | nothing |
| Browser flows + layout | Playwright Chromium, mocked API | `web/e2e/` | Chromium |

CI (`.github/workflows/ci.yml`): server (fmt, clippy, tests including Postgres via a service
container), web (format, types, lint, API + palette contract, coverage, build, bundle budget),
e2e, repository hygiene (conflict markers, `.only`, tracked `.env`, files > 1 MiB, migration
pairs, doc links), Docker image build.

---

## 8. Deployment

- **Image** (`Dockerfile`): Node 24 builds the UI into `server/static`; `rust:1-slim-bookworm`
  builds `app-server --release --locked`; runtime is `gcr.io/distroless/cc-debian12:nonroot` with
  the binary and `/app/static` (served at `/` by default from `WORKDIR /app`), `APP_ENV=production`,
  JSON logs, reflection off. Ports 8080
  and 50052.
- **Probes**: liveness `/healthz`, readiness `/readyz`, metrics `/metrics`; gRPC health for
  gRPC-aware load balancers.
- **Migrations**: either at startup (single replica) or `app-server migrate` as a release job.
- **Config**: environment variables only; `DATABASE_URL` is required in production.
- **Local full stack**: `docker compose --profile app up --build`.

---

## 9. Extension points

| You want | Extend |
| --- | --- |
| A new domain feature | `app-core/src/<x>/` + adapters + `modules/<x>/` + `features/<x>/` ([ADDING-A-FEATURE.md](ADDING-A-FEATURE.md)) |
| A different store for a feature | a new type implementing the repository trait; choose it in `Storage::services` |
| A shared cache | a Redis-backed decorator with the same trait as `CachedNoteRepository` |
| An external API | a new adapter crate implementing an `app-core` trait; wire it in `app-server` |
| A readiness dependency | implement `HealthCheck`; add it in `Storage::health_checks` |
| Middleware | `app-http/src/middleware.rs` (`from_fn`) + one `.wrap` in `build_server` (order matters) |
| Authentication | a middleware/extractor in `app-http` producing an identity; authorisation rules in `app-core` services |
| A CLI command | `Command` in `cli.rs` + a function in `app.rs` |
| A CLI-overridable setting | `ConfigOverrides` in `cli.rs` |
| A web page | [docs/ai/CLAUDE.md](CLAUDE.md) §3.5 |
| A palette / icon / font | `web/gen/palettes.mts` / `icons.mts` / `fonts.mts` |

---

## 10. Decision records

| Decision | Alternatives considered | Why |
| --- | --- | --- |
| Layered crates with inward dependencies | single crate with modules | the compiler enforces boundaries; faster incremental builds |
| `async-trait` + `Arc<dyn Trait>` ports | generics everywhere | adapters swap at runtime (Postgres / memory / cached) without generic noise |
| sqlx runtime queries + `FromRow` | `query!` macros, ORM | builds without a database; SQL stays explicit; Postgres tests cover it |
| UUIDv7 ids generated by the app | serial ids, DB-generated UUIDs | sortable by time, known before insert, no enumeration |
| Offset pagination | keyset | simplest correct default; switch per endpoint when tables grow hot |
| Code-first OpenAPI (utoipa) | hand-written spec | the spec cannot drift from handlers; client types derive from it |
| protox | `protoc` | no system dependency in dev, CI or Docker |
| HTTP + gRPC in one process | separate binaries | one deployment, shared services, coordinated shutdown |
| In-memory storage without `DATABASE_URL` | require Postgres | zero-setup template; production still requires a database |
| Lazy pool, non-fatal DB at startup (dev) | fail fast | the server survives DB restarts and reports readiness honestly |
| gRPC default port 50052 | 50051 | 50051 is frequently taken by Multipass on developer Macs |
| TanStack Router (code-based) + Query | React Router, SWR | typed routes and search params, loaders that share the Query cache |
| In-house search-param validators | zod, valibot | a few typed helpers cover list pages; no library in the bundle |
| In-house `cn()` and `variants()` | clsx, tailwind-merge, class-variance-authority | ~40 lines replace three packages; components avoid class conflicts by design |
| Few, high-value dependencies, exact pins | small utility packages, semver ranges | less supply-chain risk and churn; upgrades are explicit, reviewed changes |
| Native `<dialog>` | portal + focus-trap library | the browser provides focus trap, top layer, Escape, inert background |
| Tailwind v4 + CSS tokens + data attributes | CSS-in-JS, theme context | zero runtime cost; any subtree can re-scope palette or theme |
| Generated palettes with contrast checks | hand-picked hex values | consistent system, accessible by construction, one line per palette |
| oxlint + prettier | ESLint | an order of magnitude faster; covers React, a11y, imports |
| In-house fetch mock in DOM tests, route mocks in E2E | MSW, real backend | deterministic and fast without another dependency; Rust tests own the API contract |

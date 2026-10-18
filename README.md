# Full-stack web app template

A production-ready starting point for web apps: a **Rust** server (actix-web HTTP API + tonic
gRPC, Postgres via sqlx) and a **React + TypeScript** web app (Vite, TanStack Router and Query,
Tailwind CSS v4). One example feature, **notes**, runs through every layer, from migration and
gRPC to page, so new features are built by copying a working pattern.

| | |
| --- | --- |
| Server | Rust 2024 · actix-web 4 · tonic 0.14 · sqlx 0.9 (Postgres) · utoipa (OpenAPI) · tracing · Prometheus metrics |
| Web | React 19 · TypeScript 6 · Vite 8 · TanStack Router + Query · Zustand · Tailwind 4 · openapi-fetch |
| Tests | cargo test (unit, HTTP, gRPC, full server, Postgres) · Vitest + Testing Library (happy-dom, in-house fake API) · Playwright |
| Ops | Makefile · Docker (distroless) · Compose · GitHub Actions · Dependabot |

## Quick start

Prerequisites: Rust (stable) and Node 24 with pnpm. No `protoc` and no database needed to start.

```sh
make setup   # install dependencies, create .env
make dev     # development: server (:8080 HTTP, :50052 gRPC) + Vite with hot reload (:5173)
make start   # production-like: build the UI into server/static, run the server, all on :8080
```

**One origin in every mode.** The API lives at `/api/v1/<endpoint>`.

| Mode | Open | UI served by | `/api` |
| --- | --- | --- | --- |
| `make dev` | http://localhost:5173 | Vite (hot reload) | proxied by Vite to the server on :8080 |
| `make start`, Docker, production | http://localhost:8080 | the Rust server at `/` (from `server/static`) | the same server |

`pnpm build` (`make build-web`) writes the UI to `server/static/`, which the server serves at `/`
by default, with deep links (`/notes/123`) falling back to `index.html`. Without a build the
server runs API-only and says so in its log.

Ports: `cargo run -p app-server -- --http-port=8443 --grpc-port=50051` (in `server/`), or
`APP_HTTP__PORT` / `APP_GRPC__PORT` in `.env`; flags win. If you change the HTTP port, start the
web app with `API_TARGET=http://localhost:8443 pnpm dev` so its proxy follows.

Without `DATABASE_URL` the server keeps data **in memory** (lost on restart), so the template
runs with zero setup. For Postgres: `make db-up` (Docker), uncomment `DATABASE_URL` in `.env`,
restart. [sqlx-cli](https://github.com/launchbadge/sqlx/tree/main/sqlx-cli) is needed only to
create migrations. If Postgres is configured but down, the server still starts: `/readyz` reports
it and API calls return `503` until it is back. Production requires `DATABASE_URL`.

`make` lists every task; the common ones:

| Task | Command |
| --- | --- |
| Everything CI checks | `make check` |
| Format / lint | `make fmt` / `make lint` |
| Tests (no database needed) | `make test` |
| Postgres integration tests | `make db-up && make test-db` |
| Browser tests | `make e2e` |
| New migration | `make migration name=add_users` |
| Regenerate API types after changing an endpoint | `make gen-api` |
| Production image | `make docker` |

## Layout

```
server/                 Rust workspace
  crates/app-core       domain: models, rules, services, repository traits (no I/O)
  crates/app-common     config (env) and telemetry
  crates/app-db         Postgres repositories and migrations runner
  crates/app-cache      in-process cache and caching repository decorators
  crates/app-proto      code generated from proto/ (gRPC)
  crates/app-http       actix-web: modules/<feature>/, middleware, OpenAPI, SPA serving
  crates/app-grpc       tonic services
  crates/app-server     the binary: wiring, CLI (serve | migrate | openapi), shutdown
  migrations/           sqlx migrations (up/down pairs)
  proto/                protobuf definitions
  openapi.yaml          generated HTTP contract (committed, checked in CI)
web/                    React app
  src/app               providers, query client, root layout
  src/routes            route tree and search-param schemas
  src/pages             one folder per page (thin: compose features)
  src/features          feature modules: api/ components/ lib/ index.ts
  src/components        shared UI: ui/ (design system), layout/, icons/, errors/, brand/
  src/lib               framework-free helpers and the typed API client
  src/styles            tokens, themes, base and component CSS
  e2e/                  Playwright tests
docs/                   architecture, API, database and contributor guides
```

[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) explains how the pieces
fit; [docs/ai/ADDING-A-FEATURE.md](docs/ai/ADDING-A-FEATURE.md) is the step-by-step recipe.

## Renaming the template

1. Product name: `APP_NAME` in `web/src/components/brand/logo.tsx`, `<title>` in `web/index.html`,
   the `· App` suffix in `web/src/components/layout/page-header.tsx`, `info(title)` in
   `server/crates/app-http/src/openapi.rs`.
2. Logo and favicon: `web/src/components/brand/logo.tsx`, `web/public/favicon.svg`.
3. Proto package (`app.v1`): rename in `server/proto/` and the `include_proto!` in `app-proto`.
4. Pick a license: fill in `LICENSE` and set `license` in `server/Cargo.toml` `[workspace.package]`.
5. CODEOWNERS: replace the placeholders in `.github/CODEOWNERS`.
6. Delete or keep the notes example: it is the reference for new features.

## Contributing

Read [CLAUDE.md](CLAUDE.md): the rules there apply to people and AI assistants alike.

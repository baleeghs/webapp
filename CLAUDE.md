# CLAUDE.md

Rules and orientation for anyone changing this repository: people and AI coding assistants
alike. This file is loaded into every AI session, so it holds everything you must know before
touching code. The details behind each section live in [docs/](docs/README.md); the agent
playbook (recipes, verification, troubleshooting) is [docs/ai/CLAUDE.md](docs/ai/CLAUDE.md).

---

## 1. What this repository is

A **full-stack web application template** that other projects are created from. Whatever you
build here becomes the pattern every derived project copies, so consistency matters more than
cleverness.

| Part | Stack | Lives in |
| --- | --- | --- |
| Server | Rust 2024 workspace: actix-web 4 (HTTP), tonic 0.14 (gRPC), sqlx 0.9 (Postgres), utoipa 6 (OpenAPI), tracing, Prometheus | `server/` |
| Web app | React 19, TypeScript 6, Vite 8, TanStack Router + Query, Zustand, Tailwind CSS 4, openapi-fetch | `web/` |
| Tests | cargo test, Vitest + Testing Library (happy-dom, in-house fake API), Playwright | next to the code, `web/e2e/` |
| Ops | Makefile, Docker (distroless), Compose, GitHub Actions, Dependabot | repo root, `.github/` |

One example feature, **notes**, runs through every layer: migration → domain → Postgres
repository → cache decorator → HTTP + gRPC → generated client types → React feature → pages →
tests. **When you build anything, find the notes equivalent first and follow it.**

---

## 2. Golden rules

1. **Write it ourselves first.** No UI component libraries (Tailwind is the only styling
   dependency); small helpers are written in-house. A third-party package is added only when it
   brings a lot that would be costly to build and maintain (TanStack, Apache ECharts,
   react-hot-toast are the bar). Add it with `cargo add` / `pnpm add`, never by hand-writing a
   version (§5).
2. **`make check` must pass** before any change is done. Run `make e2e` when UI behaviour changed.
3. **Dependencies point inward on the server.** `app-core` never imports actix, tonic, sqlx or
   anything that does I/O.
4. **Business rules live in `app-core` services.** Handlers and components stay thin.
5. **Never edit generated files** (§8). Change the source and regenerate.
6. **Never edit an applied migration.** Add a new one.
7. **The API contract is generated.** After touching any endpoint or DTO run `make gen-api` and
   commit both `server/openapi.yaml` and `web/src/lib/api/schema.gen.ts`.
8. **Server data goes through TanStack Query**, never Zustand or ad-hoc `useState` + `fetch`.
9. **Styles come from design tokens.** No raw hex colours, no literal z-index, no pixel values
   that a token already covers.
10. **Test at the lowest layer that can prove the behaviour**, and add the test in the same change.
11. **Match the surrounding code**: naming, comment density, file layout, idioms.
12. **Keep docs true.** If a command, convention or setup step changes, update the doc in the same change.

---

## 3. Commands

Run from the repository root unless noted. `make` with no arguments lists every target.

| Goal | Command | Notes |
| --- | --- | --- |
| First-time setup | `make setup` | pnpm install, cargo fetch, Playwright Chromium, creates `.env` |
| Run everything (dev) | `make dev` | server (:8080 HTTP, :50052 gRPC) + Vite with hot reload (:5173, proxies `/api`). In-memory storage unless `DATABASE_URL` is set |
| Run as in production | `make start` | builds the UI into `server/static`; the server serves it at `/` and the API at `/api/v1/*`, all on :8080 |
| Server only | `make dev-server` or `cd server && cargo run -p app-server` | |
| Server on other ports | `cd server && cargo run -p app-server -- --http-port=8443 --grpc-port=50051` | flags > `APP_*` env > defaults |
| Web only | `make dev-web` | proxies `/api`, `/healthz`, `/readyz` to `API_TARGET` (default `http://localhost:8080`) |
| Postgres | `make db-up` then set `DATABASE_URL` in `.env` | `make db-down`, `make db-reset` |
| Everything CI checks | `make check` | fmt, clippy `-D warnings`, typecheck, oxlint, prettier, API + palette contract, all tests, hygiene, doc links |
| Format | `make fmt` | rustfmt + prettier |
| Lint + types | `make lint` | |
| Tests (no DB) | `make test` | cargo test + vitest |
| Postgres tests | `make test-db` | needs `DATABASE_URL` |
| Browser tests | `make e2e` | Playwright, API mocked, no server needed |
| Regenerate API types | `make gen-api` | after any endpoint/DTO change |
| Regenerate palettes | `make gen-palettes` | after editing `web/gen/palettes.mts` |
| New migration | `make migration name=add_users` | needs sqlx-cli |
| Apply migrations | `make migrate` | |
| Build the UI only | `make build-web` | `pnpm build` → `server/static/` (git-ignored) |
| Production build | `make build` / `make docker` | UI into `server/static` + release binary / distroless image |

Single tests:

```sh
cd server && cargo test -p app-http notes_crud          # one Rust test by name
cd server && cargo test -p app-core                       # one crate
cd web && pnpm vitest run src/lib/cn.test.ts              # one Vitest file
cd web && pnpm vitest run -t "creates a note"             # by test name
cd web && pnpm exec playwright test e2e/notes.spec.ts     # one E2E file
```

---

## 4. Repository map

```
.
├── CLAUDE.md                  this file
├── Makefile                   every routine task
├── Dockerfile, compose.yaml   production image; local Postgres (+ optional app)
├── .env.example               every setting, documented; copy to .env
├── .github/
│   ├── workflows/ci.yml       server, web, e2e, repo hygiene, docker jobs
│   ├── actions/setup-*/       composite toolchain setup
│   └── scripts/               check-hygiene.sh, check-docs-links.sh, bundle-report.mts
├── docs/
│   ├── ai/                    contributor guides (this file's details)
│   ├── architecture/          human-facing overview
│   ├── api/API.md             HTTP + gRPC conventions, error codes
│   └── database/SCHEMA.md     tables, migration rules
├── server/                    Rust workspace
│   ├── Cargo.toml             workspace, shared lints (clippy pedantic)
│   ├── clippy.toml, rustfmt.toml (120 columns)
│   ├── openapi.yaml           GENERATED HTTP contract (committed)
│   ├── static/                web build output, served at / (git-ignored; make build-web)
│   ├── migrations/            sqlx up/down pairs
│   ├── proto/app/v1/*.proto   gRPC contracts
│   └── crates/
│       ├── app-core           domain: models, validation, services, ports (traits)
│       ├── app-common         config (figment, APP_* env), telemetry
│       ├── app-db             Postgres repositories, pool, embedded migrations
│       ├── app-cache          TtlCache (moka) + caching repository decorators
│       ├── app-proto          generated protobuf/gRPC code (protox, no protoc)
│       ├── app-http           actix-web: modules/<feature>/, middleware, errors, OpenAPI, SPA
│       ├── app-grpc           tonic services, health, reflection
│       └── app-server         binary: CLI, wiring, storage selection, shutdown
└── web/
    ├── gen/                   generators: icons, fonts, palettes, check-api
    ├── e2e/                   Playwright specs + mocked API fixture
    ├── public/                favicon, theme-init.js (pre-paint appearance)
    └── src/
        ├── main.tsx           entry
        ├── app/               providers, query client, root layout, progress, chunk recovery
        ├── routes/            route tree (router.ts), search-param schemas (search.ts)
        ├── pages/<page>/      one folder per route
        ├── features/<x>/      api/ components/ lib/ index.ts (public API)
        ├── components/        ui/ (design system), layout/, icons/, errors/, brand/
        ├── lib/               framework-free helpers, typed API client (lib/api)
        ├── stores/            Zustand (client-only preferences)
        ├── styles/            tokens, themes (+ generated palettes), base, components
        └── test/              setup, in-house fake API (fetch mock), fixtures, renderApp helper
```

---

## 5. Dependencies

Always through the package manager, so you get the latest release and a consistent lockfile.

```sh
cd server && cargo add -p <crate> <dep> [-F feat1,feat2]   # e.g. cargo add -p app-http actix-web
cd server && cargo add -p <crate> --dev <dep>
cd server && cargo add -p <crate> --build <dep>
cd web && pnpm add <pkg>        # shipped to the browser
cd web && pnpm add -D <pkg>     # build / lint / test only
cd server && cargo remove -p <crate> <dep>;  cd web && pnpm remove <pkg>
```

Web versions are pinned exactly (`saveExact` in `web/pnpm-workspace.yaml`); pnpm 12 reads its
settings only from that file, not from `package.json` or `.npmrc`. Install scripts of dependencies
are blocked (`onlyBuiltDependencies: []`).

**The bar for a new dependency is high.** We build UI components, small utilities, validators and
test helpers in the codebase. A package is justified only when it adds a lot that would be costly
to write and maintain well: a data grid engine, a charting library, virtualisation, a router.
Examples we accept: TanStack (Query, Router, Table, Virtual), Apache ECharts, react-hot-toast,
Fontsource. Examples we replaced with a few lines of our own: `clsx`, `tailwind-merge`,
`class-variance-authority`, `zod`, `msw`. Add a Rust dependency **only to the crates that use it**.
Read [docs/ai/DEPENDENCIES.md](docs/ai/DEPENDENCIES.md) before adding anything and justify it in the PR.

---

## 6. Server rules

Full guide: [docs/ai/BACKEND.md](docs/ai/BACKEND.md).

**Crate dependency graph** (arrows = "may depend on"):

```
app-server ──► app-http ──► app-core ◄── app-db
     │     ──► app-grpc ──► app-core ◄── app-cache
     │            └──────► app-proto
     └──► app-common ◄── (http, grpc, db, cache)
```

- `app-core`: pure domain. Models, `validate()`, services returning `CoreResult<T>`, repository
  and health-check **traits**. No I/O, no framework types, no env access.
- Storage adapters (`app-db`, `app-cache`) **implement** core traits and map their errors to
  `CoreError` at the boundary. They never validate input.
- Transports (`app-http`, `app-grpc`) extract → convert DTO to domain input → call the service →
  convert the result. No SQL, no business `if`s.
- `app-server` is the only crate that knows every other crate: wiring, storage choice, shutdown.
- **Errors**: everything is a `CoreError` (`NotFound`, `Validation`, `Conflict`, `Unavailable`,
  `Internal`). Mapping to HTTP lives only in `app-http/src/error.rs`; to gRPC only in
  `app-grpc/src/error.rs`. Matches on `CoreError` are exhaustive on purpose.
- **DTOs are not domain types.** Wire types (camelCase, `ToSchema`) live in
  `app-http/src/modules/<feature>/dto.rs` with `From` conversions.
- **New endpoint**: `#[utoipa::path]` on the handler, register it in `app-http/src/openapi.rs`,
  route it in `modules/<feature>/mod.rs`, then `make gen-api`.
- **Config**: add the field with a default in `app-common/src/config.rs`, validate it there,
  document it in `.env.example`. Secrets get a redacting `Debug`.
- **Lints**: clippy `pedantic` with `-D warnings` in CI. No `unwrap`/`expect`/`println!`/`dbg!`
  outside tests. A justified exception is `#[allow(...)]` on the item with a comment saying why.
- **Logging**: `#[tracing::instrument(skip(...))]` on service methods; structured fields
  (`note.id = %id`), never secrets or whole bodies.

---

## 7. Web rules

Full guides: [docs/ai/FRONTEND.md](docs/ai/FRONTEND.md), [docs/ai/DESIGN.md](docs/ai/DESIGN.md).

- **Import direction**: `pages → features → components / lib / stores`. Never the reverse.
- **Features** expose a public API in `features/<x>/index.ts`; import a feature only through it.
  A feature never imports another feature's internals or any page.
- **Server data**: `queryOptions` factories in `features/<x>/api/queries.ts` (keys in `keys.ts`),
  shared by the route loader (`ensureQueryData`) and the component (`useSuspenseQuery`).
  Mutations are hooks next to them; on success update the detail cache and invalidate lists.
- **API calls** only via `unwrap(api.GET(...))` from `@/lib/api/client`. It throws `ApiError`
  (`status`, `code`, `details`, `requestId`). Never call `fetch` directly; never hand-write a
  type the schema has: use `Schema<'NoteDto'>`.
- **URL state** (page, filters, sort, tab) is a validated search param: an in-house validator in
  `routes/search.ts` (helpers `positiveInt`, `oneOf`; input typed with `SearchSchemaInput`),
  with defaults stripped from the URL.
- **Client preferences** (theme, palette, density, sidebar) live in `stores/ui-store.ts`
  (persisted, key `app.ui`). `public/theme-init.js` reads the same key before first paint: keep
  them in sync.
- **UI** comes from `@/components/ui` (never a subfolder path). Icon-only buttons need a label
  (`IconButton` enforces it). Forms use `Field` so label, hint and error are wired.
- **Styling**: Tailwind utilities with tokens (`bg-surface-raised`, `text-fg-muted`,
  `z-(--z-popover)`, `h-(--app-density-control-h)`); compose with `cn()` (plain join: it does not merge conflicting Tailwind classes), variants with
  `variants()` from `@/lib/variants`.
- **Dialogs** are native `<dialog>` via `Dialog`; mark the field to focus with `data-autofocus`
  (React's `autoFocus` runs before `showModal()` and loses).
- **Tests**: `*.test.ts` (Node, pure logic) and `*.dom.test.tsx` (happy-dom + the fake API in
  `src/test/mock-api.ts`). Prefer
  `renderApp('/path')` from `src/test/utils.tsx`. Query by role and label. Unmocked requests fail.

---

## 8. Generated files: never edit by hand

| File | Source | Regenerate | CI check |
| --- | --- | --- | --- |
| `server/openapi.yaml` | utoipa annotations | `make gen-api` | `app-http/tests/openapi.rs` |
| `web/src/lib/api/schema.gen.ts` | `server/openapi.yaml` | `make gen-api` | `pnpm check:api` |
| `web/src/styles/themes/palettes.gen.css`, `web/src/lib/palettes.gen.ts` | `web/gen/palettes.mts` | `make gen-palettes` | `pnpm check:palettes` |
| `web/src/components/icons/svg.ts` | `ICON_MAP` in `web/gen/icons.mts` | `pnpm gen:icons` (network) | – |
| `web/src/styles/fonts/*` | `web/gen/fonts.mts` | `pnpm gen:fonts` (network) | – |
| `server/crates/app-proto` output | `server/proto/**/*.proto` | automatic at build | build fails |

---

## 9. Gotchas that have bitten us

- **Port 50051** is claimed by Canonical Multipass (via launchd) on many Macs, invisible to
  `lsof` without sudo. The gRPC default is therefore **50052**.
- **No `DATABASE_URL` = in-memory storage** (data lost on restart; refused in production). With a
  URL set but Postgres down, the server still starts: `/readyz` is 503, data calls return `503 unavailable`.
- **The UI build goes to `server/static`**, not `web/dist` (`vite.config.ts` `outDir`). The server
  serves it at `/` when it contains `index.html`; otherwise it runs API-only and logs how to fix it.
- **Unknown `/api/*` paths** must stay JSON 404s. Every nested actix scope needs its own
  `default_service` (scopes do not inherit it).
- **`cn()` does not merge Tailwind conflicts** (`cn('h-4', 'h-7')` keeps both). Components must
  not hard-code a value callers override; expose a prop/variant (see `Skeleton`, which has no
  built-in height).
- **TypeScript stays on 6.x**: TypeScript 7 (native) drops the JS API that `openapi-typescript`
  needs, so `make gen-api` breaks. `@types/node` follows the Node runtime major (24), not "latest".
- **pnpm 12 settings** live in `web/pnpm-workspace.yaml`; the `pnpm` field in `package.json` and
  `.npmrc` are ignored.
- **Search validators** must type their parameter with `SearchSchemaInput`, or every `<Link>` to
  the route has to pass `search`.
- **Tailwind scans files not ignored by git**: keep build output in `.gitignore`.
- **Clippy `doc_markdown`**: put identifiers in backticks in `///` comments; product names are
  allowed in `server/clippy.toml`.
- **`erasableSyntaxOnly`**: no TypeScript enums, namespaces or constructor parameter properties
  (Node also runs the `gen/*.mts` scripts by stripping types).

---

## 10. Definition of done

- [ ] `make check` passes (and `make e2e` for UI changes; `make test-db` for SQL changes).
- [ ] New behaviour has tests at the lowest layer that can prove it.
- [ ] Generated artifacts regenerated and committed (§8).
- [ ] Migrations are reversible and safe on a live database ([docs/database/SCHEMA.md](docs/database/SCHEMA.md)).
- [ ] Docs updated where conventions, commands, config or setup changed.
- [ ] No new dependency without a reason; versions added only via `cargo add` / `pnpm add`.
- [ ] Report what changed, what was verified (with the commands), and anything not verified.

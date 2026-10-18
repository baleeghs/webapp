# AI agent playbook

How to work in this repository, step by step. [CLAUDE.md](../../CLAUDE.md) at the root holds the
rules; this file holds the procedures: how to approach a task, recipes for every common change,
how to verify, and how to get unstuck. It is written to be followed literally.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [BACKEND.md](BACKEND.md) ·
[FRONTEND.md](FRONTEND.md) · [DESIGN.md](DESIGN.md) · [DEPENDENCIES.md](DEPENDENCIES.md) ·
[ADDING-A-FEATURE.md](ADDING-A-FEATURE.md)

---

## 1. Working loop

Every task, however small, goes through these steps.

### 1.1 Orient

1. Read the request twice. Name the deliverable and who it is for.
2. Find the **notes** equivalent of what you are about to build. Grep for it:
   ```sh
   grep -rn "notes" server/crates --include=*.rs | head
   grep -rn "notes" web/src --include=*.ts --include=*.tsx | head
   ```
3. Read the files you will change **in full** before editing. Read their tests.
4. Check the generated-file table in [CLAUDE.md](../../CLAUDE.md) §8: if the thing you want to change is
   generated, change its source instead.

### 1.2 Decide

- Make reasonable decisions yourself (naming, file placement, which existing component to use).
  Ask the user only when the answer changes what you build and cannot be inferred: product
  behaviour, irreversible data changes, external services, cost.
- If a request conflicts with a rule in CLAUDE.md, say so and propose the compliant alternative.
- Prefer extending an existing pattern over introducing a new one. A new pattern needs a reason
  and a doc update.

### 1.3 Implement bottom-up

Server: migration → `app-core` (model, validation, trait, service + unit tests) → `app-db`
(+ `#[sqlx::test]`) → wiring in `app-server` → `app-http` (+ API tests) → `app-grpc` →
`make gen-api`.

Web: types from the schema → `features/<x>/api` → `features/<x>/lib` (pure, `*.test.ts`) →
components → page → route → sidebar → fake-API routes → DOM tests → E2E.

Keep each step compiling. Run the narrowest test after each step (§4).

### 1.4 Verify

Run the commands in the verification matrix (§4) for what you touched, then `make check`. For UI
changes, also **look at the result** in a browser (screenshots via Playwright, §4.3) at a phone and
a desktop width, light and dark. Typecheck and tests prove correctness, not appearance.

### 1.5 Report

Tell the user, briefly:
- what changed (behaviour first, files second),
- what you ran to verify it, with results,
- anything you could not verify and why (e.g. no Docker, no Postgres),
- decisions you made on their behalf, and follow-ups only they can do.

Never claim a check passed if you did not run it. If something failed and you worked around it,
say so.

---

## 2. Coding conventions in practice

### 2.1 Both sides

- Names say what a thing is in the domain (`NoteService`, `notesListQuery`), not how it is built.
- One responsibility per file. When a file needs a long comment to explain its sections, split it.
- Comments explain **why** (constraints, trade-offs, browser quirks), not what the next line does.
  Every module/file starts with a short doc comment saying what it is for.
- No dead code, no commented-out code, no `TODO` without an issue link.
- Errors are values with codes, not strings to parse later.

### 2.2 Rust

- `CoreResult<T>` from services; `?` everywhere; no `unwrap`/`expect` outside tests.
- Constructors are `new`; builders only when there are many optional fields.
- Async traits use `#[async_trait]` so services can hold `Arc<dyn Trait>`.
- Types that hold secrets implement `Debug` manually and redact them.
- `#[tracing::instrument(skip(self, ...))]` on service methods; never log request bodies.
- 120-column formatting (`rustfmt.toml`); `cargo fmt` before committing.

### 2.3 TypeScript / React

- Strict TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Handle the
  `undefined`; do not silence it with `!` unless a test or invariant guarantees it.
- No enums, namespaces or parameter properties (`erasableSyntaxOnly`).
- Components are functions with a named props interface when they take more than two props.
- Select from Zustand narrowly: `useUiStore((s) => s.theme)`, one selector per field.
- Accessible by construction: real elements first (`button`, `a`, `label`, `dialog`, native
  radios), ARIA only to fill gaps.
- `@/` imports for anything outside the current folder; relative imports inside a feature.

---

## 3. Recipes

Each recipe lists the files to touch, in order, and how to verify.

### 3.1 Add an HTTP endpoint to an existing feature

1. `app-core/src/<feature>/service.rs`: add the operation (validation in the model). Unit test it.
2. If storage is needed: add the method to `repository.rs` (trait), implement it in
   `app-db/src/<feature>.rs`, `app-core/src/<feature>/memory.rs`, and the cache decorator in
   `app-cache` if one exists.
3. `app-http/src/modules/<feature>/dto.rs`: request/response types (`Deserialize`/`Serialize`,
   `ToSchema`, `#[serde(rename_all = "camelCase")]`, `deny_unknown_fields` on requests).
4. `handlers.rs`: handler with `#[utoipa::path(method, path = "/api/v1/...", tag, params,
   request_body, responses((status, description, body)))]`, returning `ApiResult<...>`.
5. `mod.rs`: route it. `app-http/src/openapi.rs`: add it to `paths(...)`.
6. `app-http/tests/api.rs`: status code, JSON shape, error envelope.
7. `make gen-api`. Verify: `cd server && cargo test -p app-http && cd ../web && pnpm typecheck`.

### 3.2 Add a gRPC method

1. Edit `server/proto/app/v1/<feature>.proto`. Never renumber or reuse field numbers.
2. Build (`cargo build -p app-proto`) to regenerate.
3. Implement it in `app-grpc/src/<feature>.rs`, mapping errors with `error::status` and ids with
   `error::parse_id`. Add a test in the same file.
4. New proto file? Add it to `PROTOS` in `app-proto/build.rs` and register the service in
   `app-grpc/src/lib.rs::serve`.

### 3.3 Add a migration

1. `make migration name=<snake_case>` (creates `*.up.sql` and `*.down.sql`).
2. Write both; follow [database/SCHEMA.md](../database/SCHEMA.md) (UUIDv7 ids, `timestamptz`,
   constraints, `CONCURRENTLY` indexes in their own `-- no-transaction` migration).
3. Update the table list in `docs/database/SCHEMA.md`.
4. Verify: `make db-up && make migrate && make test-db`. Without Docker, say so in your report;
   CI runs it.

### 3.4 Add a configuration setting

1. `app-common/src/config.rs`: field with doc comment, default in the `Default` impl, validation
   in `AppConfig::validate` if it can be wrong. Add a test using `figment::Jail`.
2. `.env.example`: the variable (`APP_SECTION__FIELD`), commented, with its default.
3. Optional CLI flag: `app-server/src/cli.rs` `ConfigOverrides` (field + one line in `apply`) and
   a test in the same file.
4. Use it in `app-server/src/app.rs` (wiring) and pass it down; never read env vars elsewhere.

### 3.5 Add a page

1. `web/src/pages/<name>/<name>-page.tsx` exporting `<Name>Page`; start with `PageHeader` +
   `PageBody`.
2. `web/src/routes/router.ts`: `createRoute` with `lazyRouteComponent(() => import(...), 'NamePage')`,
   a loader that `ensureQueryData`s its queries, and `validateSearch` if it has URL state
   (schema in `routes/search.ts`, defaults stripped with `stripSearchParams`). Add it to
   `routeTree`.
3. Sidebar entry in `components/layout/sidebar.tsx` (`MAIN_NAV` or `FOOTER_NAV`).
4. `e2e/pages.ts`: add it so the layout spec checks it at four viewports.
5. `routes/router.test.ts`: update the expected path list.
6. DOM test with `renderApp('/name')`.

### 3.6 Add a web feature

Follow [ADDING-A-FEATURE.md](ADDING-A-FEATURE.md) §7–8. Shape:

```
features/<x>/
  api/types.ts      Schema<'XDto'> aliases
  api/keys.ts       hierarchical query keys
  api/queries.ts    queryOptions factories + mutation hooks
  components/       feature UI
  lib/              pure logic + *.test.ts
  index.ts          public API (the only import path for others)
```

Add routes to `defaultRoutes` in `src/test/mock-api.ts` (`route('GET', '/api/v1/x/:id', ...)`),
mirroring the server contract.

### 3.7 Add a UI component to the design system

1. Pick the folder by role: `actions`, `forms`, `feedback`, `overlays`, `surfaces`,
   `data-display`, `navigation`, `primitives`.
2. Build on tokens and existing recipes (`styles/recipes.ts`); variants with `variants()` from
   `@/lib/variants`, in a separate `*-variants.ts` if they are exported (fast refresh needs
   component-only files). Do not bake in values callers are meant to override: `cn()` does not
   resolve Tailwind conflicts.
3. Export from the folder's `index.ts` (the root `components/ui/index.ts` re-exports folders).
4. A `*.dom.test.tsx` for behaviour and accessibility (see `forms/field.dom.test.tsx`).

### 3.8 Add an icon

1. Find the Material Symbols name at https://fonts.google.com/icons.
2. Add `NAME: 'material_name'` to `ICON_MAP` in `web/gen/icons.mts`.
3. `cd web && pnpm gen:icons` (needs network). Use `<Icon name="NAME" />`.

### 3.9 Add a colour palette

1. One line in `PALETTES` in `web/gen/palettes.mts` (`neutral.hue/tint`, `accent.hue/chroma`).
2. `make gen-palettes`. It fails if any WCAG contrast pairing misses; adjust the numbers.
3. It appears in Settings automatically. See [DESIGN.md](DESIGN.md) §3.

### 3.10 Add or upgrade a dependency

First ask whether to write it instead: we avoid UI kits and small utility packages
([DEPENDENCIES.md](DEPENDENCIES.md) §1). If it clears the bar, `cargo add` / `pnpm add` only
(web pins are exact automatically). For a major
upgrade, read the changelog, then run `make check && make e2e`. For web packages also check
the bundle report (`cd web && pnpm build && node ../.github/scripts/bundle-report.mts`).

### 3.11 Change the API contract (breaking)

1. Prefer additive changes (new optional fields, new endpoints).
2. Breaking: add `/api/v2/...` beside v1, or change v1 together with every client in one PR.
3. `make gen-api`; TypeScript errors now list every affected call site. Fix them all.

---

## 4. Verification matrix

### 4.1 What to run for what you touched

| You changed | Run |
| --- | --- |
| `app-core` | `cd server && cargo test -p app-core` |
| `app-db` / SQL / migrations | `make test-db` (needs Postgres) + `cargo test -p app-db` |
| `app-http` | `cargo test -p app-http`, then `make gen-api` if any annotation changed |
| `app-grpc` / proto | `cargo test -p app-grpc -p app-server` |
| `app-server` wiring / CLI | `cargo test -p app-server` (boots both servers) |
| Config | `cargo test -p app-common -p app-server` |
| Web logic (`lib/`, feature `lib/`) | `cd web && pnpm vitest run <file>` |
| Web components / pages | `pnpm test`, then `pnpm e2e` |
| Styles / tokens / palettes | `pnpm test` (z-index and palette tests), `pnpm check:palettes`, screenshots |
| Docs | `./.github/scripts/check-docs-links.sh` |
| Anything | `make check` at the end |

### 4.2 Running the real server

```sh
cd server && cargo run -p app-server                     # in-memory
curl -s localhost:8080/healthz
curl -s -X POST localhost:8080/api/v1/notes -H 'content-type: application/json' -d '{"title":"hi"}'
curl -s localhost:8080/readyz
grpcurl -plaintext localhost:50052 list                  # reflection on in development
```

Stop it with Ctrl-C (graceful). **In scripts, never assume the default ports are free and never
kill by name**: the user may have their own server or Vite running. Use spare ports and stop only
the process you started:

```sh
cd server && ./target/debug/app-server --http-port 18080 --grpc-port 15052 & PID=$!
sleep 2 && curl -s localhost:18080/healthz
kill -INT $PID; wait $PID
```

Production-like check (UI served by the backend at `/`): `make build-web`, then run the server as
above and open `http://localhost:18080/`. Dev proxy check: run Vite on a spare port against it,
`cd web && API_TARGET=http://localhost:18080 ./node_modules/.bin/vite --port 5199 --strictPort`.

### 4.3 Looking at the UI

With the dev server running (`cd web && pnpm dev`), write a throwaway Playwright spec that uses
the mocked API fixture and takes screenshots, run it, then delete it:

```ts
// web/e2e/zz-shots.spec.ts (delete after use)
import { test } from './app';
test('settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  await page.screenshot({ path: '/tmp/settings-phone.png', fullPage: true });
});
```

```sh
cd web && pnpm exec playwright test e2e/zz-shots.spec.ts && rm e2e/zz-shots.spec.ts
```

Check phone (390) and desktop (1280–1440), light and dark. Seed appearance with
`page.addInitScript(() => localStorage.setItem('app.ui', JSON.stringify({ state: { theme: 'dark', palette: 'stone', density: 'comfortable' }, version: 1 })))`.
Wait ~1 s before shooting: the logo has an intro animation.

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Error: gRPC server … Address already in use` | Another process (often Multipass on 50051) owns the port | `--grpc-port=<n>` or `APP_GRPC__PORT`; `lsof` may not show launchd sockets, try binding with Python |
| Server exits: `invalid DATABASE_URL` | Malformed URL | Fix `.env`; unset it for in-memory |
| `/readyz` 503 and API `unavailable` | Postgres configured but down | `make db-up`; the pool reconnects on its own |
| `committed_openapi_is_up_to_date` fails | Annotations changed without regenerating | `make gen-api`, commit both files |
| `pnpm check:api` fails | `schema.gen.ts` stale or hand-edited | `make gen-api` |
| `pnpm check:palettes` fails | Generated palette files stale or a contrast check fails | `make gen-palettes`; read its error |
| Unknown `/api/...` returns empty 404 or HTML | Nested actix scope without `default_service` | Add `.default_service(web::to(api_not_found))` to the scope |
| clippy `doc_markdown` | Identifier without backticks in a doc comment | Backtick it, or add a product name to `doc-valid-idents` |
| clippy `needless_pass_by_value` on an error mapper | Signature dictated by `map_err`/actix | `#[allow(...)]` with a comment, as in `app-grpc/src/error.rs` |
| `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` running `gen/*.mts` | Enum / parameter property in a script | Plain fields; Node strips types only |
| Dialog opens but focus lands on Close | `autoFocus` used | `data-autofocus` on the target |
| DOM test fails with "Requests with no mock route" | The code called an endpoint the fake API does not know (fails by design) | Add a route to `src/test/mock-api.ts` or `server.use(route(...))` in the test |
| Ctrl+B test toggles the rail, not the drawer | happy-dom's window is 1024 px wide (desktop) | Assert the desktop behaviour, or resize the window in the test |
| `ts.factory` undefined in `gen:api` | TypeScript 7 installed | `pnpm add -D typescript@6` (see DEPENDENCIES.md) |
| A setting in `package.json` `pnpm` or `.npmrc` has no effect | pnpm 12 ignores them | Put it in `web/pnpm-workspace.yaml` |
| Every `<Link to="/x">` demands `search` | Search validator's parameter not typed with `SearchSchemaInput` | See `routes/search.ts` |
| Tailwind CSS suddenly larger | A build output folder is not git-ignored | Add it to `.gitignore` |
| Bundle budget fails in CI | A heavy import | Check the report; lazy-load it, or write the small part you need |
| Lint `only-export-components` | Component file also exports a constant | Move the constant (e.g. `button-variants.ts`) |
| E2E request reaches `localhost:8080` | Test not using the `api` fixture | It is `auto`; import `test` from `./app`, not from `@playwright/test` |

---

## 6. Things not to do

- Do not add a dependency by editing a manifest; do not pin versions by hand.
- Do not put business logic in handlers, components, SQL or the cache layer.
- Do not bypass `unwrap(api.…)` with raw `fetch`, or `CoreError` with ad-hoc status codes.
- Do not store server data in Zustand or component state.
- Do not use literal colours, z-indexes, or `px` sizes that a token covers.
- Do not edit generated files, applied migrations, or lockfiles by hand.
- Do not weaken a lint, test, budget or contrast check to make a change pass. Fix the cause, or
  explain the exception in code and in your report.
- Do not delete or rewrite user-authored content you were not asked to touch; if something looks
  wrong, say so.
- Do not commit, push or publish unless asked.

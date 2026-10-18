# Dependencies

Policy and inventory for third-party packages: when we take one, how we add, pin, upgrade and
remove it, and what every current dependency is for.

---

## 1. Philosophy: write it here first

We keep the dependency list short on purpose. Every package is code we did not review, a
supply-chain risk, bundle weight, upgrade churn and an API we do not control. So:

- **No UI component libraries.** No MUI, Chakra, Mantine, shadcn/Radix kits, headless widget
  libraries or icon packages. Components live in `web/src/components/ui`, built on our tokens.
  **Tailwind CSS is the one styling dependency we allow.**
- **No small utility packages.** Class joining, variants, formatting, dates, validators, query
  string helpers, test mocks: we write them. A few dozen typed lines we own beat a package.
- **A package is justified only when it brings a lot** that would be costly to build and
  maintain to the same quality: hard algorithms, big rendering engines, deep browser or protocol
  work. The bar, by example:

| Accepted (big benefit) | Why it clears the bar |
| --- | --- |
| TanStack Query, Router (in use); Table, Virtual (when needed) | caching, deduping, typed routing, table models, windowing: years of edge cases |
| Apache ECharts (when charts are needed) | a full canvas/SVG charting engine |
| react-hot-toast (if our in-house toaster stops being enough) | accessible, animated toasts with a tiny API |
| Fontsource (`@fontsource-variable/*`) | maintained variable font packaging (alternative to our `gen:fonts`) |
| openapi-fetch + openapi-typescript (in use) | typed client and types generated from the server contract |
| Testing Library, Playwright, Vitest (in use) | test infrastructure we should not reinvent |

| Replaced with our own code | Lines | Where |
| --- | --- | --- |
| `clsx` + `tailwind-merge` | ~10 | `web/src/lib/cn.ts` |
| `class-variance-authority` | ~40 | `web/src/lib/variants.ts` |
| `zod` (search params) | ~30 | `web/src/routes/search.ts` |
| `msw` (test API mocking) | ~100 | `web/src/test/mock-api.ts` |
| toast library | ~80 | `web/src/components/ui/feedback/toast.ts`, `toaster.tsx` |
| dialog / focus-trap library | ~70 | native `<dialog>` in `components/ui/overlays/dialog.tsx` |
| date libraries | ~40 | `Intl` in `web/src/lib/format.ts`, `time.ts` |
| icon packages, icon fonts | generated | `web/gen/icons.mts` → inline SVG paths |
| runtime Google Fonts | generated | `web/gen/fonts.mts` → self-hosted files |

The same applies to Rust: prefer the standard library and the crates already in the workspace.

---

## 2. Before adding: checklist

Answer these in the PR description.

1. **Can we write it?** If it is under ~200 lines of straightforward code, write it, with tests.
2. **Is it already solved here?** Check the inventory (§6) and `lib/`, `components/ui`.
3. **Does it clear the bar?** Name the hard problem it solves for us (see §1).
4. **Is it healthy?** Recent releases, active maintainers, wide use, permissive licence, no open
   advisories, no install scripts (they are blocked, §3).
5. **What does it cost?** Web: `pnpm build` and `node ../.github/scripts/bundle-report.mts`
   (CI budgets: 100 kB gzip per chunk, 250 kB total JS, 40 kB CSS). Rust: compile time and
   `cargo tree -p <crate>`.
6. **Does it fit the architecture?** It must not pull I/O into `app-core`, and UI packages must
   be styleable with our tokens (or headless).
7. **Can it be lazy?** Heavy, rarely used libraries (charts, editors) load in their page's chunk.

---

## 3. How: package manager only, exact pins

**Never type a version into `Cargo.toml` or `package.json`, and never edit a lockfile.**

| Action | Server (`cd server`) | Web (`cd web`) |
| --- | --- | --- |
| Add (runtime) | `cargo add -p <crate> <dep>` | `pnpm add <pkg>` |
| Add with features | `cargo add -p <crate> <dep> -F a,b` | – |
| Add without default features | `cargo add -p <crate> <dep> --no-default-features -F a` | – |
| Add (tests / tooling) | `cargo add -p <crate> --dev <dep>` | `pnpm add -D <pkg>` |
| Add (build script) | `cargo add -p <crate> --build <dep>` | – |
| Add a workspace crate | `cargo add -p <crate> --path crates/<other>` | – |
| Remove | `cargo remove -p <crate> <dep>` | `pnpm remove <pkg>` |
| Upgrade within range | `cargo update -p <dep>` | `pnpm add <pkg>@latest` (stays exact) |
| Upgrade a major | read the changelog, then `cargo add -p <crate> <dep>@<major>` | read the changelog, then `pnpm add <pkg>@<major>` |

### 3.1 Web settings (`web/pnpm-workspace.yaml`)

pnpm 12 reads its settings **only** from this file; the `pnpm` field in `package.json` and `.npmrc`
are ignored (it warns about the former).

| Setting | Value | Why |
| --- | --- | --- |
| `saveExact` | `true` | `pnpm add` writes `"react": "19.3.1"`, never `^`/`~`: nothing changes without a reviewed diff |
| `engineStrict` | `true` | refuse to install on a Node version outside `engines` (24) |
| `onlyBuiltDependencies` | `[]` | no dependency may run install scripts (postinstall): a supply-chain safeguard; add a package only with a stated reason |
| `peerDependencyRules.allowedVersions` | `openapi-typescript>typescript: '6'` | it declares `^5` but works with 6 |

### 3.2 Rust

Cargo records caret ranges in manifests, and `Cargo.lock` (committed, `--locked` in CI and Docker)
pins the exact build. Add a crate **only to the workspace crates that use it**:

| Crate | Must never depend on |
| --- | --- |
| `app-core` | actix, tonic, sqlx, moka, figment, anything doing I/O |
| `app-db`, `app-cache` | actix, tonic |
| `app-http` | sqlx, tonic |
| `app-grpc` | sqlx, actix |
| `app-common` | other `app-*` crates |

Enable only the features you use (`sqlx` is added with `--no-default-features`). Test-only crates
go in `[dev-dependencies]`, codegen in `[build-dependencies]`.

---

## 4. Version lines we hold back on purpose

`pnpm add <pkg>@latest` is the default. These are the deliberate exceptions:

| Package | Held at | Reason | Revisit when |
| --- | --- | --- | --- |
| `typescript` | 6.x | TypeScript 7 (native) drops the JS API; `openapi-typescript` crashes (`ts.factory` undefined), so `make gen-api` breaks | openapi-typescript supports TS 7 |
| `@types/node` | 24.x | types must match the Node runtime major (`engines`: 24), not the newest Node | the Node runtime moves |

Record any new exception in this table with its reason.

---

## 5. Upgrading

- **Dependabot** opens grouped PRs: minor + patch per ecosystem weekly, majors separately;
  GitHub Actions and Docker base images monthly. With exact pins, every bump is visible.
- **A major**: read the breaking changes, upgrade, fix, run `make check && make e2e` (plus
  `make test-db` for database crates), and note behaviour changes in the PR.
- **Watch points**:
  - `utoipa`: regenerate the spec (`make gen-api`) and review the `openapi.yaml` diff.
  - `openapi-typescript`, `typescript`: see §4; regenerate and review `schema.gen.ts`.
  - `tonic` / `prost` / `protox` / `tonic-prost-build`: codegen API moves between versions.
  - `sqlx`: query API (`SqlSafeStr` since 0.9) and TLS feature names.
  - `@tanstack/react-router`: search middleware, `SearchSchemaInput`, `Register` typing.
  - `tailwindcss`: token syntax in `tokens.css`, Prettier class sorting.
  - `oxlint`: new rules may flag existing code; fix the code, do not disable the rule casually.
  - `happy-dom`: test-DOM behaviour (viewport, `<dialog>`, `matchMedia`) used in `src/test/setup.ts`.

---

## 6. Inventory

### 6.1 Server

| Need | Crate | In |
| --- | --- | --- |
| HTTP server | `actix-web`, `actix-cors`, `actix-files` | app-http (+ app-server for the handle) |
| Request tracing, request id | `tracing-actix-web` | app-http |
| gRPC | `tonic`, `tonic-prost`, `prost`, `prost-types`, `tonic-health`, `tonic-reflection` | app-proto, app-grpc |
| Proto codegen without `protoc` | `protox`, `tonic-prost-build` (build) | app-proto |
| Database | `sqlx` (postgres, runtime-tokio, tls-rustls, uuid, chrono, migrate, macros) | app-db |
| Compile-time SQL string concat | `const_format` | app-db |
| In-process cache | `moka` (future) | app-cache |
| Async runtime | `tokio` | app-server (+ dev in others) |
| Async traits | `async-trait` | core, db, cache |
| Configuration | `figment` (env; `test` feature for `Jail`), `dotenvy` | app-common, app-server |
| CLI | `clap` (derive, env) | app-server |
| Serialisation | `serde`, `serde_json` | core, common, http |
| API schema | `utoipa` (actix_extras, uuid, chrono, yaml) | app-http |
| Ids and time | `uuid` (v7, serde), `chrono` (serde) | most crates |
| Errors | `thiserror` (libraries), `anyhow` (binary only) | |
| Logging | `tracing`, `tracing-subscriber` (env-filter, json) | all / app-common |
| Metrics | `metrics`, `metrics-exporter-prometheus` | app-http, app-server |

### 6.2 Web: runtime (6 packages)

| Need | Package |
| --- | --- |
| UI | `react`, `react-dom` |
| Routing | `@tanstack/react-router` |
| Server state | `@tanstack/react-query` |
| Client state | `zustand` |
| Typed HTTP client | `openapi-fetch` |

Everything else at runtime (class names, variants, search validation, toasts, dialogs,
formatting, icons, fonts) is our own code.

### 6.3 Web: development

| Need | Package |
| --- | --- |
| Build, dev server | `vite`, `@vitejs/plugin-react` |
| Styling | `tailwindcss`, `@tailwindcss/vite` |
| Types | `typescript` (6.x), `@types/node` (24.x), `@types/react`, `@types/react-dom` |
| API types | `openapi-typescript` |
| Unit / DOM tests | `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` |
| E2E | `@playwright/test` |
| Lint, format | `oxlint`, `prettier`, `prettier-plugin-tailwindcss` |

### 6.4 Not used, and what we do instead

| Not used | Instead |
| --- | --- |
| UI kits (MUI, Chakra, Mantine, Radix/shadcn kits, Headless UI) | `components/ui` on our tokens |
| `clsx`, `classnames`, `tailwind-merge` | `cn()`; components avoid class conflicts by design |
| `class-variance-authority` | `variants()` |
| zod, valibot, yup | domain validation on the server; small typed validators on the web |
| Axios, ky | `openapi-fetch` (typed from the contract) |
| Redux, Jotai, context stores | Zustand for preferences, TanStack Query for server data |
| moment, date-fns, dayjs | `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` |
| focus-trap, popover libraries | native `<dialog>`, top layer |
| icon packages, icon fonts | generated inline SVG |
| Google Fonts at runtime | self-hosted (`gen:fonts`) |
| MSW | `src/test/mock-api.ts` |
| jsdom | happy-dom (faster) |
| ESLint | oxlint (much faster; react, a11y, import, vitest rules) |
| ORMs (diesel, sea-orm) | sqlx with explicit SQL |
| `protoc` | protox |

---

## 7. Removing

Remove a dependency in the same change that removes its last use (`cargo remove`, `pnpm remove`),
then `make check`. When replacing a package with our own code, add tests that cover what we relied
on and note the replacement in §1.

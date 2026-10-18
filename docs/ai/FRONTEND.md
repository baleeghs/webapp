# Frontend guide (`web/`)

Everything you need to build UI in this repository: structure and import rules, routing, data
fetching, state, forms, components, styling, accessibility, testing and tooling. Visual rules
(tokens, palettes, density) are in [DESIGN.md](DESIGN.md); runtime flow is in
[ARCHITECTURE.md](ARCHITECTURE.md) §6; recipes are in [CLAUDE.md](CLAUDE.md) §3.

---

## 1. Toolchain

| Tool | Version line | Role |
| --- | --- | --- |
| Node | 24 (`engines`; `engineStrict` in `pnpm-workspace.yaml`) | runtime for tooling and `gen/*.mts` (native type stripping) |
| pnpm settings | `web/pnpm-workspace.yaml` | `saveExact`, `engineStrict`, `onlyBuiltDependencies: []`, peer rules |
| pnpm | `packageManager` in `package.json` | installs; never npm/yarn |
| Vite 8 (rolldown) | `vite.config.ts` | dev server (`:5173`, proxies `/api` to the server), build into `../server/static` (served by the server at `/`), `resolve.tsconfigPaths` for `@/` |
| TypeScript 6 | `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.e2e.json` | strict; `tsc -b` type-checks all three. Not 7: openapi-typescript needs the JS API 7 drops |
| React 19 | | `<title>` in components is hoisted to `<head>` |
| Tailwind CSS 4 | `@tailwindcss/vite`, CSS-first config in `src/styles` | |
| Vitest 5 + happy-dom | `vitest.config.ts` (projects `unit`, `dom`) | |
| Playwright | `playwright.config.ts` | Chromium, starts `pnpm dev` |
| oxlint | `.oxlintrc.json` | react, typescript, import, jsx-a11y, vitest plugins; `--deny-warnings` |
| Prettier | `.prettierrc` (120 cols, single quotes, Tailwind class sorting) | |

TypeScript strictness worth knowing: `noUncheckedIndexedAccess` (array/record access may be
`undefined`), `exactOptionalPropertyTypes` (`prop?: string` does not accept `undefined`; spread
conditionally: `{...(x && { x })}`), `noPropertyAccessFromIndexSignature` (use `obj['key']`),
`erasableSyntaxOnly` (no enums, namespaces, parameter properties).

---

## 2. Structure and import rules

```
src/
├── main.tsx                 entry: chunk recovery, QueryClient, router, providers
├── app/                     app-level wiring (not reusable elsewhere)
│   ├── providers.tsx        QueryClientProvider, AppearanceSync, Toaster
│   ├── query-client.ts      defaults, retry policy, mutation error toasts, typed meta
│   ├── app-root.tsx         root route component: progress bar + AppShell + Outlet
│   ├── navigation-progress.tsx, route-pending.tsx, preload-recovery.ts
├── routes/
│   ├── router.ts            route tree, loaders, lazy pages, router options, Register
│   └── search.ts            search-param validators + helpers + defaults
├── pages/<page>/            one folder per route: composes features, owns page layout
├── features/<feature>/      a vertical slice of product behaviour (see §3)
├── components/
│   ├── ui/                  design system (actions, forms, feedback, overlays, surfaces, data-display, navigation, primitives, styles)
│   ├── layout/              AppShell, Sidebar, Topbar, PageHeader, PageBody, HealthIndicator, ThemeToggle
│   ├── icons/               Icon + generated svg.ts
│   ├── errors/              RouteError (router default error component)
│   └── brand/               Logo, APP_NAME
├── lib/                     framework-free helpers (cn, format, time, appearance, clipboard) and lib/api
├── stores/                  Zustand stores (client-only state)
├── styles/                  CSS (DESIGN.md)
└── test/                    setup, in-house fake API (fetch mock), fixtures, renderApp
```

**Allowed imports** (→ = may import):

```
pages ──► features ──► components ──► lib
  │          │             │
  │          └──► stores   └──► stores (layout only)
  └──► components, lib, stores
app ──► everything it wires;  routes ──► app, pages (lazy), features (query options), components/errors
```

- Never import a page from a feature, a feature from a component, or one feature's internals from
  another. Cross-feature use goes through the other feature's `index.ts`; if two features need
  the same thing, move it down to `components/` or `lib/`.
- Use `@/…` for imports outside the current folder; relative imports inside a feature.
- Import UI only from `@/components/ui` (the barrel), never `@/components/ui/forms/input`.

---

## 3. Features

A feature is a vertical slice, e.g. `features/notes/`:

```
features/notes/
├── api/types.ts          export type Note = Schema<'NoteDto'>; …
├── api/keys.ts           notesKeys.all / lists() / list(page) / detail(id)
├── api/queries.ts        notesListQuery, noteQuery, useCreateNote, useUpdateNote, useDeleteNote
├── components/           NoteForm, NoteList, CreateNoteDialog
├── lib/validation.ts     client-side rules mirroring the server (+ validation.test.ts)
└── index.ts              the public API: everything others may use, nothing more
```

Other features of note: `appearance` (theme, palette with live previews, density),
`settings` (`SettingRow`, `SettingsGrid` building blocks).

---

## 4. Routing

`routes/router.ts` is code-based TanStack Router:

```ts
const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notes',
  validateSearch: validateNotesSearch,                                  // in-house, typed + defaulted
  search: { middlewares: [stripSearchParams(NOTES_SEARCH_DEFAULTS)] },  // /notes, not /notes?page=1
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(notesListQuery(deps.page)),
  component: lazyRouteComponent(() => import('@/pages/notes/notes-page'), 'NotesPage'),
});
```

- Every page is lazy (its own chunk). Loaders prefetch, so code and data load in parallel.
- Router defaults: `defaultPreload: 'intent'` (hovering a link loads it), `defaultPreloadStaleTime: 0`
  (Query decides freshness), `defaultPendingComponent: RoutePending`,
  `defaultErrorComponent: RouteError`, scroll restoration.
- Read params and search in pages with `getRouteApi('/notes')` → `route.useSearch()`,
  `route.useParams()`, `route.useNavigate()`.
- Links are typed: `<Link to="/notes/$noteId" params={{ noteId }} />`; a wrong path or missing
  param is a compile error.
- Search validators are plain functions in `routes/search.ts`. They must never throw: invalid
  values fall back to defaults (`positiveInt(value, 1)`, `oneOf(value, allowed, fallback)`).
  Type the parameter as `{ page?: number } & SearchSchemaInput` so links may omit the params:

  ```ts
  export function validateNotesSearch(search: { page?: number } & SearchSchemaInput): NotesSearch {
    return { page: positiveInt(search.page, NOTES_SEARCH_DEFAULTS.page) };
  }
  ```
- `stripSearchParams(defaults)` keeps default values out of URLs.

---

## 5. Data fetching

### 5.1 The client

```ts
import { api, unwrap } from '@/lib/api/client';
const page = await unwrap(api.GET('/api/v1/notes', { params: { query: { limit: 20, offset: 0 } }, signal }));
```

- `api` is `openapi-fetch` typed with `paths` from `schema.gen.ts`: paths, params, bodies and
  responses are checked against the server contract.
- `unwrap` returns `data` or throws `ApiError` (network failures become `status: 0`,
  `code: 'network_error'`).
- `ApiError`: `status`, `code` (`not_found`, `validation_failed`, `conflict`, `unavailable`,
  `internal`, `network_error`, `unknown`), `message` (user-facing), `details` (field errors),
  `requestId`, `isRetryable`, `fieldErrors()`. `errorMessage(e)` gives a message for anything thrown.
- Types: `Schema<'NoteDto'>` from `@/lib/api/types`; alias them in `features/<x>/api/types.ts`.

### 5.2 Queries

```ts
export function notesListQuery(page: number) {
  return queryOptions({
    queryKey: notesKeys.list(page),
    queryFn: ({ signal }) => unwrap(api.GET('/api/v1/notes', { params: { query: { … } }, signal })),
  });
}
```

- Factories, not hooks: the same object feeds loaders (`ensureQueryData`), components
  (`useSuspenseQuery` / `useQuery`) and invalidation.
- Pass `signal` so navigation cancels in-flight requests.
- In route pages use `useSuspenseQuery` (data guaranteed by the loader; errors go to `RouteError`).
  For secondary widgets that should fail softly, use `useQuery` and render
  `Skeleton` / `ErrorState` / `Badge` inline (see `pages/home/home-page.tsx`).
- Keys are hierarchical: `['notes']` ⊃ `['notes','list']` ⊃ `['notes','list',{page}]`;
  `['notes','detail',id]`.

### 5.3 Mutations

```ts
export function useUpdateNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateNoteInput) => unwrap(api.PATCH('/api/v1/notes/{id}', { params: { path: { id } }, body })),
    meta: { toastOnError: false },                 // the form shows errors itself
    onSuccess: async (note) => {
      queryClient.setQueryData(notesKeys.detail(id), note);           // instant detail update
      await queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
    },
  });
}
```

- Success: write the returned entity into the detail cache, invalidate lists.
- Delete: `removeQueries` for the detail, invalidate lists, then navigate.
- Per-call reactions (toast, close dialog, navigate) go in `mutate(vars, { onSuccess })` at the
  call site, not in the hook.
- Global behaviour (`app/query-client.ts`): queries `staleTime` 30 s, retries via
  `lib/api/retry.ts`; mutations never retry; failed mutations toast unless
  `meta.toastOnError === false` (typed through the `Register` augmentation).

---

## 6. State

| Kind | Where | Example |
| --- | --- | --- |
| Server data | TanStack Query | notes |
| Shareable view state | search params | `?page=2` |
| Client preferences | `stores/ui-store.ts` (persisted as `app.ui`) | theme, palette, density, sidebar collapse |
| Ephemeral app UI | `stores/ui-store.ts` (not persisted) | mobile drawer open |
| Notifications | `useToastStore` via `toast.success/error/info` | |
| Local UI | `useState` | dialog open, form values |

Rules: select narrowly (`useUiStore((s) => s.palette)`), never put server data in Zustand, and
when you add a persisted field, add it to `partialize` and, if it affects first paint, to
`public/theme-init.js`.

---

## 7. Pages and layout

```tsx
export function NotesPage() {
  return (
    <>
      <PageHeader title="Notes" description="…" actions={<Button variant="primary" icon="PLUS">New note</Button>} />
      <PageBody>{/* sections, gap = --app-section-gap */}</PageBody>
    </>
  );
}
```

- `PageHeader` renders the H1, sets the document title (`<title>Notes · App</title>`), and wraps
  actions under the title on narrow screens.
- `PageBody` pads to the page gutter, caps width on ultrawide screens and is a container
  (`@container`), so children can adapt with `@md:` / `@3xl:` variants to the space they actually have.
- Forms that read best narrow use `.app-form` (45rem); settings-style pages use the full width.
- `AppShell`: sidebar (collapsible icon rail from `md`, remembered; drawer below `md`), top bar
  (toggle, health dot, theme toggle), scrolling `<main id="main">`, skip link.
  **Ctrl/⌘+B** toggles the sidebar (ignored while typing).

---

## 8. Forms

```tsx
<form noValidate onSubmit={submit} className="app-form flex flex-col gap-4">
  <Field label="Title" error={errors.title ?? serverFields['title']}>
    {(props) => <Input {...props} value={values.title} onChange={(e) => …} />}
  </Field>
  <Button type="submit" variant="primary" loading={mutation.isPending}>Save</Button>
</form>
```

- `Field` wires `id`, `aria-invalid`, `aria-describedby`, hint and error (`role="alert"`).
- Validate on submit with the feature's pure `validate…` function (mirrors server limits); show
  server field errors from `ApiError.fieldErrors()`; show other errors as a form-level message.
- Disable submit while pending (`loading`), keep the user's input on failure.
- In a `Dialog`, mark the first field with `data-autofocus` for initial focus.

---

## 9. Components (`@/components/ui`)

| Folder | Components |
| --- | --- |
| actions | `Button` (`variant`: primary, secondary, ghost, danger; `size`: sm, md; `icon`, `loading`), `IconButton` (label required), `buttonVariants` (style a `Link` as a button) |
| forms | `Field`, `Input`, `Textarea`, `RadioGroup` (segmented; `label` or `labelledBy`) |
| feedback | `Spinner`, `Skeleton`, `EmptyState`, `ErrorState` (shows request id, retry), `toast`, `Toaster` |
| overlays | `Dialog` (native `<dialog>`), `ConfirmDialog` |
| surfaces | `Panel` (card with header/actions/footer) |
| data-display | `Badge` (tones), `RelativeTime` |
| navigation | `Pagination` |
| primitives | `VisuallyHidden` |
| styles | `control`, `controlHeight` recipes |

Other shared components: `Icon` (`name`, `size` xs…2xl, `filled`, `label`), `Logo`
(`withName`, `animation`, `markClassName`), `RouteError`.

Writing a component:
- Props interface named `<Component>Props`; accept `className` and merge with `cn()`.
- Variants with `variants(base, { variant: {...}, size: {...} }, defaults)` from `@/lib/variants`
  (typed; `VariantProps<typeof x>` for props). If exported, put it in its own `*-variants.ts`
  (React Fast Refresh needs component-only modules).
- `cn()` only joins classes; it does not resolve Tailwind conflicts. Never hard-code a value a
  caller is expected to override (e.g. `Skeleton` has no built-in height): expose a prop or variant.
- Use tokens for every colour, size, radius, shadow and z-index.
- Export it from the folder `index.ts`.

---

## 10. Accessibility

- Real elements first: `<button>` for actions, `<a>`/`Link` for navigation, `<label>` + native
  inputs, `<dialog>` for modals, native radios for single choice (arrow keys for free).
- Every interactive element has an accessible name; icon-only ones via `IconButton`'s `label`.
- Decorative visuals are `aria-hidden` (icons next to text, palette previews).
- Focus is always visible (`:focus-visible` ring, `.focus-ring`, `has-focus-visible:` on
  labels around hidden radios). Never remove outlines without a replacement.
- Colour is never the only signal; status uses text or icons too.
- Respect `prefers-reduced-motion` (durations collapse to 0, logo animation stops).
- Status text that changes dynamically uses `role="status"`/`alert`; static text does not.
- oxlint `jsx-a11y` runs in CI; Testing Library queries by role/label double as a11y checks.

---

## 11. Testing

### 11.1 Unit (`*.test.ts`, Node)

Pure logic: `lib/`, feature `lib/`, schemas, retry policy, CSS guards. No DOM, fast.

### 11.2 DOM (`*.dom.test.tsx`, happy-dom + fake API)

```tsx
const { user, router } = renderApp('/notes');                    // real router, providers, pages
await user.click((await screen.findAllByRole('button', { name: 'New note' }))[0]!);
await user.type(screen.getByLabelText('Title'), 'Groceries');
expect(await screen.findByRole('link', { name: /Groceries/ })).toBeInTheDocument();
expect(db.notes).toHaveLength(1);                                  // the fake API's state
```

- `src/test/mock-api.ts`: an in-house fake of the HTTP API installed as `globalThis.fetch`, with
  the same status codes and error envelope as the server. A tiny router: `route(method, path,
  handler)` with `:params`, helpers `json(body, init)` and `noContent()`.
- Seed with `db.notes = [makeNote(...)]`; override per test with
  `server.use(route('GET', '/api/v1/notes', () => json({ error: {...} }, { status: 503 })))`.
- A request no route handles **fails the test** after it ends ("Requests with no mock route"),
  even if the code swallowed the error.
- `setup.ts` resets the fake API, its data, localStorage and UI store state after each test, and
  fills test-DOM gaps (`matchMedia`, `<dialog>`, `scrollTo`). happy-dom's window is 1024 px wide,
  so desktop (`md`+) behaviour applies by default.
- Query by role, label and text; avoid test ids except for layout hooks.

### 11.3 End to end (`web/e2e`, Playwright)

- `import { test, expect } from './app'`: the `api` fixture is automatic and mocks the API at the
  network layer (`api.seed('Title')`, `api.notes`).
- `layout.spec.ts` checks every page in `pages.ts` at four viewports for horizontal overflow,
  the phone drawer, and the desktop rail.
- `notes.spec.ts` covers create → edit → delete, deep links on reload, theme persistence.
- Add new pages to `e2e/pages.ts`; add flows for anything multi-step.

---

## 12. Generated files

| File | Regenerate with | Checked by |
| --- | --- | --- |
| `src/lib/api/schema.gen.ts` | `make gen-api` | `pnpm check:api` |
| `src/styles/themes/palettes.gen.css`, `src/lib/palettes.gen.ts` | edit `gen/palettes.mts`, `pnpm gen:palettes` | `pnpm check:palettes`, `styles/palettes.test.ts` |
| `src/components/icons/svg.ts` | add to `ICON_MAP` in `gen/icons.mts`, `pnpm gen:icons` | – |
| `src/styles/fonts/*` | edit `gen/fonts.mts`, `pnpm gen:fonts` | – |

All are excluded from Prettier and oxlint, and committed.

---

## 13. Performance

- Pages are lazy chunks; libraries split into `react` and `vendor` chunks for long-term caching.
- Budgets (gzip): 100 kB per chunk, 250 kB total JS, 40 kB CSS; CI fails above them. Current:
  about 127 kB JS and 19 kB CSS (the 16 palettes are most of the CSS).
- Prefer writing small helpers over adding packages, lazy-load heavy, rarely used UI (charts, editors), and
  check `pnpm build` output when adding a package.
- After a deploy, `preload-recovery.ts` reloads once if an old chunk is gone.

---

## 14. Common pitfalls

- `autoFocus` inside a `Dialog`: use `data-autofocus`.
- Importing `@playwright/test`'s `test` in E2E instead of `./app`: requests escape to the proxy.
- Reading `routeTree.children[i].path` in tests: paths are resolved on router init; read
  `options.path`.
- Passing `undefined` to an optional prop under `exactOptionalPropertyTypes`: spread conditionally.
- A component file exporting constants (Fast Refresh warning): move them out.
- Forgetting to add a page to the sidebar, `e2e/pages.ts` and `routes/router.test.ts`.

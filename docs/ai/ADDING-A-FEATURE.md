# Adding a feature

A worked recipe, using a hypothetical `projects` feature. At every step, the `notes` files named
in brackets are the reference to copy.

## 1. Database

```sh
make migration name=create_projects
```

Write the `up` and `down` SQL following [database/SCHEMA.md](../database/SCHEMA.md).
[`migrations/*_create_notes.*.sql`]

## 2. Domain (`app-core`)

Create `src/projects/` with `model.rs` (types + `validate`), `repository.rs` (trait),
`service.rs` (operations, returns `CoreResult`), `memory.rs` (in-memory repo for tests), `mod.rs`.
Export it from `lib.rs`. Write the service's unit tests now. [`app-core/src/notes/`]

## 3. Storage (`app-db`)

`src/projects.rs` with a `FromRow` row struct and `PgProjectRepository` implementing the trait;
map errors with `map_err`. Add `#[sqlx::test]` tests in `tests/`. [`app-db/src/notes.rs`]

Optional: a caching decorator in `app-cache`. [`app-cache/src/notes.rs`]

## 4. Wiring (`app-server`)

Add the service to `Services` in `src/app.rs` and build it in **both** branches of
`Storage::services` (Postgres, with an optional cache decorator, and in-memory, so the server
still runs without a database). Then add it to `AppState` (`app-http/src/state.rs`) and
`GrpcState` (`app-grpc/src/lib.rs`).

## 5. HTTP (`app-http`)

`src/modules/projects/{mod.rs, handlers.rs, dto.rs}`; call its `routes` from `server::routes`
under the `/v1` scope; list the handlers in `openapi.rs`. Add cases to `tests/api.rs`.
[`app-http/src/modules/notes/`]

```sh
make gen-api   # updates server/openapi.yaml and web/src/lib/api/schema.gen.ts
```

## 6. gRPC (optional, `app-grpc`)

`server/proto/app/v1/projects.proto`, add it to `PROTOS` in `app-proto/build.rs`, implement the
service in `app-grpc/src/projects.rs`, register it in `serve`. [`notes.proto`, `app-grpc/src/notes.rs`]

## 7. Web feature

`web/src/features/projects/`: `api/{types,keys,queries}.ts`, `components/`, `lib/` (pure logic
with `*.test.ts`), and `index.ts` exporting the public API. [`features/notes/`]

## 8. Pages and routes

`web/src/pages/projects/projects-page.tsx` (+ detail page), routes with loaders in
`routes/router.ts`, a sidebar entry, `e2e/pages.ts` entry, fake-API routes in `test/mock-api.ts`, and
DOM tests with `renderApp`. [`pages/notes/`]

## 9. Finish

```sh
make check && make e2e
```

Update the table in [database/SCHEMA.md](../database/SCHEMA.md) and anything else in `docs/`
your feature changed.

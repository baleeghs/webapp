# Backend guide (`server/`)

Everything you need to write Rust in this repository: where code goes, the rules each layer
follows, how to write each kind of component with examples from the notes feature, testing,
observability and tooling. The crate map and runtime behaviour are in
[ARCHITECTURE.md](ARCHITECTURE.md); step-by-step recipes are in [CLAUDE.md](CLAUDE.md) §3.

---

## 1. Workspace layout

```
server/
├── Cargo.toml           virtual workspace: members = crates/*, shared [workspace.lints], release profile
├── Cargo.lock           committed; CI and Docker build with --locked
├── clippy.toml          test relaxations, doc-valid-idents
├── rustfmt.toml         max_width = 120, use_small_heuristics = "Max"
├── rust-toolchain.toml  stable + rustfmt + clippy
├── openapi.yaml         GENERATED (make gen-api)
├── migrations/          <timestamp>_<name>.up.sql / .down.sql
├── proto/app/v1/        protobuf contracts
└── crates/
    ├── app-core   app-common   app-db   app-cache
    ├── app-proto  app-http     app-grpc app-server
```

Every crate's `Cargo.toml` inherits `version`, `edition`, `publish` and `[lints] workspace = true`.
New crate: `cargo new --lib --vcs none crates/app-<name>`, then copy that header from an
existing crate.

---

## 2. Where code goes

| You are writing… | Crate / file |
| --- | --- |
| A domain type, invariant or validation rule | `app-core/src/<feature>/model.rs` |
| A business operation | `app-core/src/<feature>/service.rs` |
| A storage interface | `app-core/src/<feature>/repository.rs` (trait) |
| An in-memory implementation (tests, no-DB mode) | `app-core/src/<feature>/memory.rs` (feature `memory`) |
| SQL | `app-db/src/<feature>.rs` |
| Caching | `app-cache/src/<feature>.rs` (decorator over the trait) |
| HTTP endpoint | `app-http/src/modules/<feature>/{mod,handlers,dto}.rs` |
| gRPC method | `server/proto/app/v1/<feature>.proto` + `app-grpc/src/<feature>.rs` |
| A setting | `app-common/src/config.rs` + `.env.example` (+ `app-server/src/cli.rs` for a flag) |
| Middleware | `app-http/src/middleware.rs`, wired in `app-http/src/server.rs` |
| Wiring, storage choice, lifecycle | `app-server/src/app.rs` |
| A call to an external service | new adapter crate implementing an `app-core` trait |
| A readiness dependency | type implementing `app_core::health::HealthCheck` |

---

## 3. The domain layer (`app-core`)

### 3.1 Rules

- **Pure**: no actix, tonic, sqlx, moka, env vars, files or network. `chrono::Utc::now()` and
  `Uuid::now_v7()` are the only "outside world" calls, and only in services.
- Owns **validation**. Inputs (`NewNote`, `NoteChanges`) have `validate(self) -> Result<Self, Vec<FieldError>>`
  that normalises (trims) and reports **every** invalid field, not just the first.
- Services return `CoreResult<T>`; they turn "missing" (`Option::None`, `false`) into
  `CoreError::not_found("note", id)`.
- Services assign identity and time: ids are UUIDv7 (sortable by creation), `created_at` /
  `updated_at` set by the service, so every storage behaves the same.
- Services hold `Arc<dyn Repository>`, so the wiring decides Postgres, cached Postgres or memory.

### 3.2 Model example

```rust
pub const TITLE_MAX_CHARS: usize = 200;

impl NewNote {
    pub fn validate(self) -> Result<Self, Vec<FieldError>> {
        let mut errors = Vec::new();
        let title = validate_title(&self.title, &mut errors);   // trims, checks 1..=200 chars
        validate_body(&self.body, &mut errors);
        if errors.is_empty() { Ok(Self { title, body: self.body }) } else { Err(errors) }
    }
}
```

### 3.3 Service example

```rust
#[tracing::instrument(skip(self, changes))]
pub async fn update(&self, id: Uuid, changes: NoteChanges) -> CoreResult<Note> {
    let changes = changes.validate().map_err(CoreError::Validation)?;
    if changes.is_empty() {
        return self.get(id).await;                      // no-op update returns the current state
    }
    self.repo.update(id, &changes, Utc::now()).await?.ok_or_else(|| CoreError::not_found(ENTITY, id))
}
```

### 3.4 Errors

| Variant | Use when | HTTP | gRPC |
| --- | --- | --- | --- |
| `NotFound { entity, id }` | the addressed thing does not exist | 404 | `NOT_FOUND` |
| `Validation(Vec<FieldError>)` | input breaks a rule | 400 | `INVALID_ARGUMENT` |
| `Conflict(String)` | uniqueness or state conflict | 409 | `ALREADY_EXISTS` |
| `Unavailable(String)` | a dependency is down or timed out; retry may succeed | 503 | `UNAVAILABLE` |
| `Internal(String)` | a bug or an unexpected failure | 500 | `INTERNAL` |

`code()` gives the stable API code (`not_found`, `validation_failed`, …); `public_message()`
hides `Internal` details. Adding a variant forces a decision in `app-http/src/error.rs` and
`app-grpc/src/error.rs` because both matches are exhaustive: keep it that way (no `_ =>` arms).

### 3.5 Pagination

`PageRequest::new(limit, offset)` clamps `limit` to 1..=100 (default 20). Repositories return
`Page<T> { items, total, limit, offset }`; `Page::map` converts the item type. For very large or
hot tables, add a keyset variant (`after: Option<Uuid>`) for that endpoint rather than changing
the shared type.

---

## 4. Storage adapters

### 4.1 Postgres (`app-db`)

- One file per feature: a private `XRow` (`#[derive(FromRow)]`), `From<XRow> for X`, and
  `PgXRepository { pool: PgPool }` implementing the trait.
- Runtime-checked queries (`sqlx::query_as::<_, XRow>(SQL)`) so the crate builds without a
  database. Build column lists once with `const_format::concatcp!` and select explicit columns,
  never `*`.
- One statement per operation where possible (`UPDATE … SET col = COALESCE($2, col) … RETURNING`).
  Use a transaction (`pool.begin()`) when an operation spans statements.
- Map every error with `error::map_err`: pool timeout / IO → `Unavailable`, unique violation →
  `Conflict`, the rest → `Internal` (logged at `error`).
- Convert unsigned ↔ signed explicitly (`i64::try_from(page.offset).unwrap_or(i64::MAX)`), never `as`.
- Tests: `tests/<feature>_repository.rs` with `#[sqlx::test(migrator = "app_db::MIGRATOR")]` and
  ``#[ignore = "needs Postgres: run `make test-db`"]``. Each test gets a fresh database.

### 4.2 Caching (`app-cache`)

Decorators implement the same trait and wrap the inner repository:

```rust
async fn get(&self, id: Uuid) -> CoreResult<Option<Note>> {
    if let Some(note) = self.cache.get(&id).await { return Ok(Some(Note::clone(&note))); }
    let note = self.inner.get(id).await?;
    if let Some(note) = &note { self.cache.insert(id, Arc::new(note.clone())).await; }
    Ok(note)
}
async fn update(&self, …) -> … {
    self.cache.invalidate(&id).await;
    let r = self.inner.update(…).await;
    self.cache.invalidate(&id).await;
    r
}
```

Evict before **and** after the write. Even so, a read that fetched the old row just before the
write commits can re-insert it, so readers may see the previous version for up to the TTL; the
cache is also per process, so other replicas keep their copy until it expires. Use a decorator
only where that bound is acceptable (read-heavy, tolerant data), never for read-your-writes flows,
and do not cache lists unless you can invalidate every page correctly. For stricter guarantees use
a shared, versioned cache behind the same trait.

### 4.3 In-memory (`app-core` feature `memory`)

`InMemoryNoteRepository` uses `RwLock<Vec<Note>>` and mirrors the Postgres semantics (newest
first, same pagination). It serves tests in every crate (`cargo add -p <crate> --dev --path
crates/app-core -F memory`) and the database-less server mode. Keep it behaviourally identical
to the SQL implementation; the service tests run against it.

---

## 5. HTTP (`app-http`)

### 5.1 Module shape

```
modules/<feature>/
├── mod.rs        pub fn routes(cfg: &mut web::ServiceConfig): resources and methods
├── handlers.rs   one async fn per endpoint, each with #[utoipa::path]
└── dto.rs        wire types + From conversions
```

Mount it in `server::routes` inside the `/api` → `/v1` scope and add the handlers to
`openapi.rs` `paths(...)`.

### 5.2 DTO rules

- Responses: `#[derive(Serialize, ToSchema)] #[serde(rename_all = "camelCase")]`.
- Requests: `#[derive(Deserialize, ToSchema)] #[serde(rename_all = "camelCase", deny_unknown_fields)]`.
- Partial updates: `Option<T>` fields; `None` (omitted or `null`) means unchanged.
- Query params: `#[derive(Deserialize, IntoParams)] #[into_params(parameter_in = Query)]`, with
  doc comments (they become OpenAPI descriptions).
- Conversions: `impl From<Note> for NoteDto`, `impl From<CreateNoteRequest> for NewNote`.

### 5.3 Handler rules

```rust
#[utoipa::path(
    post, path = "/api/v1/notes", tag = "notes",
    request_body = CreateNoteRequest,
    responses(
        (status = 201, description = "Created", body = NoteDto),
        (status = 400, description = "Invalid input", body = ErrorBody),
    )
)]
pub async fn create_note(state: web::Data<AppState>, body: web::Json<CreateNoteRequest>) -> ApiResult<HttpResponse> {
    let note = state.notes.create(body.into_inner().into()).await?;
    Ok(HttpResponse::Created()
        .insert_header((header::LOCATION, format!("/api/v1/notes/{}", note.id)))
        .json(NoteDto::from(note)))
}
```

- Return `ApiResult<T>`; `?` converts `CoreError` into `ApiError`.
- Every response has a `description` and, for errors, `body = ErrorBody`.
- `201` + `Location` for creation, `204` for deletion, `200` otherwise.
- Never format error JSON by hand; never return a status code that bypasses `ApiError`.

### 5.4 The error envelope

```json
{ "error": { "code": "validation_failed", "message": "validation failed",
             "details": [{ "field": "title", "message": "must not be empty" }] } }
```

Extractor failures (malformed JSON, unknown field, bad UUID in the path, bad query) use the same
envelope with `field` = `body`, `path` or `query`. Unknown `/api/*` routes return
`not_found` JSON. **Every nested scope needs `.default_service(web::to(api_not_found))`**; actix
scopes do not inherit their parent's default.

### 5.5 Middleware

Written with `actix_web::middleware::from_fn` in `middleware.rs`. In `build_server`, `wrap` order
is reversed (last added runs first); the current order is documented there:
`TracingLogger → request_id → metrics → CORS → static cache headers → security headers → Compress`.
Label metrics by `match_pattern()` (route template), never the raw path (unbounded cardinality).

### 5.6 OpenAPI

`openapi.rs` lists paths, extra components and tags. `spec()` is served at `/api/openapi.json`;
`spec_yaml()` is what `app-server openapi` prints. `tests/openapi.rs` fails when
`server/openapi.yaml` differs; regenerate with `make gen-api`.

---

## 6. gRPC (`app-grpc`, `app-proto`)

- Proto style: package `app.v1`, one service per file, `google.protobuf.Timestamp` for times,
  `optional` for partial updates, request/response message per RPC, comments on every message.
- Never renumber or reuse a field number; `reserved` removed ones.
- Implementation: `#[tonic::async_trait] impl pb::x_service_server::XService for GrpcXService`;
  convert with local functions (`to_pb`): the orphan rule forbids `From` between two foreign types.
- Errors: `.map_err(status)` (exhaustive mapping), ids via `parse_id` (`INVALID_ARGUMENT`).
- Register in `lib.rs::serve` and mark it serving in the health reporter.
- Try it: `grpcurl -plaintext localhost:50052 list` then
  `grpcurl -plaintext -d '{"title":"hi"}' localhost:50052 app.v1.NoteService/CreateNote`.

---

## 7. Configuration

1. Field on the right struct in `app-common/src/config.rs` with a doc comment and
   `#[serde(default)]` on the struct.
2. Default in the `Default` impl. Defaults must work for local development with zero setup.
3. Validation in `AppConfig::validate` for anything that can be wrong or unsafe in production.
4. Test with `figment::Jail` (`jail.set_env("APP_X__Y", "…")`).
5. Document in `.env.example`.
6. Optional CLI flag via `ConfigOverrides` in `app-server/src/cli.rs` (global, so it works before
   or after the subcommand).

Precedence: CLI flag > `APP_*` environment (including `.env`) > defaults. `DATABASE_URL` wins over
`APP_DATABASE__URL`. Only `app-server` reads configuration; it passes the relevant sections down.

---

## 8. Observability

- **Logs**: `tracing`. Service methods: `#[tracing::instrument(skip(self, input))]`. Events with
  fields: `tracing::info!(note.id = %note.id, "note created")`. Levels: `error` = needs a human,
  `warn` = degraded but handled, `info` = lifecycle and business events, `debug` = diagnosis.
  JSON in production (`APP_LOG__FORMAT=json`); `RUST_LOG` overrides the filter.
- **Request ids**: generated per HTTP request by `tracing-actix-web`, present in the request span
  and returned as `x-request-id`; the web app shows it in error states.
- **Metrics**: `metrics` macros; exported at `/metrics`. Built in: `http_requests_total{method,route,status}`,
  `http_request_duration_seconds{method,route}`. Add domain metrics with
  `metrics::counter!("notes_created_total").increment(1)` and keep labels low-cardinality.
- **Health**: implement `HealthCheck` for each dependency the app cannot serve without; register
  it in `Storage::health_checks` (or alongside it). Keep checks fast and bounded.

---

## 9. Testing

| What | How | Example |
| --- | --- | --- |
| Validation and service logic | `#[tokio::test]` with `InMemoryNoteRepository` | `app-core/src/notes/service.rs` |
| Config | `figment::Jail::expect_with` | `app-common/src/config.rs` |
| HTTP contract | `test::init_service(App::new().configure(routes(state)))` | `app-http/tests/api.rs` |
| Middleware | wrap it in the test app | `responses_carry_a_request_id` |
| gRPC | call the service impl with `tonic::Request::new` | `app-grpc/src/notes.rs` |
| SQL | `#[sqlx::test]`, `#[ignore]` by default | `app-db/tests/notes_repository.rs` |
| Whole process | `run(...)` on free ports, real clients, then shutdown | `app-server/src/app.rs` |

Assert behaviour (status, JSON shape, error code), not implementation details. Each test builds
its own state; no shared globals. `unwrap`/`expect` are fine in tests (`clippy.toml`).

---

## 10. Lints and style

- Workspace lints: `unsafe_code = "forbid"`, `missing_debug_implementations`,
  `unused_qualifications`, clippy `all` + `pedantic` (with `module_name_repetitions`,
  `missing_errors_doc`, `missing_panics_doc`, `must_use_candidate` allowed), plus `unwrap_used`,
  `dbg_macro`, `todo`, `print_stdout` warnings. CI runs with `-D warnings`.
- Types that cannot derive `Debug` (they hold `dyn Trait`) implement it by hand with
  `finish_non_exhaustive()`.
- An exception is an item-level `#[allow(clippy::x)]` with a comment explaining why (see
  `app-grpc/src/error.rs`, `app-server/src/main.rs`).
- Formatting: `cargo fmt` (120 columns). Imports grouped std / external / crate by rustfmt.

---

## 11. Common pitfalls

- Forgetting `make gen-api` after touching a DTO or annotation (the OpenAPI test catches it).
- Adding a `_ =>` arm to a `CoreError` match: it silences the compiler exactly when a new variant
  needs a decision.
- Returning `HttpResponse::BadRequest()` from a handler instead of a `CoreError`: the client loses
  the envelope and code.
- Labelling metrics with ids or raw paths.
- Logging a whole `AppConfig` field that holds a secret without a redacting `Debug`.
- Using `query!` macros: they need a database at compile time; this repo uses runtime queries.
- Binding gRPC to 50051 on a Mac with Multipass installed.

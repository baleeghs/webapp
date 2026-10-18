# API conventions

The HTTP API is described by [server/openapi.yaml](../../server/openapi.yaml), generated from the
code (`make gen-api`); it is also served at `/api/openapi.json`. The gRPC API is in
[server/proto](../../server/proto).

## HTTP

- **Base path and versioning**: `/api/v1/…`. A breaking change gets `/api/v2` next to `v1`.
  Probes live at the root: `/healthz`, `/readyz`, `/metrics`.
- **JSON**: camelCase fields, RFC 3339 timestamps in UTC, UUIDs as strings. Unknown request
  fields are rejected (`deny_unknown_fields`) so typos fail loudly.
- **Methods**: `GET` list/read, `POST` create (`201` + `Location`), `PATCH` partial update
  (omitted fields unchanged), `DELETE` (`204`).
- **Pagination**: `?limit=` (1–100, default 20) and `?offset=`. Responses:
  `{ "items": [...], "total": 95, "limit": 20, "offset": 40 }`.
- **Request id**: every response has `x-request-id`; it is in every log line of that request.
  Quote it in bug reports.

### Errors

Every error uses one envelope:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "validation failed",
    "details": [{ "field": "title", "message": "must not be empty" }]
  }
}
```

Clients branch on `code` (stable), never on `message` (human-readable, may change).

| `code` | HTTP | gRPC | Meaning |
| --- | --- | --- | --- |
| `validation_failed` | 400 | `INVALID_ARGUMENT` | Input rejected; `details` lists fields. Also malformed JSON, query or path (`field`: `body`, `query`, `path`) |
| `not_found` | 404 | `NOT_FOUND` | No such resource, or no such endpoint |
| `conflict` | 409 | `ALREADY_EXISTS` | Violates a uniqueness rule |
| `unavailable` | 503 | `UNAVAILABLE` | A dependency is down; safe to retry with backoff |
| `internal` | 500 | `INTERNAL` | Bug or unexpected failure; details are only in server logs |

The mapping lives in `app-core/src/error.rs` (codes), `app-http/src/error.rs` and
`app-grpc/src/error.rs`. Adding a `CoreError` variant forces a decision in each (exhaustive
matches).

## gRPC

- Package per major version (`app.v1`), one file per service, `google.protobuf.Timestamp` for
  times. Never renumber or reuse a field number; reserve removed ones.
- Health: standard `grpc.health.v1.Health`. Reflection is on in development
  (`grpcurl -plaintext localhost:50052 list`) and off in the production image.

## Changing the API

1. Change the handler/DTO (or `.proto`).
2. `make gen-api` and commit `server/openapi.yaml` + `web/src/lib/api/schema.gen.ts`.
3. TypeScript now flags every web call site the change affects.
4. Additive changes are safe. For breaking ones, add a new version or migrate clients first.

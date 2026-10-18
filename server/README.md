# server

The Rust workspace: HTTP (actix-web) and gRPC (tonic) in one binary, Postgres via sqlx.
Conventions: [docs/ai/BACKEND.md](../docs/ai/BACKEND.md); crate map:
[docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md).

```sh
cargo run -p app-server              # serve (reads ../.env; in-memory without DATABASE_URL); also: migrate, openapi, --help
                                     # serves static/ (the web build, `make build-web`) at /, API at /api/v1/*
cargo run -p app-server -- --http-port=8443 --grpc-port=50051   # flags override APP_* variables
cargo test --workspace               # everything except Postgres tests
cargo test -p app-db -- --ignored    # Postgres tests (DATABASE_URL)
cargo clippy --workspace --all-targets -- -D warnings
sqlx migrate add -r --source migrations <name>
grpcurl -plaintext localhost:50052 list   # reflection is on in development
```

Add dependencies with `cargo add -p <crate> <dep>`; never edit versions by hand.

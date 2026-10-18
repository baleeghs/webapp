# One entry point for every routine task. `make` lists them. CI runs `make check`'s steps.
SHELL := /bin/bash
.DEFAULT_GOAL := help

SERVER := cd server &&
WEB := cd web &&

.PHONY: help
help: ## List targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

## ─── Setup ───────────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Install toolchains' dependencies and create .env
	@[ -f .env ] || cp .env.example .env
	$(WEB) pnpm install
	$(SERVER) cargo fetch
	$(WEB) pnpm e2e:install

## ─── Develop ─────────────────────────────────────────────────────────────────

.PHONY: dev dev-server dev-web db-up db-down db-reset
dev: ## Run the server and the web app (Ctrl-C stops both). In-memory storage unless DATABASE_URL is set
	@$(MAKE) -j2 dev-server dev-web

dev-server: ## Run the Rust server (HTTP :8080, gRPC :50052)
	$(SERVER) cargo run -p app-server

dev-web: ## Run the Vite dev server (:5173, proxies /api to :8080)
	$(WEB) pnpm dev

db-up: ## Start Postgres in Docker (then set DATABASE_URL in .env)
	docker compose up -d --wait postgres

db-down: ## Stop Postgres (data is kept)
	docker compose down

db-reset: ## Delete the database volume and start fresh
	docker compose down -v && $(MAKE) db-up

## ─── Database ────────────────────────────────────────────────────────────────

.PHONY: migrate migration
migrate: ## Apply pending migrations
	$(SERVER) cargo run -q -p app-server -- migrate

migration: ## Create a migration pair: make migration name=add_users
	@[ -n "$(name)" ] || (echo "usage: make migration name=<snake_case_name>" && exit 1)
	$(SERVER) sqlx migrate add -r --source migrations $(name)

## ─── Code generation ─────────────────────────────────────────────────────────

.PHONY: gen gen-api gen-palettes
gen: gen-api gen-palettes ## Run every generator whose output is committed

gen-api: ## Server annotations → server/openapi.yaml → web/src/lib/api/schema.gen.ts
	$(SERVER) cargo run -q -p app-server -- openapi > openapi.yaml
	$(WEB) pnpm gen:api

gen-palettes: ## web/gen/palettes.mts → palettes.gen.css + palettes.gen.ts (with contrast checks)
	$(WEB) pnpm gen:palettes

## ─── Quality ─────────────────────────────────────────────────────────────────

.PHONY: fmt lint test test-db e2e check
fmt: ## Format all code
	$(SERVER) cargo fmt --all
	$(WEB) pnpm format

lint: ## Lint and type-check everything
	$(SERVER) cargo clippy --workspace --all-targets --all-features -- -D warnings
	$(WEB) pnpm typecheck && pnpm lint

test: ## Unit and integration tests (no database needed)
	$(SERVER) cargo test --workspace
	$(WEB) pnpm test

test-db: ## Postgres integration tests (needs DATABASE_URL, e.g. after `make db-up`)
	$(SERVER) cargo test -p app-db -- --ignored

e2e: ## Browser tests (Playwright, mocked API)
	$(WEB) pnpm e2e

check: ## Everything CI checks, in CI's order
	$(SERVER) cargo fmt --all --check
	$(WEB) pnpm format:check
	$(MAKE) lint
	$(WEB) pnpm check:api && pnpm check:palettes
	$(MAKE) test
	./.github/scripts/check-hygiene.sh
	./.github/scripts/check-docs-links.sh

## ─── Build ───────────────────────────────────────────────────────────────────

.PHONY: build build-web start docker clean
build-web: ## Build the web app into server/static (served by the server at /)
	$(WEB) pnpm build

build: build-web ## Production build: server/static + server/target/release/app-server
	$(SERVER) cargo build --release -p app-server

start: build-web ## Build the UI and run the server serving it: everything on http://localhost:8080
	$(SERVER) cargo run -p app-server

docker: ## Build the production image (tag: app:local)
	docker build -t app:local .

clean: ## Remove build output
	$(SERVER) cargo clean
	rm -rf server/static web/dist web/coverage web/playwright-report web/test-results

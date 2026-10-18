# syntax=docker/dockerfile:1
# Production image: one static-ish binary serving the API (HTTP + gRPC) and the built web app.

# ── Web app ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS web
RUN corepack enable
WORKDIR /src/web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY web/ ./
# Writes the UI to /src/server/static (vite.config.ts outDir).
RUN pnpm build

# ── Server ───────────────────────────────────────────────────────────────────
FROM rust:1-slim-bookworm AS server
WORKDIR /src/server
COPY server/ ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/server/target \
    cargo build --release --locked -p app-server \
    && cp target/release/app-server /app-server

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=server /app-server /app/app-server
COPY --from=web /src/server/static /app/static
# The server serves /app/static (its default `static`, relative to WORKDIR) at `/`.
ENV APP_ENV=production \
    APP_LOG__FORMAT=json \
    APP_GRPC__REFLECTION=false
EXPOSE 8080 50052
USER nonroot
ENTRYPOINT ["/app/app-server"]
CMD ["serve"]

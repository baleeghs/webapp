# web

The React app. Conventions: [docs/ai/FRONTEND.md](../docs/ai/FRONTEND.md) and
[docs/ai/DESIGN.md](../docs/ai/DESIGN.md).

```sh
pnpm dev            # http://localhost:5173, proxies /api to the server on :8080
pnpm test           # unit (*.test.ts) and DOM (*.dom.test.tsx) tests
pnpm e2e            # Playwright (API mocked; no server needed)
pnpm typecheck && pnpm lint && pnpm format:check
pnpm build          # writes ../server/static, which the Rust server serves at / (make start)
pnpm gen:api        # API types from ../server/openapi.yaml (or `make gen-api` from the root)
pnpm gen:icons      # after adding an icon to gen/icons.mts
pnpm gen:fonts      # after changing fonts in gen/fonts.mts
pnpm gen:palettes   # after adding a palette to gen/palettes.mts
```

Add dependencies with `pnpm add <pkg>` / `pnpm add -D <pkg>`; never edit versions by hand.

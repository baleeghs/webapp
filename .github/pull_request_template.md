## What and why

<!-- What does this change, and why? Link the issue. -->

## How it was tested

<!-- Tests added or run, manual checks. Screenshots for UI changes. -->

## Checklist

- [ ] `make check` passes locally
- [ ] API changed? `make gen-api` run and `server/openapi.yaml` + `web/src/lib/api/schema.gen.ts` committed
- [ ] New migration? It is reversible (`.down.sql`) and safe to run on a live database
- [ ] Docs updated (`docs/`, `CLAUDE.md`) if conventions or setup changed

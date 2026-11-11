# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

req-inspect is an in-process HTTP request inspector: mount one middleware and browse every request/response (and the database calls made while handling it) live in a dashboard at `/_inspect`. Bun workspaces monorepo; published packages are `@req-inspect/core`, `@req-inspect/express`, `@req-inspect/pg`, `@req-inspect/mongodb`. `CONTRIBUTING.md` has the layer table, adapter contract and DB-integration contract in full — read it before changing package boundaries.

## Commands

On this Windows machine Bun is not on PATH in Git Bash: prefix commands with `export PATH="$HOME/.bun/bin:$PATH";`.

```sh
bun install
bun run build            # core → dashboard (into packages/core/dist/ui) → express → pg → mongodb; required before tests
bun run lint             # ESLint strictTypeChecked + layer boundaries
bun run format:check     # Prettier (bun run format to fix)
bun run typecheck        # tsc per package
bun test packages/*/test # unit tests (Bun); some core tests load the built dist
bun run check:pkg        # no workspace: protocol in published deps, publint, attw
EXPRESS_PKG=express4 bun run test:int   # Express integration (node --test on built dist); repeat with express5
bun run test:db:docker   # real Postgres 18 + MongoDB 9 in throwaway containers (Docker must be running)
```

- Single unit test file: `bun test packages/core/test/domain/db.test.ts`; single test by name: `bun test packages/pg/test -t "rejects"`.
- Single integration file: `EXPRESS_PKG=express5 node --test packages/express/test/integration/<name>.int.mjs`.
- DB suites against already-running databases (don't tear them down): `REQ_INSPECT_DB_IT=1 bun run test:db`. Without that env var they skip. `MONGODB_PKG=mongodb6` runs the Mongo suite on driver 6.
- Demo app: `node examples/demo/index.mjs` → http://localhost:3000/_inspect. Set `DATABASE_URL` / `MONGO_URL` to enable its `/db/*` routes (uses built dist).

## Architecture

**Core (`packages/core/src`)** is framework- and database-agnostic and layered (`domain` pure → `store` → `capture` / `server` → `inspector.ts` composition root → `index.ts` entry). Import direction is enforced by `eslint-plugin-boundaries`; `index.ts` may only import `inspector.ts` and `domain/types.ts`, so new public runtime exports are re-exported through `inspector.ts`. Public runtime API is deliberately tiny (`createInspector`, `currentDbScope`, `watchDbContext`); `test/public-api.test.ts` asserts the exact export set from dist.

**Adapters** (`packages/express`, future frameworks) contain only glue: `dispatch(pathname)` → `'handle'` (serve dashboard/API/SSE via `handle`) / `'skip'` / `'capture'` (`capture(req, res, hooks, next)`). Every `packages/*/src` is linted as an adapter and may import only the `@req-inspect/core` entry. Redaction always happens in core, never in adapters. `capture` never throws.

**Request records**: `capture` wraps `res.write`/`res.end`, finalizes once on `finish` or `close`, and the record is stored via `setImmediate` into a ring store (default 500). Summaries stream to the dashboard over SSE (`/api/stream`); full records come from `/api/requests/:id`.

**DB call tracking** spans packages:

- `capture(…, next)` runs the rest of the request inside an `AsyncLocalStorage` stored at `globalThis[Symbol.for('req-inspect.context')]`. That slot must stay a bare `AsyncLocalStorage` (published core 0.4.0 reads it directly); format version and `requestsSeen` live in a separate `Symbol.for('req-inspect.context.meta')` key. This is what lets two installed copies of core share tracking.
- Integrations call `currentDbScope()` at query start (null → call the driver untouched) and `scope.track(event)` exactly once at the end; `watchDbContext()` warns once when queries never land inside a request.
- `@req-inspect/pg` wraps `Client.prototype.query` and binds `Pool.prototype.connect` / query callbacks with `AsyncResource.bind` — without that, queued pool waiters run in another request's context. Promise queries return a derived promise (same resolve/reject), never the driver's own.
- `@req-inspect/mongodb` uses driver command monitoring (`monitorCommands: true` required); start/succeed events are paired by `requestId` because replies arrive outside the request context.
- Flags (N+1 by fingerprint count including events past `maxEvents`, slow ≥ `slowMs`, DB time as interval union) are computed in `core/src/domain/db.ts`.

**Dashboard (`packages/dashboard`)**: private React 18 + Vite + Tailwind v4 app built into `packages/core/dist/ui` and shipped inside core. Design tokens are CSS variables in `src/styles/tokens.css` (light, dark, `data-theme` override) mapped via `@theme inline` with Tailwind's default palette disabled — use token utilities (`bg-surface`, `text-status-4xx`, …) and static class strings only. `test/contrast.test.ts` enforces WCAG AA for every token pair, so token edits must keep it green. Component tests use `react-dom/server` `renderToStaticMarkup` (no DOM). Presentational primitives live in `src/ui/`, app-aware components in `src/components/`.

## Conventions

- Arrow functions only (`func-style`, `prefer-arrow-callback` are errors); interface members as property signatures.
- TypeScript is pinned to 6.0.2 (tsup's dts build breaks on TS 7). Packages build dual ESM/CJS with tsup.
- Adapters and integrations depend on core as a regular `dependencies` range (not peer); drivers are peer dependencies.
- Every user-facing change needs a changeset in `.changeset/`.

## CI and release

- GitHub Actions workflows are `workflow_dispatch` only (nothing runs on push/PR): `gh workflow run ci.yml --ref <branch>`. CI jobs: `check`, Express integration matrix (Node 20/22/24 × Express 4/5), `db-integration` (postgres:18 + mongo:9 services), `db-integration-mongodb6`. `mongo:8` cannot start on the runner's kernel — don't use it.
- Release on `main`: `gh workflow run release.yml --ref main` opens/updates the "Version Packages" PR; merge it, run the workflow again to publish. npm then holds each version staged until it's approved on npmjs.com; after that, create a git tag and GitHub release per package (`@req-inspect/<name>@<version>`) on the version commit, notes from that package's CHANGELOG section.

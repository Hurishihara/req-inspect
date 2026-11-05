# Contributing

## Setup

Requires [Bun](https://bun.sh) and Node 20 or newer.

```sh
bun install
bun run build
```

Build before running the unit tests: one core test loads the built `dist` to check the public entry point.

## Checks

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `bun run lint`         | ESLint (strict type-checked rules, layer boundaries)      |
| `bun run format:check` | Prettier check (`bun run format` fixes)                   |
| `bun run typecheck`    | `tsc` for core, express and dashboard                     |
| `bun run test`         | Unit tests (needs a prior `bun run build`)                |
| `bun run test:int`     | Express integration tests (needs a prior `bun run build`) |
| `bun run check:pkg`    | publint and are-the-types-wrong on the packed packages    |

Run the integration tests against both Express versions:

```sh
EXPRESS_PKG=express4 bun run test:int
EXPRESS_PKG=express5 bun run test:int
```

## Code style

- Arrow functions only: `const f = () => {}`, never `function` declarations or callbacks (`func-style` and `prefer-arrow-callback` are errors).
- Prettier formats everything; ESLint runs on top with `eslint-config-prettier`.

## Core layers

`packages/core/src` is split into layers with a fixed import direction. The boundaries are enforced by `bun run lint` (`eslint-plugin-boundaries`).

| Layer                                               | Contents                                                                                                                    | May import                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `domain/`                                           | Pure logic: types, options, body classification, redaction, summaries. No Node built-in imports (`node:*` or bare), no I/O. | `domain`, `support`                         |
| `store/`                                            | `RingStore`                                                                                                                 | `domain`, `support`                         |
| `capture/`                                          | `res.write`/`res.end` wrapping, timing, finish/close to record                                                              | `domain`, `support`                         |
| `server/`                                           | Routing under the mount path, access guard, API, SSE, static files, and `respond.ts` (shared JSON responses)                | `domain`, `store`, `support`, `server`      |
| `support/`                                          | `warnOnce`                                                                                                                  | `support`                                   |
| `inspector.ts`                                      | Composition root wiring store, server and capture                                                                           | all layers above                            |
| `index.ts`                                          | Public entry; exports `createInspector` and types only                                                                      | `inspector.ts`, `domain/types.ts`           |
| every other `packages/*` (adapters, e.g. `express`) | Framework glue                                                                                                              | `@req-inspect/core` entry only, no subpaths |
| `packages/dashboard`                                | UI                                                                                                                          | `import type` from `@req-inspect/core` only |

Core tests import internals from `src/` directly; everything else goes through the public entry.

## Writing an adapter

An adapter connects a framework to the inspector in three steps.

1. Call `createInspector(options)` once.
2. For each request, `switch` on `inspector.dispatch(pathname)`, where `pathname` is the full original path without its query string:
   - `'handle'`: call `inspector.handle(req, res)` and stop. This serves the dashboard, API and SSE, and runs the access guard.
   - `'skip'`: pass the request on untouched (the inspector is disabled or the path is ignored).
   - `'capture'`: call `inspector.capture(req, res, hooks)`, then pass the request on.
3. Supply `CaptureHooks`, the framework-specific readers `capture` calls:

| Hook       | Read when                                                                          | Returns                                                      |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `route()`  | first `res.write` or `res.end`, at the latest when the response finishes or closes | matched route pattern, or `null`. Only valid while handling. |
| `params()` | first `res.write` or `res.end`, at the latest when the response finishes or closes | route params                                                 |
| `query()`  | when the response finishes or closes                                               | parsed query                                                 |
| `body()`   | when the response finishes or closes                                               | the framework's parsed request body                          |

Redaction happens in core: hand over raw values and do not redact in the adapter. `capture` never throws; if something fails it warns once and the response is unaffected.

See `packages/express/src/index.ts` for a complete adapter.

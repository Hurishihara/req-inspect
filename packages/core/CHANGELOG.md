# @req-inspect/core

## 0.4.1

### Patch Changes

- c3e8f06: Warn when two incompatible @req-inspect/core copies are installed, and when pg or MongoDB queries never land inside an inspected request (for example an outdated @req-inspect/express or inspector() mounted after routes).

## 0.4.0

### Minor Changes

- 50d85f8: Database call tracking. Queries made while handling a request are attached to its record, with N+1, slow-query and DB-time flags and a new Queries tab in the dashboard. New packages: `@req-inspect/pg` (node-postgres, Drizzle on pg, Knex, Sequelize, TypeORM) and `@req-inspect/mongodb` (native `mongodb` driver 6 and 7, Mongoose 8 and 9).

## 0.3.0

### Minor Changes

- f9564cd: Redesigned dashboard: new design tokens with WCAG 2.2 AA contrast in light and dark themes, tinted status badges, a labelled live indicator, empty states that explain themselves, keyboard navigation (`/` to filter, arrow keys for requests and tabs), Copy as cURL as the primary action, highlighted slow requests, an info banner for truncated bodies, a single-pane layout below 720px, a System/Light/Dark theme toggle, and the new req-inspect logo and favicon.

## 0.2.0

### Minor Changes

- 27f378d: Layered core and adapter kit. Express middleware behaviour is unchanged.
  
  `@req-inspect/core` now exports only `createInspector` and types (`Inspector`, `CaptureHooks`, `CapturedBody`, `InspectorOptions`, `RequestRecord`, `RequestSummary`, `ResolvedOptions`). Removed exports: `resolveOptions`, `DEFAULT_PATH`, `DEFAULT_MAX_REQUESTS`, `DEFAULT_MAX_BODY_BYTES`, `REDACTED_HEADERS_DEFAULT`, `BODY_KEYS_DEFAULT`, `RingStore`, `captureParsedBody`, `captureRawBody`, `REDACTED`, `normalizeHeaders`, `redactHeaders`, `redactBody`, `checkAccess`, `AccessResult`, `toSummary`, `createHandler`, `warnOnce` and the `RecordDraft` type. `Inspector` no longer has `store`, `isInspectorPath`, `shouldIgnore`, `captureRequestBody` or `record`.
  
  Adapter authors use `Inspector.dispatch` to decide what to do with a request and `Inspector.capture` with `CaptureHooks` to record it.

## 0.1.0

### Minor Changes

- 1495878: Initial release: in-process request inspector with a live dashboard and an Express adapter.

# @req-inspect/express

## 0.2.0

### Minor Changes

- 27f378d: Layered core and adapter kit. Express middleware behaviour is unchanged.
  
  `@req-inspect/core` now exports only `createInspector` and types (`Inspector`, `CaptureHooks`, `CapturedBody`, `InspectorOptions`, `RequestRecord`, `RequestSummary`, `ResolvedOptions`). Removed exports: `resolveOptions`, `DEFAULT_PATH`, `DEFAULT_MAX_REQUESTS`, `DEFAULT_MAX_BODY_BYTES`, `REDACTED_HEADERS_DEFAULT`, `BODY_KEYS_DEFAULT`, `RingStore`, `captureParsedBody`, `captureRawBody`, `REDACTED`, `normalizeHeaders`, `redactHeaders`, `redactBody`, `checkAccess`, `AccessResult`, `toSummary`, `createHandler`, `warnOnce` and the `RecordDraft` type. `Inspector` no longer has `store`, `isInspectorPath`, `shouldIgnore`, `captureRequestBody` or `record`.
  
  Adapter authors use `Inspector.dispatch` to decide what to do with a request and `Inspector.capture` with `CaptureHooks` to record it.

### Patch Changes

- Updated dependencies [27f378d]
  - @req-inspect/core@0.2.0

## 0.1.0

### Minor Changes

- 1495878: Initial release: in-process request inspector with a live dashboard and an Express adapter.

### Patch Changes

- Updated dependencies [1495878]
  - @req-inspect/core@0.1.0

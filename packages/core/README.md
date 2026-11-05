# @req-inspect/core

Framework-agnostic core of [req-inspect](https://github.com/Hurishihara/req-inspect): record storage, redaction, request capture and the dashboard handler.

## Install

```sh
npm i @req-inspect/core
```

## Usage

Using Express? Install [`@req-inspect/express`](https://www.npmjs.com/package/@req-inspect/express) instead; it captures requests for you.

The core package is for writing an adapter for another framework. `createInspector(options)` takes the same options as the Express middleware and returns:

```ts
interface Inspector {
  options: Readonly<ResolvedOptions>
  dispatch: (pathname: string) => 'handle' | 'skip' | 'capture'
  handle: (req: IncomingMessage, res: ServerResponse) => void
  capture: (req: IncomingMessage, res: ServerResponse, hooks: CaptureHooks) => void
}
```

- `dispatch(pathname)` takes the request path without its query string. It returns `'handle'` for the dashboard path, `'skip'` when the inspector is disabled or the path is ignored, and `'capture'` otherwise.
- `handle(req, res)` serves the dashboard, API and live stream, and runs the access checks.
- `capture(req, res, hooks)` wraps `res.write` and `res.end` and stores a record when the response finishes or closes. It never throws. Redaction of headers, query strings and bodies happens inside core.
- `CaptureHooks` are the framework-specific readers you supply: `route()` and `params()` (read on the first write or end), `query()` and `body()` (read when the response finishes or closes).

A minimal adapter over `node:http`:

```js
import http from 'node:http'
import { createInspector } from '@req-inspect/core'

const inspector = createInspector()

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    switch (inspector.dispatch(url.pathname)) {
      case 'handle':
        inspector.handle(req, res)
        return
      case 'capture':
        inspector.capture(req, res, {
          route: () => null,
          params: () => ({}),
          query: () => Object.fromEntries(url.searchParams),
          body: () => undefined,
        })
    }
    res.end('hello')
  })
  .listen(3000)
```

Open `http://localhost:3000/_inspect/` in your browser. Without `auth` it is only reachable from localhost.

See the [root README](https://github.com/Hurishihara/req-inspect#readme) for options, security and known limitations.

## Migrating from 0.1

0.2.0 exports only `createInspector` and types. Removed:

- Functions and constants: `resolveOptions`, `DEFAULT_PATH`, `DEFAULT_MAX_REQUESTS`, `DEFAULT_MAX_BODY_BYTES`, `REDACTED_HEADERS_DEFAULT`, `BODY_KEYS_DEFAULT`, `RingStore`, `captureParsedBody`, `captureRawBody`, `REDACTED`, `normalizeHeaders`, `redactHeaders`, `redactBody`, `checkAccess`, `AccessResult`, `toSummary`, `createHandler`, `warnOnce`.
- Type: `RecordDraft`.
- `Inspector` members: `store`, `isInspectorPath`, `shouldIgnore`, `captureRequestBody`, `record`.

Replace `isInspectorPath` and `shouldIgnore` with `dispatch`, and building and recording drafts by hand with `capture` and `CaptureHooks`.

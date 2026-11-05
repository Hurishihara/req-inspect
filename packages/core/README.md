# @req-inspect/core

Framework-agnostic core of [req-inspect](https://github.com/Hurishihara/req-inspect): record storage, redaction and the dashboard handler.

## Install

```sh
npm i @req-inspect/core
```

## Usage

Using Express? Install [`@req-inspect/express`](https://www.npmjs.com/package/@req-inspect/express) instead; it captures requests for you.

The core package is for writing an adapter for another framework. It serves the dashboard and stores the records you hand it:

```js
import http from 'node:http'
import { createInspector } from '@req-inspect/core'

const inspector = createInspector() // same options as the Express middleware
const app = (req, res) => res.end('hello')

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x')
    if (inspector.options.enabled && inspector.isInspectorPath(pathname)) return inspector.handle(req, res)
    app(req, res)
  })
  .listen(3000)
```

To capture traffic, build a `RecordDraft` for each finished request and pass it to `inspector.record(draft)`. Use `inspector.captureRequestBody(parsedBody, contentType)` for the request body and `captureRawBody(...)` for the response body. Redaction of headers, query strings and bodies happens inside `record`; drafts are unredacted.

Open `http://localhost:3000/_inspect/` in your browser. Without `auth` it is only reachable from localhost.

See the [root README](https://github.com/Hurishihara/req-inspect#readme) for options, security and known limitations.

# req-inspect

A drop-in request inspector for Express: mount one middleware and browse every request and response, live, in a local dashboard.

<!-- TODO: record docs/demo.gif -->

![req-inspect demo](docs/demo.gif)

Until the GIF exists, try it yourself: `bun install && bun run build && node examples/demo/index.mjs`.

## Install

```sh
npm i @req-inspect/express
```

Requires Node 20 or newer. Express 4.18+ and Express 5 are supported (`express` is a peer dependency).

## Usage

```js
import express from 'express'
import { inspector } from '@req-inspect/express'

const app = express()
app.use(inspector()) // before routes and body parsers
app.use(express.json())
app.get('/', (req, res) => res.json({ hello: 'world' }))
app.listen(3000)
```

Open `http://localhost:3000/_inspect`.

The inspector must be mounted at the app root, with `app.use(inspector())` before your routes and body parsers.

## Options

| Option         | Type                                                      | Default                                          | Description                                                                                        |
| -------------- | --------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `path`         | `string`                                                  | `'/_inspect'`                                    | Mount path of the dashboard and API. Matched against the absolute request path.                    |
| `enabled`      | `boolean`                                                 | `NODE_ENV !== 'production'` or `auth` configured | Force the inspector on or off, overriding the default decision.                                    |
| `auth`         | `{ user: string; pass: string }`                          | none                                             | Require HTTP basic auth. `user` and `pass` must both be non-empty, otherwise `inspector()` throws. |
| `maxRequests`  | `number`                                                  | `500`                                            | Number of records kept in memory; the oldest are evicted.                                          |
| `maxBodyBytes` | `number`                                                  | `65536`                                          | Maximum captured bytes per request or response body; larger bodies are truncated.                  |
| `ignore`       | `(string \| RegExp)[]`                                    | `[]`                                             | Requests not to capture. A string is a path prefix. Matched against the absolute request path.     |
| `redact`       | `{ headers?: string[]; bodyKeys?: (string \| RegExp)[] }` | see Security                                     | Extra header names and body keys to redact, added to the defaults.                                 |

## Security

The inspector exposes request data, so it is locked down by default.

- **Localhost only.** Without `auth`, only loopback connections are allowed. Requests carrying an `X-Forwarded-For` or `Forwarded` header are refused, so a same-host reverse proxy cannot expose the dashboard.
- **Host check.** Without `auth`, the `Host` header must also name localhost (`localhost`, `*.localhost`, `127.0.0.1` or `[::1]`, any port), otherwise the request gets 403. This blocks DNS rebinding attacks from web pages in your browser.
- **Production.** With `NODE_ENV=production` and no `auth`, both capture and the dashboard are disabled. The `enabled` option overrides this in either direction.
- **Basic auth.** With `auth: { user, pass }`, HTTP basic auth is required (compared in constant time) and remote access is allowed. Use it behind HTTPS.
- **Redaction.** Before a record is stored, these values are replaced with `[redacted]`:
  - Headers `authorization`, `cookie`, `set-cookie` and `x-api-key` (add more with `redact.headers`).
  - Body and query-string keys matching `/password|token|secret|apikey|api_key/i` (add more with `redact.bodyKeys`). This covers parsed request bodies, JSON responses, the `query` object and the stored URL.

  JSON bodies larger than `maxBodyBytes` are stored as a truncated text prefix. Request bodies are redacted before truncation. For a truncated JSON response, matching keys with string, number, boolean or null values are scrubbed from the text; a matching key whose value is an object or array is not. Other text bodies, such as `text/plain` or XML, are stored as sent.

## Known limitations

- If a compression middleware runs after the inspector, the response body is stored as the compressed binary.
- Storage is in memory and per process; with a cluster or multiple instances, each process has its own records.
- Request bodies are captured only after body parsers have run, so a route that reads the raw stream itself shows no request body.

## Benchmark

`examples/bench` runs autocannon against a hello-world JSON route, with and without `inspector()`. Result on Windows, 10 s, 50 connections, single run, no warm-up:

|                    | req/s | p50  | p99   |
| ------------------ | ----- | ---- | ----- |
| Plain Express      | 12392 | 3 ms | 8 ms  |
| With `inspector()` | 9525  | 4 ms | 10 ms |

Throughput loss is 23.1%. That is above the 10% goal for v0.1. It is a single local run, not a rigorous benchmark, so treat it as indicative. Reproduce it with `node examples/bench/bench.mjs`.

## License

[MIT](./LICENSE)

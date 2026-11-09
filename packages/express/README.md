<h1><img src="https://raw.githubusercontent.com/Hurishihara/req-inspect/main/brand/logo/png/lockup-horizontal-color-1200.png" alt="@req-inspect/express" width="280"></h1>

Express middleware for [req-inspect](https://github.com/Hurishihara/req-inspect): a live request inspector dashboard.

## Install

```sh
npm i @req-inspect/express
```

## Usage

```js
import express from 'express'
import { inspector } from '@req-inspect/express'

const app = express()
app.use(inspector()) // at the app root, before routes and body parsers
```

Open `/_inspect` in your browser. Without `auth` it is only reachable from localhost.

See the [root README](https://github.com/Hurishihara/req-inspect#readme) for options, security and known limitations.

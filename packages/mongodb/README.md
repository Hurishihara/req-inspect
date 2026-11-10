# @req-inspect/mongodb

MongoDB command tracking for [req-inspect](https://github.com/Hurishihara/req-inspect). Every command made while handling a request appears in that request's Queries tab.

## Install

```sh
npm i @req-inspect/mongodb
```

Requires `mongodb` 6 as a peer dependency; `@req-inspect/core` is installed with this package.

## Usage

The client must be created with command monitoring on:

```js
import { MongoClient } from 'mongodb'
import { instrumentMongo } from '@req-inspect/mongodb'

const client = new MongoClient(uri, { monitorCommands: true })
instrumentMongo(client)
```

With Mongoose: `mongoose.connect(uri, { monitorCommands: true })`, then `instrumentMongo(mongoose.connection.getClient())`.

## What is recorded

For each command: its name, the collection, the command body (redacted with the inspector's `redact.bodyKeys`), duration, reply count and error message. Driver housekeeping commands (`hello`, `ping`, `saslStart`, `endSessions` and similar) are skipped, as are commands made outside a request.

## Limitations

- `monitorCommands: true` is required. Without it a warning is logged and nothing is recorded.
- Supports the Node.js `mongodb` driver 6 and 7, and Mongoose 8 and 9 on top of it. Driver 7 needs Node.js 20.19 or later.

See the [root README](https://github.com/Hurishihara/req-inspect#database-calls) for options and security.

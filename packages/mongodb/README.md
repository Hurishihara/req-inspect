# @req-inspect/mongodb

MongoDB command tracking for [req-inspect](https://github.com/Hurishihara/req-inspect). Every command made while handling a request appears in that request's Queries tab.

## Install

```sh
npm i @req-inspect/mongodb
```

## Usage

The client must be created with command monitoring on:

```js
import { MongoClient } from 'mongodb'
import { instrumentMongo } from '@req-inspect/mongodb'

const client = new MongoClient(uri, { monitorCommands: true })
instrumentMongo(client)
```

With Mongoose: `mongoose.connect(uri, { monitorCommands: true })`, then `instrumentMongo(mongoose.connection.getClient())`.

Command bodies are redacted with the inspector's `redact.bodyKeys`. Without `monitorCommands: true` a warning is logged and nothing is recorded.

See the [root README](https://github.com/Hurishihara/req-inspect#readme) for options and security.

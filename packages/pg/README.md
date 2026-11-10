# @req-inspect/pg

node-postgres (`pg`) query tracking for [req-inspect](https://github.com/Hurishihara/req-inspect). Every query made while handling a request appears in that request's Queries tab.

## Install

```sh
npm i @req-inspect/pg
```

## Usage

```js
import pg from 'pg'
import { instrumentPg } from '@req-inspect/pg'

instrumentPg(pg) // once, at startup
```

`Client.prototype.query` is wrapped, so `pool.query`, checked-out clients, transactions and ORMs built on `pg` are covered. `pg-native` is not supported. Query parameters are only stored when `db.params` is enabled in the inspector options.

See the [root README](https://github.com/Hurishihara/req-inspect#readme) for options and security.

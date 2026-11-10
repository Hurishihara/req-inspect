# @req-inspect/pg

node-postgres (`pg`) query tracking for [req-inspect](https://github.com/Hurishihara/req-inspect). Every query made while handling a request appears in that request's Queries tab.

## Install

```sh
npm i @req-inspect/pg
```

Requires `pg` 8 as a peer dependency; `@req-inspect/core` is installed with this package.

## Usage

```js
import pg from 'pg'
import { instrumentPg } from '@req-inspect/pg'

instrumentPg(pg) // once, at startup
```

`Client.prototype.query` is wrapped, so `pool.query`, checked-out clients, transactions, Drizzle on `pg`, Knex, Sequelize and TypeORM are covered. Calling it again is a no-op.

## What is recorded

For each query: the SQL text, the operation (first keyword, such as `SELECT`), the target table (best effort, unquoted), duration, row count and error message. Query parameters are only stored when `db.params` is enabled in the inspector options. Queries made outside a request are not recorded.

## Limitations

- `pg-native` is not supported.
- `Pool.prototype.connect` is wrapped only to bind its callback to the caller's request context, so queries run by a queued waiter are attributed to the right request. `Pool.prototype.query` is not wrapped.
- Statement text is stored as sent, so ORMs that inline values (such as Sequelize) show them in the statement even with parameters off.
- The target table is a best-effort match on `from`, `into`, `update` or `join`; it can be empty.

See the [root README](https://github.com/Hurishihara/req-inspect#database-calls) for options and security.

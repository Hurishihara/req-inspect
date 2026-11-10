# @req-inspect/pg

node-postgres (`pg`) query tracking for [req-inspect](https://github.com/Hurishihara/req-inspect). Every query made while handling a request appears in that request's Queries tab.

## Install

```sh
npm i @req-inspect/pg
```

Requires `@req-inspect/core` and `pg` 8 as peer dependencies.

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
- The target table is a best-effort match on `from`, `into`, `update` or `join`; it can be empty.

See the [root README](https://github.com/Hurishihara/req-inspect#database-calls) for options and security.

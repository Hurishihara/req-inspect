---
'@req-inspect/core': minor
'@req-inspect/express': minor
'@req-inspect/pg': minor
'@req-inspect/mongodb': minor
---

Database call tracking. Queries made while handling a request are attached to its record, with N+1, slow-query and DB-time flags and a new Queries tab in the dashboard. New packages: `@req-inspect/pg` (node-postgres, Drizzle on pg, Knex, Sequelize, TypeORM) and `@req-inspect/mongodb` (native `mongodb` driver 6 and 7, Mongoose 8 and 9).

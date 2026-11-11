# @req-inspect/pg

## 0.1.1

### Patch Changes

- c3e8f06: Warn when two incompatible @req-inspect/core copies are installed, and when pg or MongoDB queries never land inside an inspected request (for example an outdated @req-inspect/express or inspector() mounted after routes).
- Updated dependencies [c3e8f06]
  - @req-inspect/core@0.4.1

## 0.1.0

### Minor Changes

- 50d85f8: Database call tracking. Queries made while handling a request are attached to its record, with N+1, slow-query and DB-time flags and a new Queries tab in the dashboard. New packages: `@req-inspect/pg` (node-postgres, Drizzle on pg, Knex, Sequelize, TypeORM) and `@req-inspect/mongodb` (native `mongodb` driver 6 and 7, Mongoose 8 and 9).

### Patch Changes

- Updated dependencies [50d85f8]
  - @req-inspect/core@0.4.0

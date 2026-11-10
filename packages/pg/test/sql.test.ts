import { expect, test } from 'bun:test'

import { sqlFingerprint, sqlOperation, sqlTarget } from '../src/sql.js'

test('sqlOperation is the first keyword, uppercased', () => {
  expect(sqlOperation('  select * from users')).toBe('SELECT')
  expect(sqlOperation('WITH x AS (select 1) SELECT * from x')).toBe('WITH')
  expect(sqlOperation('-- hi\n/* c */ delete from t')).toBe('DELETE')
  expect(sqlOperation('')).toBe('QUERY')
})

test('sqlTarget finds the first identifier after from/into/update/join', () => {
  expect(sqlTarget('select * from "public"."users" u')).toBe('public.users')
  expect(sqlTarget('select * from "users"')).toBe('users')
  expect(sqlTarget('insert into orders (a) values ($1)')).toBe('orders')
  expect(sqlTarget('update items set a=1')).toBe('items')
  expect(sqlTarget('select 1 from a join b on a.id = b.id')).toBe('a')
  expect(sqlTarget('select * from public.users')).toBe('public.users')
  expect(sqlTarget('begin')).toBeNull()
})

test('sqlFingerprint collapses whitespace', () => {
  expect(sqlFingerprint('select *\n  from t where id = $1')).toBe('select * from t where id = $1')
})

test('sqlFingerprint replaces string and numeric literals with ?', () => {
  expect(sqlFingerprint('select * from u where id = 1')).toBe(sqlFingerprint('select * from u where id = 2'))
  expect(sqlFingerprint('select * from u where id = 1')).toBe('select * from u where id = ?')
  expect(sqlFingerprint("select * from u where name = 'a''b'")).toBe('select * from u where name = ?')
  expect(sqlFingerprint('select * from u where id = $1 and n = 2.5e3')).toBe(
    'select * from u where id = $1 and n = ?',
  )
  expect(sqlFingerprint('select t1.id from t1 where t1.x = 3')).toBe('select t1.id from t1 where t1.x = ?')
  expect(sqlFingerprint('select "col 1" from t where a = \'x  y\'')).toBe('select "col 1" from t where a = ?')
})

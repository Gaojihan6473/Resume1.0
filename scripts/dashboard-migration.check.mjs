import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('dashboard ownership, inactive keys, CAS writes and first-save races', async () => {
  const db = new PGlite()
  const user = '00000000-0000-0000-0000-000000000001', other = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`create schema auth; create role authenticated; create role anon;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function public.has_active_key(uuid) returns boolean language sql as $$select current_setting('test.key_active',true)='true'$$;
      grant usage on schema public,auth to authenticated,anon;
      insert into auth.users values('${user}'),('${other}');`)
    await db.exec(await readFile(new URL('../supabase/migrations/20261108094726_customizable_dashboard.sql', import.meta.url), 'utf8'))
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}'; set test.key_active='true';`)
    const save = (revision, widgets = []) => db.query('select save_dashboard_config($1::jsonb,$2) as result', [JSON.stringify({ version: 1, widgets }), revision])
    assert.equal((await save(0)).rows[0].result.revision, 1)
    await assert.rejects(save(0), /其他窗口/)
    assert.equal((await save(1)).rows[0].result.revision, 2)
    await assert.rejects(save(1), /其他窗口/)
    assert.equal((await db.query('select * from dashboard_configs')).rows.length, 1)
    await db.exec(`set request.jwt.claim.sub='${other}';`)
    assert.equal((await db.query('select * from dashboard_configs')).rows.length, 0)
    await assert.rejects(db.query(`insert into dashboard_configs(user_id,config) values($1,'{"version":1,"widgets":[]}')`, [user]), /row-level security/)
    await db.exec(`set request.jwt.claim.sub='${user}'; set test.key_active='false';`)
    assert.equal((await db.query('select * from dashboard_configs')).rows.length, 0)
    await assert.rejects(save(2), /登录|密钥/)
    await db.exec('reset role; set role anon;')
    await assert.rejects(db.query('select * from dashboard_configs'), /permission denied/)
    await assert.rejects(save(2), /permission denied/)
  } finally { await db.close() }
}, { timeout: 30000 })

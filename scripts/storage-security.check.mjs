import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const inactive = '00000000-0000-0000-0000-000000000003'
const resume = '00000000-0000-0000-0000-000000000010'
const foreignResume = '00000000-0000-0000-0000-000000000020'
const migration = new URL('../supabase/migrations/20261030022811_close_resume_storage_public_access.sql', import.meta.url)

async function asRole(role, uid, action) {
  await db.exec(`begin; set local role ${role};`)
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid || ''])
    return await action()
  } finally {
    await db.exec('rollback')
  }
}

before(async () => {
  await db.exec(`
    create schema auth; create schema storage;
    create role anon; create role authenticated; create role service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.resumes(id uuid primary key,user_id uuid not null);
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb default '{}');
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    grant select on public.resumes to authenticated;
    insert into auth.users values('${user}'),('${other}'),('${inactive}');
    insert into public.resumes values('${resume}','${user}'),('${foreignResume}','${other}');
    insert into storage.buckets values('resumes','resumes',true),('avatars','avatars',true);
    insert into storage.objects(bucket_id,name,owner) values
      ('resumes','${user}/generated/${resume}/v1.pdf','${user}'),
      ('resumes','${user}/previews/${resume}/v1.png','${user}'),
      ('resumes','${user}/generated/${resume}.pdf','${user}'),
      ('resumes','previews/${resume}.png','${user}'),
      ('resumes','${other}/generated/foreign.pdf','${other}'),
      ('resumes','previews/${foreignResume}.png','${other}'),
      ('resumes','${inactive}/generated/disabled.pdf','${inactive}'),
      ('avatars','public.png',null);
    create policy "Public can view resumes" on storage.objects for select to public using(bucket_id='resumes');
    create policy "Users can view own resumes" on storage.objects for select to authenticated using(bucket_id='resumes' and auth.uid()=owner);
    create policy "Users can upload resumes" on storage.objects for insert to authenticated with check(bucket_id='resumes' and auth.uid()=owner);
    create policy "Users can update own resumes" on storage.objects for update to authenticated using(bucket_id='resumes' and auth.uid()=owner);
    create policy "Users can delete own resumes" on storage.objects for delete to authenticated using(bucket_id='resumes' and auth.uid()=owner);
    create policy avatars_public on storage.objects for select to public using(bucket_id='avatars');
  `)
  const baseline = await readFile(new URL('../supabase/migrations/20260620_harden_auth_rls_storage.sql', import.meta.url), 'utf8')
  await db.exec(baseline.replace('create extension if not exists pgcrypto;', ''))
  await db.exec(`insert into public.valid_keys(user_id,key_hash,key_name,is_active) values('${user}','hash-a','a',true),('${other}','hash-b','b',true),('${inactive}','hash-c','c',false)`)
  const exposed = await asRole('anon', null, () => db.query("select count(*)::int as count from storage.objects where bucket_id='resumes'"))
  assert.equal(exposed.rows[0].count, 7, 'fixture must reproduce the real legacy-policy vulnerability')
  await db.exec(await readFile(migration, 'utf8'))
}, { timeout: 30000 })

after(async () => { await db.close() })

test('anonymous users cannot list objects and cannot call privileged storage helpers', async () => {
  await asRole('anon', null, async () => {
    const result = await db.query("select name from storage.objects where bucket_id='resumes'")
    assert.equal(result.rows.length, 0)
  })
  const grants = await db.query("select has_function_privilege('anon','public.has_active_key(uuid)','EXECUTE') as active_key, has_function_privilege('anon','public.can_access_resume_storage_object(text)','EXECUTE') as storage")
  assert.deepEqual(grants.rows[0], { active_key: false, storage: false })
})

test('active owners retain versioned snapshots, old PDFs and legacy preview access', async () => {
  const result = await asRole('authenticated', user, () => db.query("select name from storage.objects where bucket_id='resumes' order by name"))
  assert.equal(result.rows.length, 4)
  assert.ok(result.rows.some(row => row.name === `previews/${resume}.png`))
  const invalid = await asRole('authenticated', user, () => db.query('select public.can_access_resume_storage_object($1) as allowed', [`previews/${resume}.png/extra`]))
  assert.equal(invalid.rows[0].allowed, false)
})

test('other accounts cannot read, update, delete or forge ownership when uploading', async () => {
  await asRole('authenticated', other, async () => {
    const visible = await db.query('select name from storage.objects where name like $1 or name=$2', [`${user}/%`, `previews/${resume}.png`])
    assert.equal(visible.rows.length, 0)
    const updated = await db.query("update storage.objects set metadata='{}' where name like $1 returning id", [`${user}/%`])
    const deleted = await db.query('delete from storage.objects where name like $1 returning id', [`${user}/%`])
    assert.equal(updated.rows.length, 0)
    assert.equal(deleted.rows.length, 0)
  })
  await assert.rejects(asRole('authenticated', other, () => db.query("insert into storage.objects(bucket_id,name,owner) values('resumes',$1,$2)", [`${user}/forged.pdf`, other])), /row-level security/)
})

test('disabled keys cannot bypass revocation through old owner policies', async () => {
  await asRole('authenticated', inactive, async () => {
    assert.equal((await db.query("select id from storage.objects where bucket_id='resumes'")).rows.length, 0)
    assert.equal((await db.query("update storage.objects set metadata='{}' where bucket_id='resumes' returning id")).rows.length, 0)
    assert.equal((await db.query("delete from storage.objects where bucket_id='resumes' returning id")).rows.length, 0)
  })
  await assert.rejects(asRole('authenticated', inactive, () => db.query("insert into storage.objects(bucket_id,name,owner) values('resumes',$1,$2)", [`${inactive}/new.pdf`, inactive])), /row-level security/)
})

test('owners can upload, read, update and delete their PDF and thumbnail objects', async () => {
  await asRole('authenticated', user, async () => {
    for (const suffix of ['generated/new.pdf', 'previews/new.png']) {
      const path = `${user}/${suffix}`
      await db.query("insert into storage.objects(bucket_id,name,owner) values('resumes',$1,$2)", [path, user])
      assert.equal((await db.query('select id from storage.objects where name=$1', [path])).rows.length, 1)
      assert.equal((await db.query("update storage.objects set metadata='{}' where name=$1 returning id", [path])).rows.length, 1)
      assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path])).rows.length, 1)
    }
  })
  await assert.rejects(asRole('authenticated', user, () => db.query('update storage.objects set name=$1 where name=$2', [`${other}/moved.pdf`, `${user}/generated/${resume}/v1.pdf`])), /row-level security/)
})

test('migration is idempotent, preserves objects and leaves unrelated buckets alone', async () => {
  await db.exec(await readFile(migration, 'utf8'))
  assert.equal((await db.query("select public from storage.buckets where id='resumes'")).rows[0].public, false)
  assert.equal((await db.query('select count(*)::int as count from storage.objects')).rows[0].count, 8)
  const unrelated = await asRole('anon', null, () => db.query("select name from storage.objects where bucket_id='avatars'"))
  assert.deepEqual(unrelated.rows, [{ name: 'public.png' }])
})

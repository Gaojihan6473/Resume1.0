import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const user = '00000000-0000-0000-0000-000000000001'
const otherUser = '00000000-0000-0000-0000-000000000002'
const source = '00000000-0000-0000-0000-000000000010'
const target = '00000000-0000-0000-0000-000000000020'
const resume = '00000000-0000-0000-0000-000000000030'
const job1 = '00000000-0000-0000-0000-000000000040'
const job2 = '00000000-0000-0000-0000-000000000050'
let migrated

before(async () => {
  await db.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function public.has_active_key(uuid) returns boolean language sql as $$select true$$;
    create table public.resumes(id uuid primary key default gen_random_uuid(),user_id uuid not null,title text not null,content jsonb not null default '{}',source text not null default 'blank',file_url text,preview_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create table public.applications(id uuid primary key default gen_random_uuid(),user_id uuid not null,resume_id uuid references public.resumes(id) on delete set null,company text not null,position text not null default '',updated_at timestamptz not null default now());
    insert into auth.users values('${user}'),('${otherUser}');
    insert into public.resumes(id,user_id,title) values('${resume}','${user}','历史简历');
    insert into public.applications(id,user_id,resume_id,company) values('${job1}','${user}','${resume}','历史岗位');
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/20261007_recruitment_batches.sql', import.meta.url), 'utf8'))
  migrated = (await db.query(`select r.id, r.batch_id, a.resume_id, a.batch_id as application_batch from resumes r join applications a on a.resume_id=r.id`)).rows[0]
  await db.exec(`
    grant usage on schema public,auth to authenticated;
    grant select,insert,update,delete on all tables in schema public to authenticated;
    alter table public.resumes enable row level security;
    alter table public.applications enable row level security;
    create policy resume_owner on public.resumes for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    create policy application_owner on public.applications for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
  `)
}, { timeout: 30000 })
after(async () => { await db.close() })
beforeEach(async () => {
  await db.exec(`reset role; begin;
    delete from public.applications; delete from public.resumes; delete from public.recruitment_batches; delete from public.batch_transfer_receipts;
    insert into recruitment_batches(id,user_id,name,is_default) values('${source}','${user}','默认批次',true),('${target}','${user}','秋招',false);
    insert into resumes(id,user_id,batch_id,title,content,source) values('${resume}','${user}','${source}','基础简历','{"basic":{"name":"小鱼"}}','agent-p0:original-run');
    insert into applications(id,user_id,batch_id,resume_id,company) values('${job1}','${user}','${source}','${resume}','公司一'),('${job2}','${user}','${source}','${resume}','公司二');
    commit;
    set role authenticated; set request.jwt.claim.sub='${user}';`)
})

async function preview(resumeIds = [], applicationIds = [], mode = 'move', destination = target) {
  return (await db.query('select preview_batch_transfer($1,$2,$3::uuid[],$4::uuid[],$5) as result', [source, destination, resumeIds, applicationIds, mode])).rows[0].result
}
async function execute(plan, resumeIds = [], applicationIds = [], mode = 'move', destination = target, requestId = crypto.randomUUID()) {
  return db.query('select execute_batch_transfer($1,$2,$3::uuid[],$4::uuid[],$5,$6,$7) as result', [source, destination, resumeIds, applicationIds, mode, plan.fingerprint, requestId])
}
async function rows(table) { return (await db.query(`select * from public.${table} order by ${table === 'batch_transfer_receipts' ? 'request_id' : 'id'}`)).rows }

test('migration preserves existing IDs and associations in the default batch', () => {
  assert.equal(migrated.id, resume)
  assert.equal(migrated.resume_id, resume)
  assert.equal(migrated.batch_id, migrated.application_batch)
})
test('transfer and deletion RPCs deny anonymous execution under Supabase default grants', async () => {
  const { rows: permissions } = await db.query(`select
    has_function_privilege('anon','public.execute_batch_transfer(uuid,uuid,uuid[],uuid[],text,text,uuid)','execute') as transfer,
    has_function_privilege('anon','public.preview_batch_transfer(uuid,uuid,uuid[],uuid[],text)','execute') as preview,
    has_function_privilege('anon','public.delete_resume_with_links(uuid)','execute') as deletion`)
  assert.deepEqual(permissions[0], { transfer: false, preview: false, deletion: false })
})
test('moving jobs copies their shared resume once and leaves other references intact', async () => {
  const plan = await preview([], [job1])
  assert.equal(plan.copies.length, 1)
  await execute(plan, [], [job1])
  const resumes = await rows('resumes'), jobs = await rows('applications')
  assert.equal(resumes.length, 2)
  assert.equal(resumes.find((item) => item.id === resume).batch_id, source)
  assert.equal(jobs.find((item) => item.id === job2).resume_id, resume)
  const moved = jobs.find((item) => item.id === job1)
  assert.equal(moved.batch_id, target)
  assert.notEqual(moved.resume_id, resume)
  assert.equal(resumes.find((item) => item.id === moved.resume_id).source, `batch-copy:${resume}`)
})
test('multiple selected jobs reuse one copy within the transaction', async () => {
  const plan = await preview([], [job1, job2])
  await execute(plan, [], [job1, job2])
  const jobs = await rows('applications')
  assert.equal((await rows('resumes')).length, 2)
  assert.equal(jobs[0].resume_id, jobs[1].resume_id)
})
test('moving a resume includes all associated jobs and mixed selections do not copy it', async () => {
  const plan = await preview([resume], [job1])
  assert.equal(plan.applications.length, 2)
  assert.equal(plan.copies.length, 0)
  await execute(plan, [resume], [job1])
  assert.equal((await rows('resumes')).length, 1)
  assert.equal((await rows('resumes'))[0].batch_id, target)
  for (const job of await rows('applications')) { assert.equal(job.batch_id, target); assert.equal(job.resume_id, resume) }
})
test('copy is independent and retries with the same operation ID are idempotent', async () => {
  const plan = await preview([resume], [], 'copy')
  const requestId = crypto.randomUUID()
  await execute(plan, [resume], [], 'copy', target, requestId)
  await execute(plan, [resume], [], 'copy', target, requestId)
  const copies = (await rows('resumes')).filter((item) => item.id !== resume)
  assert.equal(copies.length, 1)
  await db.query(`update resumes set content='{"basic":{"name":"独立版本"}}' where id=$1`, [copies[0].id])
  assert.equal((await rows('resumes')).find((item) => item.id === resume).content.basic.name, '小鱼')
})
test('delete migrates the entire batch preserving identities and can be safely retried', async () => {
  const plan = await preview([], [], 'delete')
  const requestId = crypto.randomUUID()
  await execute(plan, [], [], 'delete', target, requestId)
  await execute(plan, [], [], 'delete', target, requestId)
  assert.equal((await rows('recruitment_batches')).length, 1)
  assert.equal((await rows('resumes'))[0].id, resume)
  assert.equal((await rows('resumes'))[0].batch_id, target)
  assert.equal((await rows('applications')).length, 2)
})
test('changed associations invalidate the preview before any mutation', async () => {
  const plan = await preview([resume])
  await db.query(`update applications set resume_id=null,updated_at=clock_timestamp() where id=$1`, [job2])
  await assert.rejects(execute(plan, [resume]), /关联内容已变化/)
  assert.equal((await rows('resumes'))[0].batch_id, source)
  assert.equal((await rows('batch_transfer_receipts')).length, 0)
})
test('a failure after a copy is inserted rolls the entire operation back', async () => {
  await db.exec(`reset role; create function reject_test_move() returns trigger language plpgsql as $$begin if new.batch_id='${target}' then raise exception 'simulated failure'; end if; return new; end$$;
    create trigger reject_test_move before update on applications for each row execute function reject_test_move(); set role authenticated;`)
  const plan = await preview([], [job1])
  try { await assert.rejects(execute(plan, [], [job1]), /simulated failure/) }
  finally { await db.exec('reset role; drop trigger reject_test_move on applications; drop function reject_test_move(); set role authenticated;') }
  assert.equal((await rows('resumes')).length, 1)
  assert.equal((await rows('applications'))[0].batch_id, source)
  assert.equal((await rows('batch_transfer_receipts')).length, 0)
})

test('association swaps invalidate confirmation even when timestamps and the copied resume set are unchanged', async () => {
  const secondResume = crypto.randomUUID()
  await db.query('insert into resumes(id,user_id,batch_id,title) values($1,$2,$3,$4)', [secondResume, user, source, '另一简历'])
  await db.query('update applications set resume_id=$1 where id=$2', [secondResume, job2])
  const plan = await preview([], [job1, job2])
  await db.query('update applications set resume_id=case when id=$1 then $2::uuid else $3::uuid end where id=any($4::uuid[])', [job1, secondResume, resume, [job1, job2]])
  await assert.rejects(execute(plan, [], [job1, job2]), /关联内容已变化/)
  assert.equal((await rows('resumes')).length, 2)
  assert.equal((await rows('batch_transfer_receipts')).length, 0)
})
test('RLS and the transfer endpoint reject other users batches', async () => {
  await db.exec(`set request.jwt.claim.sub='${otherUser}'`)
  assert.equal((await rows('resumes')).length, 0)
  assert.equal((await rows('recruitment_batches')).length, 0)
  await assert.rejects(preview([resume]), /来源批次不存在/)
  await assert.rejects(execute({ fingerprint: 'invalid' }, [resume]), /来源批次不存在/)
})
test('database constraints reject cross batch links and owner mismatch', async () => {
  await assert.rejects(db.query('update applications set batch_id=$1 where id=$2', [target, job1]), /foreign key/)
  await assert.rejects(db.query('insert into resumes(user_id,batch_id,title) values($1,$2,$3)', [user, crypto.randomUUID(), '无效批次']), /foreign key/)
})
test('new users initialize once and deleting the final empty batch does not recreate it', async () => {
  const newUser = crypto.randomUUID()
  await db.exec(`reset role; insert into auth.users values('${newUser}'); set role authenticated; set request.jwt.claim.sub='${newUser}';`)
  const batch = (await rows('recruitment_batches'))[0]
  const plan = (await db.query(`select preview_batch_transfer($1,null,'{}','{}','delete') as result`, [batch.id])).rows[0].result
  await db.query(`select execute_batch_transfer($1,null,'{}','{}','delete',$2,$3)`, [batch.id, plan.fingerprint, crypto.randomUUID()])
  assert.equal((await rows('recruitment_batches')).length, 0)
  await assert.rejects(db.query('insert into resumes(user_id,title) values($1,$2)', [newUser, '旧客户端']), /请先创建并选择批次/)
})
test('legacy creation infers the linked resume batch and resume deletion unlinks safely', async () => {
  const plan = await preview([resume])
  await execute(plan, [resume])
  await db.query('insert into applications(user_id,resume_id,company) values($1,$2,$3)', [user, resume, '旧客户端岗位'])
  for (const item of await rows('applications')) assert.equal(item.batch_id, target)
  await db.query('select delete_resume_with_links($1)', [resume])
  assert.equal((await rows('resumes')).length, 0)
  for (const item of await rows('applications')) assert.equal(item.resume_id, null)
})

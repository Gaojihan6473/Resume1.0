// Browser acceptance against an isolated PostgreSQL fixture; no remote writes.
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { PGlite } from '@electric-sql/pglite'

const origin = process.env.WORKSPACE_TEST_URL || 'http://127.0.0.1:5175'
const env = await readFile(new URL('../.env', import.meta.url), 'utf8')
const supabaseUrl = env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '')
if (!supabaseUrl) throw new Error('Configure VITE_SUPABASE_URL before running the browser check')
const user = '00000000-0000-0000-0000-000000000001'
const db = new PGlite()
await db.exec(`create schema auth; create role authenticated; create role anon; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function public.has_active_key(uuid) returns boolean language sql as $$select true$$;
  create table resumes(id uuid primary key default gen_random_uuid(),user_id uuid not null,title text not null,content jsonb not null default '{}',source text not null default 'blank',file_url text,preview_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
  create table applications(id uuid primary key default gen_random_uuid(),user_id uuid not null,resume_id uuid references resumes(id) on delete set null,company text not null,position text not null,location text not null default '',salary_range text not null default '',job_description text not null default '',channel text not null,status text not null,applied_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
  create table jd_analysis_records(id uuid primary key default gen_random_uuid(),user_id uuid,resume_id uuid,application_id uuid,created_at timestamptz default now());
  insert into auth.users values('${user}');`)
await db.exec(await readFile(new URL('../supabase/migrations/20261007_recruitment_batches.sql', import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../supabase/migrations/20261008_batch_card_styles.sql', import.meta.url), 'utf8'))
const source = (await db.query('select id from recruitment_batches')).rows[0].id
const target = crypto.randomUUID()
await db.query(`insert into recruitment_batches(id,user_id,name,color,description) values($1,$2,'2027届金融秋招','violet','金融机构与国企岗位'),(gen_random_uuid(),$2,'2027年暑期实习','teal','实习机会与岗位准备')`, [target, user])
const resume = crypto.randomUUID(), job = crypto.randomUUID(), otherJob = crypto.randomUUID()
await db.query(`insert into resumes(id,user_id,batch_id,title,content) values($1,$2,$3,'基础简历',$4)`, [resume, user, source, JSON.stringify({ resumeTitle: '基础简历', basic: { name: '小鱼', targetTitle: '产品经理' } })])
await db.query(`insert into applications(id,user_id,batch_id,resume_id,company,position,channel,status,job_description) values($1,$3,$4,$5,'测试公司一','产品经理','官网','applied','产品需求与数据分析'),($2,$3,$4,$5,'测试公司二','运营经理','官网','interested','运营与用户增长')`, [job, otherJob, user, source, resume])
await db.exec(`grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;
  alter table resumes enable row level security; alter table applications enable row level security;
  create policy resume_owner on resumes for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
  create policy application_owner on applications for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
  set role authenticated; set request.jwt.claim.sub='${user}';`)

const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(existsSync)
const browser = await chromium.launch({ executablePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
const page = await context.newPage()
const errors = [], requests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error' && /React Router caught|An error occurred in/.test(message.text())) errors.push(message.text()) })
const expires = Math.floor(Date.now() / 1000) + 3600
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user, aud: 'authenticated', role: 'authenticated', exp: expires })).toString('base64url'), 'test-fixture-signature'].join('.')
await context.addInitScript(({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)) }, {
  key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
  session: { access_token: jwt, refresh_token: 'local-fixture-only', expires_at: expires, expires_in: 3600, token_type: 'bearer', user: { id: user, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } },
})
const allowedTables = new Set(['recruitment_batches', 'resumes', 'applications', 'jd_analysis_records'])
const storedFiles = new Map()
await page.route(`${new URL(supabaseUrl).origin}/**`, async (route) => {
  const request = route.request(), url = new URL(request.url())
  const path = url.pathname.split('/').at(-1)
  const body = request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null
  const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'Access-Control-Allow-Origin': '*' } })
  if (request.method() === 'OPTIONS') return respond({})
  if (url.pathname.startsWith('/auth/')) return respond({ user: { id: user, email: 'fixture@example.test' } })
  if (url.pathname.endsWith('/minimax-chat')) return respond({ choices: [{ message: { content: JSON.stringify({ basic: { name: '上传测试', targetTitle: '产品经理' }, education: [{ school: '测试大学', degree: '本科' }], internships: [], projects: [], summary: '', skills: '' }) } }] })
  if (url.pathname.startsWith('/storage/')) {
    if (url.pathname.includes('/object/sign/') && request.method() === 'POST') return respond({ signedURL: url.pathname.replace('/storage/v1', '') + '?token=fixture' })
    if (request.method() === 'POST') { storedFiles.set(url.pathname.replace('/storage/v1/object/', ''), request.postDataBuffer()); return respond({ Key: url.pathname, Id: crypto.randomUUID() }) }
    return route.fulfill({ status: 200, body: storedFiles.get(url.pathname.replace('/storage/v1/object/sign/', '')) || Buffer.alloc(0), contentType: url.pathname.endsWith('.png') ? 'image/png' : 'application/pdf' })
  }
  requests.push({ path, method: request.method() })
  try {
    if (url.pathname.includes('/rpc/')) {
      const names = {
        preview_batch_transfer: ['p_source', 'p_target', 'p_resumes', 'p_applications', 'p_mode'],
        execute_batch_transfer: ['p_source', 'p_target', 'p_resumes', 'p_applications', 'p_mode', 'p_fingerprint', 'p_request_id'],
        delete_resume_with_links: ['p_resume'],
      }[path]
      if (!names) throw new Error(`Unexpected RPC: ${path}`)
      const result = await db.query(`select ${path}(${names.map((_, index) => '$' + (index + 1)).join(',')}) as result`, names.map((name) => body[name]))
      return respond(result.rows[0].result)
    }
    if (!allowedTables.has(path)) throw new Error(`Unexpected fixture request: ${url.pathname}`)
    let records = (await db.query(`select * from ${path}`)).rows
    for (const [column, value] of url.searchParams) if (value.startsWith('eq.')) records = records.filter((row) => String(row[column]) === value.slice(3))
    if (request.method() === 'POST') {
      const values = Array.isArray(body) ? body[0] : body
      const columns = Object.keys(values)
      if (columns.some((column) => !/^[a-z_]+$/.test(column))) throw new Error('Invalid fixture column')
      records = (await db.query(`insert into ${path}(${columns.join(',')}) values(${columns.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, columns.map((column) => typeof values[column] === 'object' && values[column] !== null ? JSON.stringify(values[column]) : values[column]))).rows
    } else if (request.method() === 'PATCH') {
      const columns = Object.keys(body)
      if (columns.some((column) => !/^[a-z_]+$/.test(column))) throw new Error('Invalid fixture column')
      const ids = records.map((row) => row.id)
      records = (await db.query(`update ${path} set ${columns.map((column, i) => `${column}=$${i + 1}`).join(',')} where id=any($${columns.length + 1}::uuid[]) returning *`, [...columns.map((column) => typeof body[column] === 'object' && body[column] !== null ? JSON.stringify(body[column]) : body[column]), ids])).rows
    }
    const orders = url.searchParams.get('order')?.split(',') || []
    records.sort((a, b) => {
      for (const order of orders) { const [column, direction] = order.split('.'); const cmp = String(a[column]).localeCompare(String(b[column])); if (cmp) return direction === 'desc' ? -cmp : cmp }
      return 0
    })
    return respond(request.headers().accept?.includes('vnd.pgrst.object') ? records[0] : records)
  } catch (error) { return respond({ message: error.message, code: 'TEST_FIXTURE_ERROR' }, 400) }
})
await mkdir(new URL('../.cache/batch-check/', import.meta.url), { recursive: true })
const screenshot = (name) => page.screenshot({ path: new URL(`../.cache/batch-check/${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true })
try {
  await page.goto(origin)
  await page.getByRole('heading', { name: /^求职空间\s*3$/ }).waitFor()
  await page.locator('article').getByRole('button', { name: '默认批次', exact: true }).waitFor()
  await screenshot('homepage-desktop')
  // Illustration selection -> PostgreSQL -> reload -> rendered card -> clickable menu.
  await page.getByRole('button', { name: '管理默认批次', exact: true }).click()
  await page.getByRole('menuitem', { name: '管理批次', exact: true }).click()
  const styleDrawer = page.getByRole('dialog')
  assert.equal(await styleDrawer.getByRole('button', { name: /^卡面：/ }).count(), 16)
  await styleDrawer.locator('img[src^="/batch-covers/"]').last().scrollIntoViewIfNeeded()
  await styleDrawer.locator('img[src^="/batch-covers/"]').first().scrollIntoViewIfNeeded()
  // Scroll through the lazy-loaded thumbnails before checking their decoded pixels.
  for (const image of await styleDrawer.locator('img[src^="/batch-covers/"]').all()) {
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((img) => img.decode())
    assert.ok(await image.evaluate((img) => img.naturalWidth > 0), 'Every illustration must load')
  }
  await styleDrawer.getByRole('button', { name: '卡面：月光花园', exact: true }).click()
  await styleDrawer.getByRole('button', { name: '青绿', exact: true }).click()
  await styleDrawer.getByRole('img', { name: '批次卡片预览：月光花园，青绿', exact: true }).scrollIntoViewIfNeeded()
  await screenshot('illustration-picker-desktop')
  await page.setViewportSize({ width: 320, height: 844 })
  assert.ok(await styleDrawer.evaluate((drawer) => drawer.scrollWidth <= drawer.clientWidth + 1), 'Illustration picker must fit small phones')
  await screenshot('illustration-picker-mobile')
  await styleDrawer.getByRole('button', { name: '保存修改', exact: true }).click()
  await styleDrawer.waitFor({ state: 'hidden' })
  const decorated = (await db.query('select card_style,color from recruitment_batches where id=$1', [source])).rows[0]
  assert.deepEqual(decorated, { card_style: 'moon-garden', color: 'teal' })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  const decoratedCard = page.locator('article').filter({ has: page.getByRole('button', { name: '默认批次', exact: true }) })
  await decoratedCard.locator('img').evaluate((img) => img.decode())
  assert.equal(await decoratedCard.locator('img').evaluate((img) => getComputedStyle(img.parentElement).pointerEvents), 'none')
  await screenshot('illustration-card-desktop')
  await page.getByRole('button', { name: '管理默认批次', exact: true }).click()
  await page.getByRole('menuitem', { name: '管理批次', exact: true }).click()
  assert.equal(await styleDrawer.getByRole('button', { name: '卡面：月光花园', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await styleDrawer.getByRole('button', { name: '青绿', exact: true }).getAttribute('aria-pressed'), 'true')
  await styleDrawer.getByRole('button', { name: '卡面：纯色', exact: true }).click()
  await styleDrawer.getByRole('button', { name: '保存修改', exact: true }).click()
  await styleDrawer.waitFor({ state: 'hidden' })
  assert.equal(await decoratedCard.locator('img').count(), 0)
  const coverManifest = JSON.parse(await readFile(new URL('../public/batch-covers/prompts.json', import.meta.url), 'utf8'))
  const galleryIds = []
  for (const [index, asset] of coverManifest.assets.entries()) {
    const id = crypto.randomUUID()
    galleryIds.push(id)
    await db.query('insert into recruitment_batches(id,user_id,name,description,color,card_style,created_at) values($1,$2,$3,$4,$5,$6,now()+make_interval(secs=>$7))', [id, user, asset.label, '插画卡面 · 主题色自由搭配', ['blue', 'teal', 'violet', 'amber', 'rose', 'slate'][index % 6], asset.id, 100 - index])
  }
  await page.setViewportSize({ width: 1440, height: 1750 })
  await page.reload()
  await page.getByRole('heading', { name: /^求职空间\s*18$/ }).waitFor()
  for (const image of await page.locator('article img').all()) await image.evaluate((img) => img.decode())
  await screenshot('illustration-gallery')
  await db.query('delete from recruitment_batches where id=any($1::uuid[])', [galleryIds])
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await page.getByRole('heading', { name: /^求职空间\s*3$/ }).waitFor()
  // Check the actual scrolling container: body overflow can hide an overflowing main.
  const longName = 'RecruitmentWorkspace'.repeat(4)
  const extraResumes = Array.from({ length: 6 }, () => crypto.randomUUID())
  const extraJobs = Array.from({ length: 4 }, () => crypto.randomUUID())
  for (const [index, id] of extraResumes.entries()) await db.query(`insert into resumes(id,user_id,batch_id,title,content,updated_at) values($1,$2,$3,$4,$5,now()-interval '1 day')`, [id, user, source, ['产品岗位版', '运营岗位版', '互联网秋招', '金融秋招', '通用岗位版', '暑期实习版'][index], JSON.stringify({ basic: { name: '小鱼', targetTitle: '产品经理' }, education: [{ school: '测试大学', major: '信息管理' }] })])
  for (const [index, id] of extraJobs.entries()) await db.query(`insert into applications(id,user_id,batch_id,company,position,channel,status) values($1,$2,$3,$4,$5,'官网','interviewing')`, [id, user, source, ['测试公司三', '测试公司四', '测试公司五', '测试公司六'][index], ['产品运营', '数据分析', '产品经理', '业务运营'][index]])
  await db.query(`update recruitment_batches set name=$1,description=$2 where id=$3`, [longName, 'DescriptionWithoutSpaces'.repeat(20), target])
  await db.query(`update resumes set title=$1 where id=$2`, ['ResumeDocumentWithoutSpaces'.repeat(12), resume])
  await db.query(`update applications set company=$1,position=$2,location=$3 where id=$4`, ['CompanyNameWithoutSpaces'.repeat(12), '产品经理与业务运营方向'.repeat(12), '工作地点'.repeat(30), job])
  await page.reload()
  await page.getByRole('button', { name: longName, exact: true }).waitFor()
  for (const [width, capacity, jobCapacity] of [[320, 1, 1], [360, 1, 1], [390, 1, 1], [640, 2, 2], [768, 3, 2], [1024, 4, 3], [1280, 5, 4], [1440, 5, 4], [1920, 5, 4]]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForFunction((count) => document.querySelector('[aria-label="最近简历"]').querySelectorAll('[role="listitem"]').length === count, capacity)
    await page.waitForFunction((count) => document.querySelector('[aria-label="最近岗位"]').querySelectorAll('[role="listitem"]').length === count, jobCapacity)
    const resumeTops = await page.getByRole('list', { name: '最近简历' }).getByRole('listitem').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top))
    assert.ok(resumeTops.every((top) => Math.abs(top - resumeTops[0]) <= 1), `Resumes must remain on one row at ${width}px`)
    const jobTops = await page.getByRole('list', { name: '最近岗位' }).getByRole('listitem').evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top))
    assert.ok(jobTops.every((top) => Math.abs(top - jobTops[0]) <= 1), `Jobs must remain on one row at ${width}px`)
    const dimensions = await page.locator('main').evaluate((main) => ({
      content: main.scrollWidth, viewport: main.clientWidth,
      document: document.documentElement.scrollWidth, window: window.innerWidth,
    }))
    assert.ok(dimensions.content <= dimensions.viewport + 1, `Homepage main overflows at ${width}px: ${JSON.stringify(dimensions)}`)
    assert.ok(dimensions.document <= dimensions.window + 1, `Homepage document overflows at ${width}px`)
    if (width >= 1280) {
      const resumeBox = await page.getByRole('list', { name: '最近简历' }).boundingBox()
      const jobBox = await page.getByRole('list', { name: '最近岗位' }).boundingBox()
      const contained = await page.getByRole('list', { name: '最近岗位' }).getByRole('button', { name: /^编辑 / }).evaluateAll((cards) => cards.every((card) => {
        const bounds = card.getBoundingClientRect()
        return [...card.children].every((child) => {
          const content = child.getBoundingClientRect()
          return content.top >= bounds.top - 1 && content.bottom <= bounds.bottom + 1
        })
      }))
      assert.ok(contained, `Job information must stay inside its card at ${width}px`)
      assert.ok(jobBox.y > resumeBox.y + resumeBox.height, `Jobs must occupy a separate section below resumes at ${width}px`)
    }
    if ([320, 768, 1280].includes(width)) await screenshot(`homepage-responsive-${width}`)
    if (width === 1280) {
      await page.getByRole('heading', { name: '最近编辑', exact: true }).scrollIntoViewIfNeeded()
      await screenshot('recent-workspace-layout')
    }
  }
  await db.query(`update recruitment_batches set name='2027届金融秋招',description='金融机构与国企岗位' where id=$1`, [target])
  await db.query(`update resumes set title='基础简历' where id=$1`, [resume])
  await db.query(`update applications set company='测试公司一',position='产品经理',location='' where id=$1`, [job])
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await page.getByRole('list', { name: '最近简历' }).getByRole('listitem').nth(4).waitFor()
  await page.getByRole('heading', { name: '最近编辑', exact: true }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
  await screenshot('recent-workspace-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.querySelector('[aria-label="最近简历"]').querySelectorAll('[role="listitem"]').length === 1)
  await page.getByRole('heading', { name: '最近编辑', exact: true }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
  await screenshot('recent-workspace-mobile')
  await db.query('delete from applications where id=any($1::uuid[])', [extraJobs])
  await db.query('delete from resumes where id=any($1::uuid[])', [extraResumes])
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await page.getByRole('heading', { name: /^求职空间\s*3$/ }).waitFor()
  await page.getByRole('region', { name: '简历', exact: true }).getByRole('button', { name: '打开简历：基础简历' }).waitFor()
  await page.getByRole('region', { name: '岗位', exact: true }).getByText('测试公司一', { exact: true }).waitFor()
  await screenshot('homepage-desktop')
  await page.locator('article').getByRole('button', { name: '默认批次', exact: true }).click()
  await page.getByRole('heading', { name: '默认批次' }).waitFor()
  assert.equal(await page.getByRole('checkbox').count(), 0, 'Batch detail cards must not expose selection controls')
  assert.equal(await page.getByRole('button', { name: /移动岗位|移动 \/ 复制/ }).count(), 0, 'Transfers must stay inside batch management')
  await screenshot('batch-detail-clean')
  await page.getByRole('button', { name: '管理批次', exact: true }).click()
  await page.getByRole('tab', { name: '内容管理', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '岗位', exact: true }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: '测试公司一 · 产品经理', exact: true }).check()
  await page.getByRole('combobox', { name: '选择批次', exact: true }).click()
  await page.getByRole('option', { name: '2027届金融秋招', exact: true }).click()
  await page.getByRole('button', { name: '预览移动 (1)' }).click()
  await page.getByText('在目标批次生成的独立简历副本 · 1').waitFor()
  await screenshot('transfer-preview')
  await page.getByRole('button', { name: '确认执行' }).click()
  await page.getByRole('button', { name: '预览移动 (0)' }).waitFor()
  const moved = (await db.query('select * from applications where id=$1', [job])).rows[0]
  assert.equal(moved.batch_id, target); assert.notEqual(moved.resume_id, resume)
  assert.equal((await db.query('select count(*)::int as count from resumes')).rows[0].count, 2)
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await screenshot('batch-detail')
  await page.getByRole('navigation', { name: '批次导航' }).getByRole('link', { name: '求职空间', exact: true }).click()
  await page.getByRole('button', { name: '新建批次', exact: true }).click()
  await page.getByLabel('批次名称').fill('2027届互联网秋招')
  await page.getByLabel('说明选填').fill('产品、运营与技术岗位')
  await page.getByRole('button', { name: '创建批次', exact: true }).click()
  await page.getByRole('button', { name: '2027届互联网秋招', exact: true }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await screenshot('homepage-mobile')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.getByRole('heading', { name: '最近编辑', exact: true }).scrollIntoViewIfNeeded()
  await screenshot('homepage-mobile-recent')
  assert.ok(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth + 1), 'Recent content must fit the mobile scrolling viewport')
  await page.getByRole('button', { name: '管理2027届互联网秋招' }).click()
  await page.getByRole('menuitem', { name: '管理批次' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: '关闭', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  assert.ok(await drawer.locator(':focus').count() === 1, 'Keyboard focus must stay in the drawer')
  await screenshot('manager-mobile')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.goto(`${origin}/editor?resumeId=${resume}`)
  await page.getByText('基本信息', { exact: true }).click()
  await page.getByPlaceholder('请输入姓名').waitFor()
  await page.reload()
  await page.getByText('基本信息', { exact: true }).click()
  await page.getByPlaceholder('请输入姓名').waitFor()
  assert.equal(await page.getByPlaceholder('请输入姓名').inputValue(), '小鱼')
  await screenshot('editor-toolbar-top')
  const rendering = page.waitForRequest((request) => request.url().includes('/render-resume-pdf') && request.method() === 'POST')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const renderRequest = await rendering
  assert.ok(!JSON.stringify(renderRequest.postDataJSON()).includes('batch_id'))
  const pdfDownload = await downloading
  const pdfPath = new URL('../.cache/batch-check/resume.pdf', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
  await pdfDownload.saveAs(pdfPath)
  const pdf = await readFile(pdfPath)
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.ok(pdf.length > 3000)
  assert.ok(pdf.includes(Buffer.from('/FontFile2')), 'Chinese fonts must remain embedded')
  const pdfTexts = await page.evaluate(async (bytes) => {
    const pdfjs = await import('/node_modules/pdfjs-dist/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs'
    const document = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
    const text = (await (await document.getPage(1)).getTextContent()).items.map((item) => item.str).join('')
    await document.destroy()
    return text
  }, Array.from(pdf))
  assert.ok(pdfTexts.includes('小鱼'))
  assert.ok(!pdfTexts.includes('默认批次'))
  await page.getByPlaceholder('请输入姓名').fill('修改未保存')
  await page.getByText('小鱼简历', { exact: true }).hover()
  await page.getByRole('button', { name: '首页', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('heading', { name: '有未保存的更改' }).waitFor()
  await page.getByRole('button', { name: '不保存，直接切换' }).click()
  await page.getByRole('heading', { name: /^求职空间/ }).waitFor()
  await page.locator('article').getByRole('button', { name: '默认批次', exact: true }).click()
  await page.getByRole('heading', { name: '默认批次' }).waitFor()
  assert.equal((await db.query('select content from resumes where id=$1', [resume])).rows[0].content.basic.name, '小鱼')
  await page.getByRole('button', { name: '上传', exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: 'batch-fixture.txt', mimeType: 'text/plain', buffer: Buffer.from('上传测试\n测试大学 本科\n求职意向：产品经理') })
  await page.getByRole('button', { name: '开始智能解析' }).click()
  await page.waitForURL((url) => url.pathname === '/editor')
  await page.getByPlaceholder('输入简历名称...').waitFor()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL((url) => url.searchParams.has('resumeId'))
  const uploaded = (await db.query('select * from resumes where id=$1', [new URL(page.url()).searchParams.get('resumeId')])).rows[0]
  assert.equal(uploaded.batch_id, source)
  assert.equal(uploaded.content.basic.name, '上传测试')
  await page.goto(`${origin}/editor?resumeId=${resume}&tab=jd`)
  await page.getByRole('combobox', { name: '选择 JD 历史岗位', exact: true }).click()
  await page.getByRole('option', { name: /测试公司二/ }).waitFor()
  assert.equal(await page.getByRole('option', { name: /测试公司一/ }).count(), 0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/applications?batch=${target}`)
  await page.getByRole('combobox', { name: '当前批次' }).filter({ hasText: '2027届金融秋招' }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Jobs page must fit a narrow viewport')
  await screenshot('applications-mobile')
  assert.equal(await page.getByText('Unexpected Application Error!', { exact: true }).count(), 0)
  await page.goto(`${origin}/analytics?batch=${target}`)
  await page.getByRole('combobox', { name: '当前批次' }).filter({ hasText: '2027届金融秋招' }).waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Analytics page must fit a narrow viewport')
  await screenshot('analytics-mobile')
  assert.equal(await page.getByText('Unexpected Application Error!', { exact: true }).count(), 0)
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log(JSON.stringify({ passed: true, checks: ['overview', '15 transparent illustrations load', 'illustration selection and independent theme persist across reload', 'plain style restoration', 'illustration picker at 320px', 'decorative layer does not intercept clicks', 'membership transfer through RPC and PostgreSQL', 'counts refresh', 'batch creation', 'desktop/mobile layout', 'drawer', 'editor reload', 'Chromium PDF export with embedded fonts and no batch metadata', 'dirty navigation', 'upload parse and first save membership', 'JD entry filters jobs by batch'], apiRequests: requests.length, screenshots: '.cache/batch-check' }, null, 2))
} catch (error) {
  await screenshot('failure')
  console.error(JSON.stringify({ url: page.url(), errors, requests: requests.slice(-15), alerts: await page.locator('[role="alert"]').allTextContents(), buttons: await page.getByRole('button').allTextContents() }, null, 2))
  throw error
} finally { await browser.close(); await db.close() }

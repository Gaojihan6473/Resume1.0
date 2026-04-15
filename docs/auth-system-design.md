# 密钥登录 + 简历云同步技术方案（极简版）

> 文档版本：v4.0
> 日期：2026-04-15
> 目标：最小实现难度，Supabase + Vercel 跑通

---

## 1. 核心流程

```
管理员在 Supabase Dashboard 插入密钥记录
          ↓
用户输入密钥 sk-xxx
          ↓
POST /api/auth/sign-in 验证
          ↓
成功 → 返回用户信息 + Supabase 会话 Cookie
          ↓
登录后默认回到首页 `/`
          ↓
若是从受限操作跳转到登录，登录成功后自动恢复原操作
```

---

## 2. 数据库设计

### 2.1 新增表

#### `public.valid_keys`

```sql
create table if not exists public.valid_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,           -- SHA-256 哈希
  key_name text not null,                  -- 密钥名称
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_valid_keys_key_hash on public.valid_keys(key_hash);
```

### 2.2 已有表复用

- `auth.users` - Supabase Auth 内置
- `public.user_profiles` - 用户信息
- `public.resumes` - 简历数据

若当前 Supabase 项目中尚未创建 `public.user_profiles` / `public.resumes`，先执行以下 SQL：

```sql
-- resumes 表（如果不存在）
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名简历',
  content jsonb not null default '{}',
  source text not null default 'blank',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- user_profiles 表（如果不存在）
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 2.3 RLS 策略

```sql
-- valid_keys：仅 service_role 访问
alter table public.valid_keys enable row level security;
create policy "valid_keys_service_role_only"
  on public.valid_keys for all
  to service_role using (true) with check (true);

-- resumes：仅本人可读写
alter table public.resumes enable row level security;
create policy "resumes_owner_rw"
  on public.resumes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_profiles：仅本人可读写
alter table public.user_profiles enable row level security;
create policy "profiles_owner_rw"
  on public.user_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 3. API 设计

### 3.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/sign-in | 密钥登录 |
| POST | /api/auth/sign-out | 登出 |
| GET | /api/auth/me | 获取当前用户 |

#### `POST /api/auth/sign-in`

```typescript
// 请求
{ "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }

// 成功 200
{
  "success": true,
  "user": { "id": "uuid", "email": "user@example.com", "keyName": "工作密钥" }
}

// 失败 401
{ "success": false, "error": "无效的密钥" }

// 失败 400（格式错误）
{ "success": false, "error": "密钥格式不正确" }

// 失败 503（服务暂时不可用）
{ "success": false, "error": "服务暂时不可用，请稍后重试" }
```

#### `POST /api/auth/sign-out`

```typescript
// 成功 200
{ "success": true }
```

#### `GET /api/auth/me`

```typescript
// 已登录 200
{
  "authenticated": true,
  "user": { "id": "uuid", "email": "user@example.com", "keyName": "工作密钥" }
}

// 未登录 401
{ "authenticated": false }
```

### 3.2 简历

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/resumes | 简历列表 |
| POST | /api/resumes | 创建简历 |
| GET | /api/resumes/:id | 获取简历 |
| PUT | /api/resumes/:id | 更新简历 |
| DELETE | /api/resumes/:id | 删除简历 |

---

## 4. 目录结构

```
api/
├── auth/
│   ├── sign-in.ts
│   ├── sign-out.ts
│   └── me.ts
├── resumes/
│   ├── index.ts
│   └── [id].ts
└── _lib/
    ├── supabase.ts
    └── session.ts

src/
├── pages/
│   ├── LoginPage.tsx
│   ├── MePage.tsx
│   └── EditorPage.tsx
├── components/
│   ├── ProtectedRoute.tsx
│   └── AuthRequiredModal.tsx
├── store/
│   ├── authStore.ts
│   └── resumeStore.ts
└── lib/
    └── api.ts
```

---

## 5. 前端交互

### 5.1 登录页 `/login`

- 简洁界面：密钥输入框 + 登录按钮
- 无注册入口
- 登录成功默认跳转首页 `/`
- 使用 URL 参数传递待恢复动作：`/login?action=new` 或 `/login?action=upload`
- 登录成功后解析 `action` 并执行原操作，执行完成后清理 URL 参数（不保留 `action`）

### 5.2 侧栏按钮

- 未登录："登录" → `/login`
- 已登录："我的" → `/me`（保留入口）

### 5.3 未登录操作引导

- 点击"新建"/"上传"时未登录 → 弹出 `AuthRequiredModal` → "去登录"
- "去登录"时跳转到带参数地址：
- 新建：`/login?action=new`
- 上传：`/login?action=upload`
- 登录成功后自动执行对应动作

### 5.4 会话初始化（避免闪屏）

- `authStore` 增加 `authInitializing` 状态（初始为 `true`）
- App 启动先执行 `supabase.auth.getSession()`
- `authInitializing=true` 时，受保护区域统一显示骨架屏/加载态
- 初始化完成后再渲染登录态内容，避免“先未登录再跳回”的闪屏
- 当前项目基于 Vite，按 CSR 方案实现即可
- 若后续迁移 SSR（如 Next.js），需在服务端读取会话并将初始登录态注入首屏，避免 SSR/CSR 状态抖动

### 5.5 本地/云端状态提示（轻量版）

- 编辑页顶部增加同步状态文本：
- `仅本地`：未登录或仅本地草稿
- `同步中...`：正在写入云端
- `已同步`：最近一次保存成功
- `同步失败`：写入失败，可重试
- `同步失败` 时展示 `重试` 按钮，由用户手动触发重试
- 单次操作最多重试 3 次；超过后提示 `云端保存失败，已保留本地备份`

### 5.6 错误反馈文案分级

- 密钥格式错误：`密钥格式不正确`
- 密钥校验失败：`密钥无效，请检查后重试`
- 网络异常：`网络异常，请检查连接`
- 服务异常：`服务暂时不可用，请稍后重试`
- 前端使用 Toast + 输入框下短文案双通道反馈

### 5.7 初始化加载优先级与合并策略（防重复）

- 启动阶段只做一次初始化加载（hydrate），由 `authInitializing` 控制
- 未登录：仅加载本地草稿（localStorage），不请求云端
- 已登录：先请求云端，再决定是否使用本地草稿，不做“双源同时渲染”
- 优先级规则：
- 云端有数据：以云端为准覆盖编辑器状态
- 云端无数据且本地有草稿：使用本地草稿
- 云端和本地都为空：使用默认空白简历
- 合并策略：不做数组拼接（append），只做单份替换（replace）
- 去重规则：每份简历使用稳定 `id`，云端写入使用 `upsert(id)`，避免重复创建
- 首次登录迁移：若本地存在草稿且云端为空，用户手动触发“同步到云端”一次即可；成功后仍保留本地备份

---

## 6. 会话管理

使用 Supabase Auth 的 session Cookie（`HttpOnly + Secure`），由 `@supabase/supabase-js` 自动处理。

前端通过 `supabase.auth.getSession()` 初始化状态。

登录后路由规则：

- 默认跳转 `/`
- 若 URL 含 `action`，优先恢复原操作（新建/上传），完成后移除该参数

登出交互规则：

- 若编辑器存在未保存改动，点击“登出”先弹确认框：`当前有未保存内容，确认退出登录？`
- 用户确认后调用 `/api/auth/sign-out`
- 用户取消则停留当前页，不清空本地编辑内容
- 用户确认登出后：仅清除云端会话；本地草稿（localStorage）保留，不受登录状态影响

---

## 7. 部署步骤

### 7.1 Supabase

1. 在 Dashboard 创建项目
2. 执行数据库迁移 SQL（`valid_keys` + `resumes` + `user_profiles` + RLS）
3. 在 SQL Editor 创建用户和密钥：

```sql
-- 1. 创建用户（Supabase Auth 会自动创建 auth.users）
-- 在 Authentication → Users → Add user 创建

-- 2. 插入密钥记录（需要用户的 uuid）
-- 先获取用户 id：select id from auth.users where email = 'xxx';

insert into public.valid_keys (user_id, key_hash, key_name)
values (
  '用户的-uuid',
  'sk-xxx 的 SHA256 哈希',
  '工作密钥'
);
```

### 7.2 生成密钥

管理员在项目根目录运行以下命令生成密钥：

```bash
node -e "
const crypto = require('crypto');
const key = 'sk-' + crypto.randomBytes(16).toString('base64').replace(/[+/=]/g, '');
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log('密钥（交给用户）:', key);
console.log('哈希（存数据库）:', hash);
"
```

**示例输出**：
```
密钥（交给用户）: sk-a1B2c3D4e5F6g7H8i9J0
哈希（存数据库）: 8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f
```

### 7.3 插入密钥到数据库

```sql
-- 1. 在 Supabase Dashboard → Authentication → Users → Add user 创建用户
-- 2. 获取用户的 UUID

-- 3. 插入密钥记录
INSERT INTO public.valid_keys (user_id, key_hash, key_name)
VALUES (
  '<用户的UUID>',
  '<生成的哈希值>',
  '工作密钥'
);
```

### 7.4 生成 10 个测试密钥

预留后续使用，管理员可按需生成并记录：

| 序号 | 密钥 | 哈希值 | 状态 |
|------|------|--------|------|
| 1 | sk- | | 待生成 |
| 2 | sk- | | 待生成 |
| ... | ... | ... | ... |

> 实际使用时再生成，记录在安全的地方（密码管理器等）。

### 7.5 Vercel 部署

```bash
# 设置环境变量
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY

# 部署
vercel deploy
```

---

## 8. 实现顺序

### Step 1：数据库

1. 创建 `auth.users` 用户
2. 创建 `public.valid_keys` 表
3. 插入密钥记录

### Step 2：后端 API

1. `api/auth/sign-in.ts` - 核心登录逻辑
2. `api/auth/me.ts` - 获取当前用户
3. `api/auth/sign-out.ts` - 登出
4. `api/resumes/index.ts` - 简历 CRUD
5. `api/resumes/[id].ts` - 单个简历操作

### Step 3：前端

1. `authStore.ts` - 认证状态
2. `LoginPage.tsx` - 登录页
3. `ProtectedRoute.tsx` - 路由守卫
4. `MePage.tsx` - 简历列表
5. 顶部栏云端联动

---

## 9. 最小依赖

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

---

## 10. 后续扩展（可选）

- 管理后台（增删密钥）
- 密钥禁用/启用
- 使用统计
- 简历导入/导出

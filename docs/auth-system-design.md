# 密钥登录与云同步

本页说明当前登录链路和维护入口。早期 API 与 Cookie 方案可在 Git 历史中查阅。

## 登录与会话

- 前端通过 [auth.ts](../src/lib/api/auth.ts) 调用 `VITE_EDGE_FUNCTIONS_URL` 下的 `auth-sign-in`。
- [登录 Edge Function](../supabase/functions/auth-sign-in/index.ts) 对输入的 `sk-...` 密钥做 SHA-256 校验，查询有效的 `public.valid_keys` 记录，并用服务端生成的 magic link 交换 Supabase 会话。
- 前端将返回的 access token 和 refresh token 交给 [Supabase 客户端](../src/lib/supabase.ts)，登录状态由 [authStore](../src/store/authStore.ts) 恢复。退出时先清理本地会话，再请求服务端撤销。
- 简历数据和文件分别由 [resumes.ts](../src/lib/api/resumes.ts) 与 [storage.ts](../src/lib/api/storage.ts) 访问。权限以项目的 [数据库迁移](../supabase/migrations) 为准。

## 发放登录密钥

按 [仓库的登录密钥约定](../AGENTS.md#login-key-creation) 使用 `npm run keys:create`。该 [脚本](../scripts/create-login-keys.mjs) 通过 Supabase Auth Admin API 创建用户，保存密钥哈希，并默认调用 `auth-sign-in` 验证。执行前核对实际的 Supabase 和 Edge Function 地址。明文密钥只在生成时交付。

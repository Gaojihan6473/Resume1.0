import { supabase } from '../supabase'
import type { DashboardConfig, SavedDashboard } from '../../types/dashboard'
import { validateDashboard } from '../../utils/dashboard'

async function assertOwner(owner: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.id !== owner) throw new Error('登录状态已变化，请重新打开看板')
}
function apiError(error: { code?: string; message: string }) {
  if (['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error.code || '')) return new Error('看板配置服务尚未就绪，请先应用看板数据库迁移后重试')
  if (error.code === '40001' || error.code === '23505') return new Error('看板已在其他窗口更新，请重新加载后再编辑；当前草稿仍保留')
  return new Error('看板配置读写失败，请重试')
}
export async function fetchDashboard(owner: string): Promise<SavedDashboard | null> {
  await assertOwner(owner)
  const { data, error } = await supabase.from('dashboard_configs').select('config,revision').eq('user_id', owner).maybeSingle()
  await assertOwner(owner)
  if (error) throw apiError(error)
  if (!data) return null
  return { config: validateDashboard(data.config), revision: data.revision }
}
export async function saveDashboard(owner: string, config: DashboardConfig, revision: number): Promise<SavedDashboard> {
  await assertOwner(owner)
  const validated = validateDashboard(config)
  const { data, error } = await supabase.rpc('save_dashboard_config', { p_config: validated, p_revision: revision })
  await assertOwner(owner)
  if (error) throw apiError(error)
  if (!data || !Number.isInteger(data.revision)) throw new Error('看板保存结果无效，请重新加载确认')
  return { config: validateDashboard(data.config), revision: data.revision }
}

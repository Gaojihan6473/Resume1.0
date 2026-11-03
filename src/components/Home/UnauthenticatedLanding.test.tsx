import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UnauthenticatedLanding } from './UnauthenticatedLanding'

afterEach(cleanup)

describe('未登录首页', () => {
  it('两个开始入口分别保留导入和新建意图，键盘可用', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    const onCreate = vi.fn()
    render(<UnauthenticatedLanding onImport={onImport} onCreate={onCreate} />)
    await user.click(screen.getByRole('button', { name: '导入现有简历' }))
    expect(onImport).toHaveBeenCalledTimes(1)
    const create = screen.getByRole('button', { name: '从空白创建' })
    create.focus()
    await user.keyboard('{Enter}')
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  it('切换示例版本会更新预览，同时不触发真实创建或导入', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    const onCreate = vi.fn()
    render(<UnauthenticatedLanding onImport={onImport} onCreate={onCreate} />)
    await user.click(screen.getByRole('button', { name: '用户运营版' }))
    expect(screen.getByRole('button', { name: '用户运营版' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('简历示例内容')).toHaveTextContent('用户运营 / 3 年经验')
    await user.click(screen.getByRole('button', { name: '基础简历' }))
    expect(screen.getByLabelText('简历示例内容')).toHaveTextContent('产品与运营 / 3 年经验')
    expect(onImport).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('小鱼支持键盘换提示，循环后回到第一条', async () => {
    const user = userEvent.setup()
    render(<UnauthenticatedLanding onImport={vi.fn()} onCreate={vi.fn()} />)
    const fish = screen.getByRole('button', { name: '小鱼，换一条提示' })
    const bubble = screen.getByRole('status', { name: '小鱼提示' })
    const first = bubble.textContent
    fish.focus()
    await user.keyboard('{Enter}')
    expect(bubble.textContent).not.toBe(first)
    await user.click(fish)
    await user.click(fish)
    expect(bubble.textContent).toBe(first)
  })

  it('岗位说明和预览同步，不把产品经理的重点留在运营版本中', async () => {
    const user = userEvent.setup()
    render(<UnauthenticatedLanding onImport={vi.fn()} onCreate={vi.fn()} />)
    const panel = screen.getByRole('complementary', { name: '示例岗位重点' })
    expect(within(panel).getByRole('heading', { name: '工具产品经理' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '用户运营版' }))
    expect(within(panel).getByRole('heading', { name: '用户运营' })).toBeInTheDocument()
    expect(panel).toHaveTextContent('社群反馈')
    expect(panel).not.toHaveTextContent('A/B 测试')
    await user.click(screen.getByRole('button', { name: '基础简历' }))
    expect(within(panel).getByRole('heading', { name: '完整经历' })).toBeInTheDocument()
  })

  it('岗位提示支持打开、Escape 关闭和点击外部关闭', async () => {
    const user = userEvent.setup()
    render(<UnauthenticatedLanding onImport={vi.fn()} onCreate={vi.fn()} />)
    const hint = screen.getByRole('button', { name: '查看岗位版本提示' })
    await user.click(hint)
    expect(hint).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('原稿好好留着')
    await user.keyboard('{Escape}')
    expect(hint).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(hint).toHaveFocus()
    await user.click(hint)
    await user.click(screen.getByRole('heading', { name: /你的经历/ }))
    expect(hint).toHaveAttribute('aria-expanded', 'false')
  })
})

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Check, FileText, GitBranch, Plus, Sparkles, Target, Upload, CircleHelp } from 'lucide-react'
import { FishMascot } from '../Brand/FishMascot'
import './UnauthenticatedLanding.css'

const examples = [
  {
    name: '基础简历', role: '产品与运营',
    target: '完整经历', tags: ['产品规划', '用户研究', '运营实践'],
    focus: [['完整记录', '产品与运营经历，一起保留'], ['积累成果', '12 次迭代，18 项体验优化'], ['真实为先', '保留事实，再调整表达']],
    summary: '3 年互联网产品与运营经验，参与工具类产品从需求调研到上线迭代的完整流程，熟悉用户研究、数据分析与跨团队协作。',
    achievements: ['参与简历编辑器与用户成长体系建设，协同设计、研发完成 12 次版本迭代。', '搭建用户反馈台账，整理 200 余条有效反馈，推动 18 项体验问题优化。'],
    project: '在线文档协作平台 · 体验与增长',
    projectRole: '产品规划 / 用户运营',
    projectDetails: ['完成 24 场用户访谈，梳理新手引导与协作分享的关键问题。', '联合运营团队优化引导流程，推动新用户首周激活率由 32% 提升至 45%。'],
    skills: 'Figma · Axure · SQL · Excel · 用户研究 · 内容运营',
  },
  {
    name: '产品经理版', role: '产品经理',
    target: '工具产品经理', tags: ['需求分析', '产品设计', '数据驱动'],
    focus: [['用户洞察', '24 场访谈，定位体验问题'], ['产品成果', '激活率 32% → 45%'], ['方案验证', '从原型设计到 A/B 测试']],
    summary: '3 年工具类产品经验，擅长将用户需求转化为可落地的产品方案。具备需求分析、原型设计与数据验证能力，关注效率与体验。',
    achievements: ['负责文档编辑与协作模块，独立完成 PRD、交互原型及验收标准，推动 12 次迭代上线。', '结合漏斗分析与用户访谈重构新手引导，首周激活率由 32% 提升至 45%。'],
    project: '在线文档协作平台 · 新手体验优化',
    projectRole: '产品负责人',
    projectDetails: ['访谈 24 位用户，定位首次创建、分享协作两处流失节点，梳理需求优先级。', '设计渐进式引导与模板推荐，通过 A/B 测试验证方案，首次创建耗时缩短 28%。'],
    skills: '需求分析 · Figma / Axure · SQL · A/B 测试 · 敏捷协作',
  },
  {
    name: '用户运营版', role: '用户运营',
    target: '用户运营', tags: ['用户分层', '社群运营', '数据复盘'],
    focus: [['用户激活', '激活率 32% → 45%'], ['社群反馈', '200 余条反馈，18 项优化'], ['持续复盘', '用户分层，按周跟进效果']],
    summary: '3 年工具类产品与运营经验，熟悉用户分层、社群维护与新用户激活。善于结合用户反馈与行为数据，制定可执行的运营方案。',
    achievements: ['建立新用户分层与触达策略，联动产品优化引导，首周激活率由 32% 提升至 45%。', '维护核心用户社群，累计沉淀 200 余条有效反馈，推动 18 项体验优化。'],
    project: '在线文档协作平台 · 用户成长计划',
    projectRole: '用户运营负责人',
    projectDetails: ['基于用户活跃度设计分层规则，策划模板共创与每周技巧分享，持续回收使用反馈。', '联合产品团队完善引导与消息触达，建立激活数据看板，按周复盘运营效果。'],
    skills: '用户分层 · 社群运营 · 活动策划 · Excel · 数据复盘',
  },
]

const steps = [
  { title: '建立基础简历', description: '导入已有文件，或从空白开始。', icon: FileText },
  { title: '添加目标岗位', description: '录入 JD，整理岗位要求。', icon: Target },
  { title: '打磨专属版本', description: '分析匹配点，编辑并导出简历。', icon: GitBranch },
]

export function UnauthenticatedLanding({ onImport, onCreate }: { onImport: () => void; onCreate: () => void }) {
  const [selected, setSelected] = useState(1)
  const [tipIndex, setTipIndex] = useState(0)
  const example = examples[selected]
  const tips = [selected === 0 ? '先把经历装好，再挑出适合岗位的亮点。' : '换个岗位，亮点也能换个角度～', '原稿帮你留好啦，放心试试新版本。', '简历不用写满，把最相关的留下。']

  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-eyebrow"><Sparkles size={15} aria-hidden="true" />小鱼简历 · JD 定制工作台</p>
          <h1 id="landing-title">你的经历，值得<span>更合适的表达。</span></h1>
          <p className="landing-description">一份基础简历，多种岗位版本。<br />从整理经历到匹配 JD，把每一次投递准备得更好。</p>
          <div className="landing-actions">
            <button type="button" className="landing-action landing-action-primary" onClick={onImport}>
              <Upload size={18} aria-hidden="true" />导入现有简历<ArrowRight className="landing-action-arrow" size={17} aria-hidden="true" />
            </button>
            <button type="button" className="landing-action landing-action-secondary" onClick={onCreate}>
              <Plus size={18} aria-hidden="true" />从空白创建
            </button>
          </div>
          <p className="landing-hint">支持 PDF、DOCX、TXT<span aria-hidden="true"> · </span><span>登录后开始编辑</span></p>
        </div>

        <div className="landing-showcase">
          <div className="landing-guide">
            <button type="button" className="landing-fish" aria-label="小鱼，换一条提示" onClick={() => setTipIndex(index => (index + 1) % tips.length)}>
              <FishMascot />
            </button>
            <div className="landing-bubble" role="status" aria-label="小鱼提示" aria-live="polite" aria-atomic="true"><span>{tips[tipIndex]}</span><small>小鱼陪你准备下一次机会</small></div>
          </div>
          <div className="landing-demo" role="group" aria-label="岗位简历版本示例">
            <div className="landing-demo-bar"><div className="landing-window-dots" aria-hidden="true"><i /><i /><i /></div><span>我的简历工作台</span><span className="landing-example-label">虚构示例 · 可切换版本</span></div>
            <div className="landing-demo-body">
              <div className="landing-versions">
                <p>简历版本</p>
                <div className="landing-version-list" role="group" aria-label="切换示例版本">
                  {examples.map((item, index) => (
                    <button type="button" key={item.name} aria-pressed={selected === index} onClick={() => { setSelected(index); setTipIndex(0) }}>
                      {index === 0 ? <FileText size={16} aria-hidden="true" /> : <Target size={16} aria-hidden="true" />}<span>{item.name}</span>
                      {selected === index && <i aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <div className="landing-demo-note"><GitBranch size={14} aria-hidden="true" /><span>基础版独立保留<br />岗位版本分别编辑</span></div>
              </div>
              <div className="landing-document-wrap">
                <div className="landing-document-toolbar"><span><FileText size={12} aria-hidden="true" />{example.name}</span><span>A4 · 1 页</span></div>
                <article className="landing-document" aria-label="简历示例内容" aria-live="polite" aria-atomic="true">
                  <div key={selected} className="landing-document-content">
                  <div className="landing-person"><div><h2>林晓</h2><p>{example.role} / 3 年经验</p></div><span className="landing-resume-monogram" aria-hidden="true">LX</span></div>
                  <p className="landing-contact">杭州 · 138 **** 8026 · linxiao@example.com</p>
                  <h3>个人优势</h3><p>{example.summary}</p>
                  <h3>工作经历</h3><div className="landing-job"><strong>青禾科技 · 产品与运营</strong><span>2023.07 — 至今</span></div>
                  <ul>{example.achievements.map(item => <li key={item}>{item}</li>)}</ul>
                  <h3>项目经历</h3><div className="landing-job"><strong>{example.project}</strong><span>2024.03 — 2024.09</span></div>
                  <p className="landing-project-role">{example.projectRole}</p>
                  <ul>{example.projectDetails.map(item => <li key={item}>{item}</li>)}</ul>
                  <h3>教育经历</h3><div className="landing-job"><strong>浙江工商大学</strong><span>2019.09 — 2023.06</span></div><p>信息管理与信息系统 · 本科</p>
                  <h3>专业技能</h3><p>{example.skills}</p>
                  <div className="landing-page-number" aria-hidden="true">1 / 1</div>
                  </div>
                </article>
              </div>
              <aside className="landing-inspector" aria-label="示例岗位重点">
                <div className="landing-target" aria-live="polite" aria-atomic="true">
                  <p className="landing-inspector-kicker">{selected === 0 ? '基础版本' : '目标岗位'}</p>
                  <h3>{example.target}</h3>
                  <p className="landing-target-meta">{selected === 0 ? '完整积累 · 独立保留' : '杭州 · 1–3 年经验'}</p>
                  <div className="landing-tags">{example.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                </div>
                <div className="landing-focus">
                  <div className="landing-focus-heading">这一版，突出什么<LandingHint key={selected} /></div>
                  <ul key={selected} className="landing-focus-list">{example.focus.map(([title, detail], index) => <li key={title}><span className="landing-focus-number">0{index + 1}</span><div><h4>{title}</h4><p>{detail}</p></div></li>)}</ul>
                </div>
                <div className="landing-export-example">
                  <p><Check size={12} aria-hidden="true" />让经历更好地被看见</p>
                  <div className="landing-files">{[['PDF', '正式投递'], ['DOCX', '继续编辑']].map(([format, description]) => <div key={format}><span className="landing-file-icon">{format}</span><small>{description}</small></div>)}</div>
                </div>
              </aside>
            </div>
            <div className="landing-demo-footer"><span><Check size={12} aria-hidden="true" />同一段经历，针对不同岗位表达</span><span>PDF / DOCX</span></div>
          </div>
        </div>
      </section>

      <ol className="landing-steps" aria-label="简历定制流程">
        {steps.map(({ title, description, icon: Icon }, index) => <li key={title}><span className="landing-step-number">0{index + 1}</span><div><h2><Icon size={15} aria-hidden="true" />{title}</h2><p>{description}</p></div></li>)}
      </ol>
      <footer className="landing-footer"><span>小鱼简历<span aria-hidden="true"> / </span>让经历更好地被看见</span><span>为每一次投递，认真准备。</span></footer>
    </div>
  )
}

function LandingHint() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [open])

  return <div ref={ref} className="landing-hint-control" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={buttonRef} type="button" aria-label="查看岗位版本提示" aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined} onClick={() => setOpen(value => !value)}><CircleHelp size={16} aria-hidden="true" /></button>
    {open && <div id={id} role="tooltip" className="landing-version-tooltip">原稿好好留着，这一版只调整适合岗位的表达。</div>}
  </div>
}

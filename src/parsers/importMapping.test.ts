import { describe, expect, it } from 'vitest'
import { assembleImport, decodeImportResponse, retainUnresolved } from './importMapping'
import type { ImportGroup } from './importMapping'
import { documentFromText } from './sourceDocument'
import { normalizeResumeData } from '../utils/resumeData'
import { applyReferenceTemplate } from '../utils/template'
import { buildResumePdfHtml } from '../utils/resumeHtmlRenderer'

const group = (kind: ImportGroup['kind'], blockIds: string[], fields = {}, bodyIds = blockIds, entryId = blockIds[0]): ImportGroup => ({ kind, blockIds, fields, bodyIds, entryId })

describe('source-backed resume import', () => {
  it('keeps course supplements with education and moves explicitly labelled awards', () => {
    const source = documentFromText('示例大学\n竞赛奖项：2023年建模二等奖\n；2024年创业金奖\n关键课程：数据库、运筹学')
    const result = assembleImport(source, [group('education', ['p1-b1', 'p1-b2', 'p1-b3'], { school: '示例大学' }, ['p1-b2', 'p1-b3']), group('education', ['p1-b4'])])
    expect(result.data.education).toHaveLength(1)
    expect(result.data.education[0].description).toContain('关键课程：数据库、运筹学')
    expect(result.data.skills.awards.join('\n')).toContain('2023年建模二等奖\n；2024年创业金奖')
  })

  it('retains the source section order instead of forcing summary after projects', () => {
    const source = documentFromText('示例大学\n自我描述\n示例公司\n项目甲\nPython')
    const result = assembleImport(source, [
      group('education', ['p1-b1'], { school: '示例大学' }),
      group('summary', ['p1-b2']),
      group('internships', ['p1-b3'], { company: '示例公司' }),
      group('projects', ['p1-b4'], { name: '项目甲' }),
      group('technical', ['p1-b5']),
    ])
    expect(result.data.sectionOrder).toEqual(['education', 'summary', 'internships', 'projects', 'skills'])
  })

  it('keeps each multiline student work item together', () => {
    const source = documentFromText('2024年 学生会负责人\n组织5场校园活动')
    expect(assembleImport(source, [group('studentWork', ['p1-b1', 'p1-b2'])]).data.skills.studentWork).toEqual(['2024年 学生会负责人\n组织5场校园活动'])
  })
  it('renders PDF headers once and joins physical wraps inside the same bullet', () => {
    const source = {
      rawText: '',
      pages: [{ number: 1, width: 600, height: 800, scan: false, blocks: [
        { id: 'p1-b1', page: 1, origin: 'native' as const, text: '示例大学 2024年9月 - 2026年6月', box: [20, 760, 400, 12] as [number, number, number, number] },
        { id: 'p1-b2', page: 1, origin: 'native' as const, text: '数据科学 | 硕士', box: [20, 744, 150, 12] as [number, number, number, number] },
        { id: 'p1-b3', page: 1, origin: 'native' as const, text: '示例公司 2026.01 - 2026.04', box: [20, 700, 400, 12] as [number, number, number, number] },
        { id: 'p1-b4', page: 1, origin: 'native' as const, text: '产品经理 | 产品部 | 北京', box: [20, 684, 240, 12] as [number, number, number, number] },
        { id: 'p1-b5', page: 1, origin: 'native' as const, text: '▸ 【策略】负责产品分', box: [20, 665, 400, 12] as [number, number, number, number] },
        { id: 'p1-b6', page: 1, origin: 'native' as const, text: '析，转化率提升15%。', box: [40, 649, 400, 12] as [number, number, number, number] },
      ] }],
    }
    const result = assembleImport(source, [
      group('education', ['p1-b1', 'p1-b2'], { school: '示例大学', startDate: '2024年9月', endDate: '2026年6月', major: '数据科学', degree: '硕士' }),
      group('internships', ['p1-b3', 'p1-b4', 'p1-b5', 'p1-b6'], { company: '示例公司', startDate: '2026.01', endDate: '2026.04', position: '产品经理', department: '产品部', location: '北京' }),
    ])
    expect(result.data.education[0].description).toBe('')
    expect(result.data.internships[0].content).toBe('<ul><li>【策略】负责产品分析，转化率提升15%。</li></ul>')
    expect(result.unresolved).toHaveLength(0)
  })
  it('keeps only the unique rank and award note from mixed PDF header rows', () => {
    const source = documentFromText('示例大学\n新闻传播广告 | 专业排名：9/70\n2023.02-2023.08 HBN早C晚A方案 | 项目负责人 【国家级奖项】')
    const result = assembleImport(source, [
      group('education', ['p1-b1', 'p1-b2'], { school: '示例大学', major: '新闻传播广告' }),
      group('projects', ['p1-b3'], { name: 'HBN早C晚A方案', role: '项目负责人', startDate: '2023.02', endDate: '2023.08' }),
    ])
    expect(result.data.education[0].description).toBe('专业排名：9/70')
    expect(result.data.projects[0].content).toBe('<p>【国家级奖项】</p>')
  })
  it('keeps unsupported sections and original numeric facts in their specified categories', () => {
    const source = documentFromText('校园经历\n摄影社 2024.01\n作品阅读3W+\n学生工作\n辅导员，组织5场活动\n荣誉奖项\n2023年国家级奖项\n具备用户洞察能力')
    const result = assembleImport(source, [group('heading', ['p1-b1']), group('campus', ['p1-b2', 'p1-b3'], { name: '摄影社', startDate: '2024.01' }, ['p1-b3']), group('heading', ['p1-b4', 'p1-b6']), group('studentWork', ['p1-b5']), group('awards', ['p1-b7'])])
    const data = retainUnresolved(result)
    expect(data.projects[0].name).toBe('摄影社')
    expect(data.projects[0].content).toContain('3W+')
    expect(data.skills.studentWork).toEqual(['辅导员，组织5场活动'])
    expect(data.skills.awards).toEqual(['2023年国家级奖项'])
    expect(data.skills.other.join('')).toContain('具备用户洞察能力')
  })

  it('does not accept invented dates or numeric outcomes and preserves the source for review', () => {
    const source = documentFromText('示例公司 2024.01-2024.06\n转化率提升15%')
    const result = assembleImport(source, [group('internships', ['p1-b1', 'p1-b2'], { company: '示例公司', startDate: '2025.01', position: '负责人' }, ['p1-b2'])])
    expect(result.data.internships[0].startDate).toBe('')
    expect(result.data.internships[0].position).toBe('')
    expect(result.data.internships[0].content).toContain('2024.01-2024.06')
    expect(result.data.internships[0].content).toContain('15%')
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('detects duplicate and missing references without dropping unmatched text', () => {
    const source = documentFromText('SQL\n未分类事实')
    const result = assembleImport(source, [group('technical', ['p1-b1']), group('technical', ['p1-b1', 'missing'])])
    expect(result.data.skills.technical).toEqual(['SQL'])
    expect(result.issues).toContain('发现重复的原文引用')
    expect(retainUnresolved(result).skills.other[0]).toContain('未分类事实')
  })

  it('flags repeated references inside one group while retaining the content once', () => {
    const source = documentFromText('完整技能 Python')
    const result = assembleImport(source, [group('technical', ['p1-b1', 'p1-b1'])])
    expect(result.data.skills.technical).toEqual(['完整技能 Python'])
    expect(result.problemIds).toEqual(['p1-b1'])
  })

  it('joins cross-page continuation using explicit source identity', () => {
    const source = documentFromText('公众号项目\n第一页正文\n第二页续接')
    const result = assembleImport(source, [group('projects', ['p1-b1', 'p1-b2'], { name: '公众号项目' }, ['p1-b2']), group('projects', ['p1-b3'], {}, ['p1-b3'], 'p1-b1')])
    expect(result.data.projects).toHaveLength(1)
    expect(result.data.projects[0].content).toContain('第一页正文')
    expect(result.data.projects[0].content).toContain('第二页续接')
  })

  it('accepts scanned text only from attached pages and preserves it via references', () => {
    const source = { rawText: '', pages: [{ number: 1, width: 600, height: 800, scan: true, blocks: [], image: 'data:image/jpeg;base64,YQ==' }] }
    const response = decodeImportResponse(JSON.stringify({ groups: [group('awards', ['p1-o1'])], ocrBlocks: [{ id: 'p1-o1', page: 1, text: '2023奖学金' }, { id: 'p2-o1', page: 2, text: '越界' }] }), source)
    expect(response.ocrBlocks).toHaveLength(1)
    const result = assembleImport({ ...source, pages: [{ ...source.pages[0], blocks: response.ocrBlocks }] }, response.groups)
    expect(result.data.skills.awards).toEqual(['2023奖学金'])
  })

  it('preserves legacy child titles and unique bullets, without duplicating existing rich text', () => {
    const original = normalizeResumeData({ internships: [{ company: '示例', content: '<p>原有正文</p>', projects: [{ title: '子项目标题', bullets: ['原有正文', '独有成果15%'] }] }] })
    const data = applyReferenceTemplate(original)
    expect(data.internships[0].content).toContain('子项目标题')
    expect(data.internships[0].content).toContain('独有成果15%')
    expect(data.internships[0].content.match(/原有正文/g)).toHaveLength(1)
    expect(applyReferenceTemplate(data)).toEqual(data)
  })

  it('adds empty categories to old resumes and retains new multiline categories on reload', () => {
    const old = normalizeResumeData({ skills: { technical: ['SQL'] } })
    expect(old.skills.studentWork).toEqual([])
    const saved = normalizeResumeData({ ...old, skills: { ...old.skills, studentWork: ['2024年\n学生工作'], awards: ['奖学金'], other: ['自我描述'] } })
    expect(applyReferenceTemplate(normalizeResumeData(JSON.parse(JSON.stringify(saved)))).skills).toEqual(saved.skills)
  })
  it('shows non-985 education tags and avoids repeating an existing skills label', () => {
    const data = normalizeResumeData({ education: [{ school: '示例大学', schoolTags: ['QS:11', '211工程'] }], skills: { technical: ['技术能力：SQL、Python'] } })
    const html = buildResumePdfHtml(data)
    expect(html).toContain('QS:11')
    expect(html).toContain('211工程')
    expect(html).not.toContain('技术技能：</strong>技术能力：')
  })
})

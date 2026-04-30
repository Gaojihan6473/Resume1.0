import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Maximize2, Network } from 'lucide-react'
import type { Application, ApplicationStatus } from '../../types/application'
import { APPLICATION_CHANNEL_LABELS, APPLICATION_STATUS_LABELS } from '../../types/application'
import type { Resume } from '../../lib/api'
import { STATUS_COLORS } from './chartConfig'

interface ResumeJobGraphProps {
  applications: Application[]
  resumes: Resume[]
  selectedResumeId: string | null
  resumeTitleMap: Map<string, string>
}

type TooltipData =
  | {
      kind: 'resume'
      title: string
      count: number
      isUnbound?: boolean
    }
  | {
      kind: 'job'
      company: string
      position: string
      channel: string
      status: ApplicationStatus
      appliedAt: string
      resumeName: string
    }
  | {
      kind: 'link'
      resumeName: string
      company: string
      position: string
      status: ApplicationStatus
    }

interface GraphNode {
  id: string
  name: string
  category: number
  symbol: string
  symbolSize: number | [number, number]
  itemStyle: {
    color: string
    borderColor?: string
    borderWidth?: number
    shadowBlur?: number
    shadowColor?: string
  }
  label?: {
    show: boolean
    position?: string
    color?: string
    fontSize?: number
    fontWeight?: number
    width?: number
    distance?: number
    overflow?: string
  }
  tooltipData: TooltipData
}

interface GraphLink {
  source: string
  target: string
  lineStyle: {
    color: string
    opacity: number
    width: number
  }
  tooltipData: TooltipData
}

interface TooltipParam {
  data?: unknown
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

type FocusedCategory = 'resume' | 'job' | null

interface LegendEventParam {
  componentType?: string
  name?: string
}

const UNBOUND_RESUME_ID = 'unbound'
const UNBOUND_NODE_ID = `resume-${UNBOUND_RESUME_ID}`
const GRAPH_SERIES_ID = 'resume-job-graph'

export function ResumeJobGraph({
  applications,
  resumes,
  selectedResumeId,
  resumeTitleMap,
}: ResumeJobGraphProps) {
  const [focusedCategory, setFocusedCategory] = useState<FocusedCategory>(null)
  const [isTooltipSuppressed, setIsTooltipSuppressed] = useState(false)
  const chartRef = useRef<InstanceType<typeof ReactECharts> | null>(null)
  const restoreTooltipTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (restoreTooltipTimerRef.current !== null) {
      window.clearTimeout(restoreTooltipTimerRef.current)
    }
  }, [])

  const graphData = useMemo<GraphData>(() => {
    const resumeNodeMap = new Map<string, string>()

    const getResumeTitle = (resumeId: string) => {
      const knownTitle = resumeTitleMap.get(resumeId)
      if (knownTitle) return knownTitle

      const fallbackApplication = applications.find((app) => app.resume_id === resumeId)
      if (fallbackApplication) {
        return `${fallbackApplication.company} - ${fallbackApplication.position}`
      }

      return '未知简历'
    }

    if (selectedResumeId) {
      resumeNodeMap.set(selectedResumeId, getResumeTitle(selectedResumeId))
    } else {
      resumes.forEach((resume) => {
        resumeNodeMap.set(resume.id, resume.title)
      })

      applications.forEach((app) => {
        if (app.resume_id && !resumeNodeMap.has(app.resume_id)) {
          resumeNodeMap.set(app.resume_id, getResumeTitle(app.resume_id))
        }
      })
    }

    const appsByResume = new Map<string, Application[]>()
    const unboundApplications: Application[] = []

    applications.forEach((app) => {
      if (!app.resume_id) {
        unboundApplications.push(app)
        return
      }

      const list = appsByResume.get(app.resume_id) || []
      list.push(app)
      appsByResume.set(app.resume_id, list)
    })

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    resumeNodeMap.forEach((resumeName, resumeId) => {
      const count = appsByResume.get(resumeId)?.length || 0

      nodes.push({
        id: `resume-${resumeId}`,
        name: resumeName,
        category: 0,
        symbol: 'roundRect',
        symbolSize: [112, 36],
        itemStyle: {
          color: '#eff6ff',
          borderColor: '#93c5fd',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: 'rgba(59,130,246,0.12)',
        },
        label: {
          show: true,
          position: 'inside',
          color: '#1e3a8a',
          fontSize: 11,
          fontWeight: 600,
          width: 92,
          overflow: 'truncate',
        },
        tooltipData: {
          kind: 'resume',
          title: resumeName,
          count,
        },
      })
    })

    if (!selectedResumeId && unboundApplications.length > 0) {
      nodes.push({
        id: UNBOUND_NODE_ID,
        name: '未关联简历',
        category: 0,
        symbol: 'roundRect',
        symbolSize: [112, 36],
        itemStyle: {
          color: '#f8fafc',
          borderColor: '#cbd5e1',
          borderWidth: 1.5,
        },
        label: {
          show: true,
          position: 'inside',
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600,
          width: 92,
          overflow: 'truncate',
        },
        tooltipData: {
          kind: 'resume',
          title: '未关联简历',
          count: unboundApplications.length,
          isUnbound: true,
        },
      })
    }

    applications.forEach((app) => {
      if (!app.resume_id && selectedResumeId) return

      const resumeId = app.resume_id || UNBOUND_RESUME_ID
      const resumeName = app.resume_id ? getResumeTitle(app.resume_id) : '未关联简历'
      const targetNodeId = `job-${app.id}`
      const sourceNodeId = `resume-${resumeId}`
      const statusColor = STATUS_COLORS[app.status]
      const jobName = [app.company, app.position].filter(Boolean).join(' · ') || '未命名岗位'

      nodes.push({
        id: targetNodeId,
        name: jobName,
        category: 1,
        symbol: 'circle',
        symbolSize: 30,
        itemStyle: {
          color: statusColor,
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: `${statusColor}33`,
        },
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          fontSize: 9,
          width: 88,
          distance: 4,
          overflow: 'truncate',
        },
        tooltipData: {
          kind: 'job',
          company: app.company || '-',
          position: app.position || '-',
          channel: APPLICATION_CHANNEL_LABELS[app.channel] || app.channel,
          status: app.status,
          appliedAt: formatDate(app.appliedAt || app.created_at),
          resumeName,
        },
      })

      links.push({
        source: sourceNodeId,
        target: targetNodeId,
        lineStyle: {
          color: statusColor,
          opacity: 0.5,
          width: 1.8,
        },
        tooltipData: {
          kind: 'link',
          resumeName,
          company: app.company || '-',
          position: app.position || '-',
          status: app.status,
        },
      })
    })

    return { nodes, links }
  }, [applications, resumeTitleMap, resumes, selectedResumeId])

  const option = useMemo(() => {
    if (graphData.nodes.length === 0) return null

    const focusedCategoryIndex = focusedCategory === 'resume'
      ? 0
      : focusedCategory === 'job'
        ? 1
        : null
    const focusedData = graphData.nodes.map((node) => {
      const isDimmed = focusedCategoryIndex !== null && node.category !== focusedCategoryIndex

      return {
        ...node,
        itemStyle: {
          ...node.itemStyle,
          opacity: isDimmed ? 0.16 : 1,
        },
        label: node.label
          ? {
              ...node.label,
              show: isDimmed && node.category === 1 ? false : node.label.show,
              color: isDimmed ? '#cbd5e1' : node.label.color,
            }
          : undefined,
      }
    })
    const focusedLinks = graphData.links.map((link) => ({
      ...link,
      lineStyle: {
        ...link.lineStyle,
        opacity: focusedCategoryIndex === null ? link.lineStyle.opacity : 0.16,
      },
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        show: !isTooltipSuppressed,
        trigger: 'item' as const,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: [12, 16],
        textStyle: { color: '#334155', fontSize: 13 },
        formatter: renderTooltip,
      },
      legend: {
        bottom: 0,
        left: 'center',
        icon: 'circle',
        data: ['简历', '岗位'],
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: '#64748b' },
      },
      series: [
        {
          name: '简历岗位关系',
          id: GRAPH_SERIES_ID,
          type: 'graph' as const,
          layout: 'force' as const,
          legendHoverLink: true,
          top: 12,
          left: 20,
          right: 20,
          bottom: 48,
          roam: true,
          draggable: true,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: [0, 7],
          categories: [
            { name: '简历' },
            { name: '岗位' },
          ],
          data: focusedData,
          links: focusedLinks,
          scaleLimit: {
            min: 0.58,
            max: 2.2,
          },
          force: {
            repulsion: 330,
            edgeLength: [72, 118],
            gravity: 0.06,
            friction: 0.76,
          },
          labelLayout: {
            hideOverlap: true,
          },
          lineStyle: {
            color: '#cbd5e1',
            opacity: 0.7,
            width: 1.4,
            curveness: 0.08,
          },
          emphasis: {
            focus: 'adjacency' as const,
            label: { show: true },
            lineStyle: {
              width: 3,
              opacity: 0.95,
            },
          },
        },
      ],
    }
  }, [focusedCategory, graphData, isTooltipSuppressed])

  const graphEvents = useMemo(() => ({
    mouseover: (params: LegendEventParam) => {
      if (params.componentType !== 'legend') return
      const nextFocus = getLegendFocus(params.name)
      if (nextFocus) setFocusedCategory(nextFocus)
    },
    mouseout: (params: LegendEventParam) => {
      if (params.componentType === 'legend') setFocusedCategory(null)
    },
  }), [])

  const handleFitView = () => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return

    chart.resize()
    chart.dispatchAction({ type: 'restore' })
    window.requestAnimationFrame(() => {
      chart.setOption(
        {
          series: [
            {
              id: GRAPH_SERIES_ID,
              center: null,
              zoom: 0.84,
            },
          ],
        },
        { lazyUpdate: false }
      )
    })
  }

  const hideTooltip = () => {
    chartRef.current?.getEchartsInstance()?.dispatchAction({ type: 'hideTip' })
  }

  const suppressTooltip = () => {
    if (restoreTooltipTimerRef.current !== null) {
      window.clearTimeout(restoreTooltipTimerRef.current)
      restoreTooltipTimerRef.current = null
    }
    setIsTooltipSuppressed(true)
    hideTooltip()
  }

  const restoreTooltipSoon = () => {
    hideTooltip()
    if (restoreTooltipTimerRef.current !== null) {
      window.clearTimeout(restoreTooltipTimerRef.current)
    }
    restoreTooltipTimerRef.current = window.setTimeout(() => {
      setIsTooltipSuppressed(false)
      restoreTooltipTimerRef.current = null
    }, 120)
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <Network className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">暂无关系数据</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative h-80"
      onMouseDownCapture={suppressTooltip}
      onMouseMoveCapture={() => {
        if (isTooltipSuppressed) hideTooltip()
      }}
      onMouseUpCapture={restoreTooltipSoon}
      onMouseLeave={restoreTooltipSoon}
    >
      <ReactECharts
        ref={chartRef}
        key={`resume-job-graph-${graphData.nodes.length}-${graphData.links.length}-${selectedResumeId || 'all'}`}
        option={option}
        style={{ height: '100%', width: '100%' }}
        lazyUpdate={true}
        onEvents={graphEvents}
      />
      <button
        type="button"
        title="适应视图"
        onClick={handleFitView}
        className="absolute right-3 bottom-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function renderTooltip(params: TooltipParam) {
  if (!hasTooltipData(params.data)) return ''

  const data = params.data.tooltipData

  if (data.kind === 'resume') {
    const hint = data.isUnbound ? '未绑定到任何简历的岗位' : '关联岗位'
    return `
      <div style="min-width:160px">
        <div style="font-weight:600;margin-bottom:8px;color:#0f172a">${escapeHtml(data.title)}</div>
        <div style="font-size:12px;color:#64748b">${hint}: <strong>${data.count}</strong></div>
      </div>
    `
  }

  if (data.kind === 'link') {
    const statusColor = STATUS_COLORS[data.status]
    return `
      <div style="min-width:180px">
        <div style="font-weight:600;margin-bottom:8px;color:#0f172a">${escapeHtml(data.resumeName)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">${escapeHtml(data.company)} - ${escapeHtml(data.position)}</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#334155">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>
          ${escapeHtml(APPLICATION_STATUS_LABELS[data.status])}
        </div>
      </div>
    `
  }

  const statusColor = STATUS_COLORS[data.status]
  return `
    <div style="min-width:190px">
      <div style="font-weight:600;margin-bottom:4px;color:#0f172a">${escapeHtml(data.company)}</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:10px">${escapeHtml(data.position)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:#334155">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>
        ${escapeHtml(APPLICATION_STATUS_LABELS[data.status])}
      </div>
      <div style="border-top:1px solid #f1f5f9;padding-top:8px;font-size:12px;color:#64748b;line-height:1.7">
        <div>渠道: ${escapeHtml(data.channel)}</div>
        <div>投递时间: ${escapeHtml(data.appliedAt)}</div>
        <div>关联简历: ${escapeHtml(data.resumeName)}</div>
      </div>
    </div>
  `
}

function hasTooltipData(data: unknown): data is { tooltipData: TooltipData } {
  return typeof data === 'object' && data !== null && 'tooltipData' in data
}

function getLegendFocus(name: string | undefined): FocusedCategory {
  if (name === '简历') return 'resume'
  if (name === '岗位') return 'job'
  return null
}

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

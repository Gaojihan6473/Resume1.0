import * as echarts from 'echarts/core'
import { BarChart, GraphChart, LineChart, PieChart, SunburstChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import type { ComponentProps, Ref } from 'react'

echarts.use([
  BarChart, GraphChart, LineChart, PieChart, SunburstChart,
  DataZoomComponent, GraphicComponent, GridComponent, LegendComponent, TitleComponent, ToolboxComponent, TooltipComponent,
  LabelLayout, CanvasRenderer,
])

export type ChartInstance = ReactEChartsCore

export function ReactChart({ ref, ...props }: Omit<ComponentProps<typeof ReactEChartsCore>, 'echarts'> & { ref?: Ref<ChartInstance> }) {
  return <ReactEChartsCore {...props} ref={ref} echarts={echarts} />
}

export const chartFormat = echarts.format

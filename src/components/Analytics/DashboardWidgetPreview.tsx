import { Award, Bookmark, Building2, Clock, FileQuestion, Target, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MetricWidgetType, WidgetType } from '../../types/dashboard'
import { STATUS_COLORS } from './chartConfig'

const metrics: Record<MetricWidgetType, { Icon: LucideIcon; value: string; note: string }> = {
  total: { Icon: TrendingUp, value: '48', note: '12% 结果通过率' },
  interviewing: { Icon: Target, value: '6', note: '2 Offer' },
  assessing: { Icon: Clock, value: '8', note: '3 已拒绝' },
  topChannel: { Icon: Award, value: '官网投递', note: '26 次' },
  interested: { Icon: Bookmark, value: '12', note: '8 家公司待投递' },
  companies: { Icon: Building2, value: '32', note: '48 次投递' },
  unbound: { Icon: FileQuestion, value: '5', note: '10% 已投占比' },
}
const colors = [STATUS_COLORS.applied, STATUS_COLORS.interviewing, STATUS_COLORS.offered, STATUS_COLORS.rejected]

// Lightweight illustrative thumbnails stay recognizable even on an empty board.
export function DashboardWidgetPreview({ type }: { type: WidgetType }) {
  if (type in metrics) {
    const { Icon, value, note } = metrics[type as keyof typeof metrics]
    return <span className="library-preview library-preview-stat" aria-hidden="true">
      <span className="library-preview-icon"><Icon size={23} /></span>
      <span><b className={type === 'topChannel' ? 'library-preview-text' : ''}>{value}</b><small>{note}</small></span>
    </span>
  }
  return <span className="library-preview" aria-hidden="true">
    <svg viewBox="0 0 260 116" fill="none" focusable="false">
      {type === 'channelStatus' ? <>
        {[24, 52, 80].map(y => <path key={y} d={`M24 ${y} H246`} stroke="#e4ebf6" strokeDasharray="3 4" />)}
        <path d="M24 12 V94 H246" stroke="#cddbef" />
        {[0, 1, 2].map(group => <g key={group}>{[48, 28, 64, 18].map((height, i) => <rect key={i} x={38 + group * 74 + i * 12} y={94 - (height - group * 7)} width="8" height={height - group * 7} rx="3" fill={colors[i]} />)}<text x={58 + group * 74} y="110" textAnchor="middle">{['官网', 'Boss', '内推'][group]}</text></g>)}
      </> : type === 'location' ? <>
        {[[21, 15], [35, 11], [49, 11]].map(([r, width], level) => <g key={r}>
          {[0, 1, 2, 3].map(i => <circle key={i} cx="93" cy="56" r={r} pathLength="100" stroke={level === 0 ? ['#dce9ff', '#cbdcf8', '#b8d0f4', '#a8c4ed'][i] : colors[i]} strokeWidth={width} strokeDasharray="23.5 76.5" strokeDashoffset={-i * 25} transform="rotate(-90 93 56)" />)}
        </g>)}
        <text x="93" y="60" textAnchor="middle" className="library-ring-number">48</text>
        {['地区', '渠道', '状态'].map((label, i) => <g key={label}><circle cx="169" cy={28 + i * 27} r="5" stroke={['#b8d0f4', '#4f80ed', '#9775dc'][i]} strokeWidth="3" /><text x="183" y={31 + i * 27}>{label}</text></g>)}
      </> : type === 'companyRanking' ? <>
        {[64, 112, 160, 208].map(x => <path key={x} d={`M${x} 10 V91`} stroke="#e4ebf6" strokeDasharray="3 4" />)}
        {[0, 1, 2].map(i => <g key={i}>
          <text x="4" y={25 + i * 28}>{['星河科技', '远山科技', '启明科技'][i]}</text>
          {[0, 1, 2, 3, 4].map(j => <rect key={j} x={64 + j * (30 - i * 6)} y={13 + i * 28} width={29 - i * 6} height="17" rx="2" fill={[STATUS_COLORS.applied, STATUS_COLORS.assessing, STATUS_COLORS.interviewing, STATUS_COLORS.offered, STATUS_COLORS.rejected][j]} />)}
          <text x={221 - i * 30} y={25 + i * 28}>{[26, 14, 8][i]}</text>
        </g>)}
        {['已投递', '测评中', '面试中', 'Offer', '已拒绝'].map((label, i) => <g key={label}><circle cx={7 + i * 51} cy="107" r="3" fill={[STATUS_COLORS.applied, STATUS_COLORS.assessing, STATUS_COLORS.interviewing, STATUS_COLORS.offered, STATUS_COLORS.rejected][i]} /><text x={14 + i * 51} y="110">{label}</text></g>)}
      </> : type === 'graph' ? <>
        {[[36, 24, 92, 51], [30, 82, 92, 51], [118, 15, 92, 51], [144, 93, 92, 51], [165, 28, 209, 65], [239, 22, 209, 65], [235, 100, 209, 65]].map(([x, y, cx, cy], i) => <path key={i} d={`M${cx} ${cy} L${x} ${y}`} stroke="#b5c9e8" strokeWidth="1.5" />)}
        {[[36, 24], [30, 82], [118, 15], [144, 93], [165, 28], [239, 22], [235, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={colors[i % colors.length]} opacity=".85" />)}
        {[[59, 40, '产品简历'], [176, 54, '运营简历']].map(([x, y, label]) => <g key={label}><rect x={x} y={y} width="66" height="23" rx="8" fill="#edf3ff" stroke="#8eafe0" /><text x={Number(x) + 33} y={Number(y) + 15} textAnchor="middle">{label}</text></g>)}
      </> : type === 'status' ? <>
        <circle cx="87" cy="54" r="33" stroke="#edf2fa" strokeWidth="15" />
        {[[0, 50], [50, 25], [75, 16.7], [91.7, 8.3]].map(([start, length], i) => <circle key={start} cx="87" cy="54" r="33" pathLength="100" stroke={colors[i]} strokeWidth="15" strokeDasharray={`${length - 1.5} ${100 - length + 1.5}`} strokeDashoffset={-start} transform="rotate(-90 87 54)" />)}
        <text x="87" y="54" textAnchor="middle" className="library-ring-number">48</text><text x="87" y="69" textAnchor="middle">岗位总数</text>
        {['已投递', '面试中', 'Offer', '已拒绝'].map((label, i) => <g key={label}><circle cx="143" cy={26 + i * 22} r="3" fill={colors[i]} /><text x="152" y={30 + i * 22}>{label}</text><text x="213" y={30 + i * 22} textAnchor="end">{[24, 12, 8, 4][i]}</text><text x="255" y={30 + i * 22} textAnchor="end">{['50%', '25%', '16.7%', '8.3%'][i]}</text></g>)}
      </> : <>
        {[24, 52, 80].map(y => <path key={y} d={`M24 ${y} H246`} stroke="#e4ebf6" strokeDasharray="3 4" />)}
        <path d="M24 12 V94 H246" stroke="#cddbef" />
        {type === 'trend' ? <>
          <path d="M30 81 L64 65 L98 73 L132 42 L166 51 L200 22 L238 32 V94 H30Z" fill="#4f80ed" opacity=".08" />
          <path d="M30 81 L64 65 L98 73 L132 42 L166 51 L200 22 L238 32" stroke="#4f80ed" strokeWidth="2.5" strokeLinejoin="round" />
          {[[30, 81], [64, 65], [98, 73], [132, 42], [166, 51], [200, 22], [238, 32]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill="white" stroke="#4f80ed" strokeWidth="2" />)}
          {['第1周', '第3周', '第5周', '第7周'].map((label, i) => <text key={label} x={30 + i * 68} y="110" textAnchor="middle">{label}</text>)}
        </> : type === 'distribution' ? <>
          {[0, 1, 2].map(group => <g key={group}>{[32, 60, 45].map((height, i) => <rect key={i} x={42 + group * 72 + i * 13} y={94 - (height + group * 11) % 78} width="8" height={(height + group * 11) % 78} rx="3" fill={colors[i]} />)}<text x={59 + group * 72} y="110" textAnchor="middle">{['产品简历', '运营简历', '技术简历'][group]}</text></g>)}
        </> : <>
          {[67, 44, 29, 18].map((height, i) => <g key={i}><rect x={43 + i * 53} y={94 - height} width="22" height={height} rx="4" fill="#4f80ed" opacity={1 - i * .15} /><text x={54 + i * 53} y="110" textAnchor="middle">{['官网', 'Boss', '内推', '其他'][i]}</text></g>)}
        </>}
      </>}
    </svg>
  </span>
}

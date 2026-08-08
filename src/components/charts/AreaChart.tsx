import { memo } from 'react'
import { useCallback } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import {
  ChartTooltipOverlay,
  formatTipTime,
  useChartTooltip,
  type TooltipPoint,
} from './ChartTooltip'

interface Props {
  data: Array<number | null>
  /** Initial / fallback width — actual width adapts to parent via ResizeObserver. */
  width?: number
  height?: number
  color?: string
  yMin?: number
  yMax?: number
  /** Threshold line (e.g. 80% danger). Drawn as dashed warn-color line. */
  threshold?: number
  gridY?: number
  gridX?: number
  /** Optional unique gradient id seed (avoid duplicate ids on the page). */
  gradientId?: string
  /** Format the y-axis label given the value */
  formatY?: (v: number) => string
  /** Optional per-point unix-ms timestamps; enables hover tooltip with time. */
  times?: number[]
  /** Optional formatter for the tooltip value (gets units etc). Defaults to v.toFixed(1). */
  formatValue?: (v: number) => string
}

function isFinitePoint(value: number | null): value is number {
  return value != null && Number.isFinite(value)
}

/**
 * AreaChart — full chart with grid, y-axis labels on the right,
 * area fill gradient, current-value dot, optional threshold dashed line,
 * and a hover tooltip showing value (+ time when `times` is provided).
 */
function AreaChart_({
  data,
  width: initialWidth = 400,
  height = 140,
  color = 'var(--accent)',
  yMin = 0,
  yMax = 100,
  threshold,
  gridY = 4,
  gridX = 6,
  gradientId,
  formatY,
  times,
  formatValue,
}: Props) {
  const [wrapRef, w] = useElementWidth<HTMLDivElement>(initialWidth)

  const pad = { top: 12, right: 36, bottom: 18, left: 8 }
  const innerW = Math.max(0, w - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const range = yMax - yMin || 1
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0

  const id = gradientId ?? `grad-${Math.random().toString(36).slice(2, 8)}`

  const resolve = useCallback(
    (svgX: number): TooltipPoint | null => {
      if (data.length === 0 || stepX === 0) return null
      const localX = svgX - pad.left
      const idx = Math.max(0, Math.min(data.length - 1, Math.round(localX / stepX)))
      const v = data[idx]
      if (!isFinitePoint(v)) return null
      const cx = pad.left + idx * stepX
      const cy =
        pad.top + innerH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / range) * innerH
      const t = times?.[idx]
      return {
        cx,
        cy,
        color,
        valueText: formatValue ? formatValue(v) : v.toFixed(1),
        subText: t ? formatTipTime(t) : undefined,
      }
    },
    [data, stepX, pad.left, pad.top, innerH, yMin, yMax, range, times, color, formatValue],
  )

  const tooltip = useChartTooltip({
    width: w,
    height,
    innerLeft: pad.left,
    innerRight: pad.left + innerW,
    innerTop: pad.top,
    innerBottom: pad.top + innerH,
    resolve,
  })

  if (!data.some(isFinitePoint)) {
    return (
      <div
        ref={wrapRef}
        style={{
          width: '100%',
          height,
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 2,
        }}
      />
    )
  }

  const pts = data.map((value, index) =>
    !isFinitePoint(value)
      ? null
      : ([
          pad.left + index * stepX,
          pad.top + innerH -
            ((Math.max(yMin, Math.min(yMax, value)) - yMin) / range) * innerH,
        ] as [number, number]),
  )
  let drawing = false
  let path = ''
  for (const point of pts) {
    if (!point) {
      drawing = false
      continue
    }
    path += `${drawing ? 'L' : 'M'}${point[0]},${point[1]} `
    drawing = true
  }
  const allPointsPresent = pts.every((point) => point != null)
  const fillPath = allPointsPresent
    ? `${path} L${pad.left + innerW},${pad.top + innerH} L${pad.left},${pad.top + innerH} Z`
    : ''
  const isolatedPoints = pts.filter(
    (point, index): point is [number, number] =>
      point != null && pts[index - 1] == null && pts[index + 1] == null,
  )
  let lastPoint: [number, number] | null = null
  for (let index = pts.length - 1; index >= 0; index--) {
    const point = pts[index]
    if (point) {
      lastPoint = point
      break
    }
  }

  const formatLabel = formatY ?? ((v: number) => v.toFixed(0))

  // Combine refs: useElementWidth and useChartTooltip both want the wrapper.
  const setRefs = (el: HTMLDivElement | null) => {
    ;(wrapRef as { current: HTMLDivElement | null }).current = el
    ;(tooltip.wrapRef as { current: HTMLDivElement | null }).current = el
  }

  return (
    <div
      ref={setRefs}
      onMouseMove={tooltip.bind.onMouseMove}
      onMouseLeave={tooltip.bind.onMouseLeave}
      style={{ width: '100%', height, position: 'relative', cursor: 'crosshair' }}
    >
      <svg width={w} height={height} style={{ display: 'block' }}>
        {/* horizontal grid */}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const y = pad.top + (i / gridY) * innerH
          const isEdge = i === 0 || i === gridY
          return (
            <line
              key={`gy${i}`}
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y}
              y2={y}
              stroke="var(--grid-line-strong)"
              strokeWidth={1}
              strokeDasharray={isEdge ? '0' : '2 3'}
              opacity={isEdge ? 1 : 0.6}
            />
          )
        })}
        {/* vertical grid */}
        {Array.from({ length: gridX + 1 }, (_, i) => {
          const x = pad.left + (i / gridX) * innerW
          return (
            <line
              key={`gx${i}`}
              x1={x}
              x2={x}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--grid-line)"
              strokeWidth={1}
            />
          )
        })}
        {/* threshold */}
        {threshold != null && threshold >= yMin && threshold <= yMax && (
          <line
            x1={pad.left}
            x2={pad.left + innerW}
            y1={pad.top + innerH - ((threshold - yMin) / range) * innerH}
            y2={pad.top + innerH - ((threshold - yMin) / range) * innerH}
            stroke="var(--signal-warn)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
        )}
        {/* fill */}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fillPath && <path d={fillPath} fill={`url(#${id})`} />}
        {/* line */}
        <path
          d={path}
          stroke={color}
          strokeWidth={1.4}
          fill="none"
          strokeLinejoin="round"
        />
        {/* A move-only SVG subpath is invisible. Long downsampled windows can
            leave valid samples isolated between empty buckets, so render only
            those points explicitly without connecting across real gaps. */}
        {isolatedPoints.map((point, index) => (
          <circle
            key={`isolated-${index}`}
            cx={point[0]}
            cy={point[1]}
            r={1.8}
            fill={color}
            opacity={0.9}
          />
        ))}
        {/* current dot */}
        {lastPoint && (
          <>
            <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill={color} />
            <circle
              cx={lastPoint[0]}
              cy={lastPoint[1]}
              r="5"
              fill={color}
              opacity="0.2"
            />
          </>
        )}
        {/* y-axis labels (right side) */}
        {Array.from({ length: gridY + 1 }, (_, i) => {
          const v = yMax - (i / gridY) * range
          const y = pad.top + (i / gridY) * innerH
          return (
            <text
              key={`yt${i}`}
              x={pad.left + innerW + 5}
              y={y + 3}
              fontSize="9"
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.1em"
            >
              {formatLabel(v)}
            </text>
          )
        })}
      </svg>
      <ChartTooltipOverlay hover={tooltip.hover} width={w} height={height} />
    </div>
  )
}

export const AreaChart = memo(AreaChart_)

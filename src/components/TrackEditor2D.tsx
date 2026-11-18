import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import { createControlPoint } from '../domain/track/schema'
import type { EditorAction } from '../domain/track/editorReducer'
import { sampleClosedCatmullRom } from '../domain/track/spline'
import { DEFAULT_GRID_SIZE, snapToGrid } from '../domain/track/grid'

/**
 * CAD-style explicit tools, each with one unambiguous job:
 * - 'select': click/drag existing points only. Clicking empty canvas deselects; it never adds a point.
 * - 'add-point': click empty canvas inserts a new point at the nearest position along the loop. Clicking an existing point does nothing (this tool only adds).
 * - 'start-line' / 'checkpoint': click an existing point to set/toggle it; unchanged.
 * - 'pan': drag empty canvas to pan; unchanged.
 */
export type PointClickMode = 'select' | 'add-point' | 'start-line' | 'checkpoint' | 'pan'

interface TrackEditor2DProps {
  doc: TrackDocument
  dispatch: (action: EditorAction, opts?: { transient?: boolean }) => void
  /** Called when a drag ends, to close the undo step for the whole drag (see domain/track/history). */
  onCommit?: () => void
  width?: number
  height?: number
  /** Controls what clicking an existing control point (or empty canvas, for 'pan') does. Defaults to selecting it (and allowing drag). */
  pointClickMode?: PointClickMode
  selectedIndex?: number | null
  /** Called with an existing point's index when selected in 'select' mode, or `null` when empty canvas is clicked to deselect. */
  onSelectPoint?: (index: number | null) => void
  snapToGridEnabled?: boolean
  gridSize?: number
  /**
   * Changes only when a track is loaded wholesale (not on in-place edits like add/move/delete),
   * e.g. `${doc.id}:${doc.createdAt}`. Triggers the view to re-fit to the loaded track's bounds.
   */
  loadKey?: string
}

const SAMPLES_PER_SEGMENT = 12
const POINT_RADIUS = 7
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const FIT_PADDING = 40

interface ViewTransform {
  zoom: number
  panX: number
  panY: number
}

const DEFAULT_VIEW: ViewTransform = { zoom: 1, panX: 0, panY: 0 }

/**
 * The index to insert a new point at so it slots into the loop where it was actually
 * clicked, instead of always tacking onto the end of the array - which, for a point clicked
 * near the middle of an existing loop, would otherwise connect it with a long stray segment
 * across the track. Finds the existing loop segment (including the wrap-around one from the
 * last point back to the first) whose nearest point is closest to `point`, and returns the
 * index right after that segment's start.
 */
function nearestInsertionIndex(point: { x: number; z: number }, controlPoints: { x: number; z: number }[]): number {
  const n = controlPoints.length
  // Fewer than 3 points isn't a real loop yet (a 2-point "loop" has one physical edge
  // traversed both ways, which is a degenerate case for "nearest segment") - just keep
  // appending while bootstrapping the first shape.
  if (n < 3) return n

  let bestDistSq = Infinity
  let bestIndex = n
  for (let i = 0; i < n; i++) {
    const a = controlPoints[i]
    const b = controlPoints[(i + 1) % n]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const lenSq = abx * abx + abz * abz
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.z - a.z) * abz) / lenSq))
    const dx = point.x - (a.x + abx * t)
    const dz = point.z - (a.z + abz * t)
    const distSq = dx * dx + dz * dz
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestIndex = i + 1
    }
  }
  return bestIndex
}

/** Computes a zoom/pan that fits all control points within `width`x`height`, centered, with padding. */
function computeFitView(
  points: { x: number; z: number }[],
  width: number,
  height: number,
): ViewTransform {
  if (points.length === 0) return DEFAULT_VIEW

  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const minZ = Math.min(...points.map((p) => p.z))
  const maxZ = Math.max(...points.map((p) => p.z))
  const boxWidth = maxX - minX
  const boxHeight = maxZ - minZ

  if (boxWidth <= 0 || boxHeight <= 0) return DEFAULT_VIEW

  const availableWidth = Math.max(width - 2 * FIT_PADDING, 1)
  const availableHeight = Math.max(height - 2 * FIT_PADDING, 1)
  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Math.min(availableWidth / boxWidth, availableHeight / boxHeight)),
  )

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const panX = width / 2 - centerX * zoom
  const panY = height / 2 - centerZ * zoom

  return { zoom, panX, panY }
}

export function TrackEditor2D({
  doc,
  dispatch,
  onCommit,
  width = 640,
  height = 480,
  pointClickMode = 'select',
  selectedIndex = null,
  onSelectPoint,
  snapToGridEnabled = false,
  gridSize = DEFAULT_GRID_SIZE,
  loadKey,
}: TrackEditor2DProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW)
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    setView(computeFitView(doc.controlPoints, width, height))
    // Re-fit only when a track is loaded wholesale, not on every doc edit (see loadKey prop doc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey])

  const toLocalPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, z: 0 }
      const rect = svg.getBoundingClientRect()
      const raw = {
        x: (clientX - rect.left - view.panX) / view.zoom,
        z: (clientY - rect.top - view.panY) / view.zoom,
      }
      return snapToGridEnabled ? snapToGrid(raw, gridSize) : raw
    },
    [snapToGridEnabled, gridSize, view],
  )

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
    setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }))
  }

  const handleCanvasMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (pointClickMode !== 'pan') return
    if (event.target !== svgRef.current) return
    panStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      panX: view.panX,
      panY: view.panY,
    }
  }

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (pointClickMode === 'pan') return // panning is a drag, not a click
    if (draggingIndex !== null) return
    if (event.target !== svgRef.current) return // clicks on points are handled separately

    if (pointClickMode === 'add-point') {
      const { x, z } = toLocalPoint(event.clientX, event.clientY)
      const insertIndex = nearestInsertionIndex({ x, z }, doc.controlPoints)
      dispatch({ type: 'ADD_POINT', point: createControlPoint({ x, z }), insertIndex })
      return
    }

    if (pointClickMode === 'select') {
      onSelectPoint?.(null) // empty-canvas click deselects; it never adds a point
    }
  }

  const handlePointMouseDown = (index: number) => (event: React.MouseEvent) => {
    event.stopPropagation()

    if (pointClickMode === 'add-point') return // this tool only adds; existing points are inert to it

    if (pointClickMode === 'start-line') {
      dispatch({ type: 'SET_START_LINE', controlPointIndex: index })
      return
    }

    if (pointClickMode === 'checkpoint') {
      const isCheckpoint = doc.checkpoints.some((c) => c.controlPointIndex === index)
      if (isCheckpoint) {
        dispatch({ type: 'REMOVE_CHECKPOINT', controlPointIndex: index })
      } else {
        dispatch({ type: 'ADD_CHECKPOINT', controlPointIndex: index })
      }
      return
    }

    if (pointClickMode === 'pan') return

    onSelectPoint?.(index)
    setDraggingIndex(index)
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (panStartRef.current) {
      const start = panStartRef.current
      setView((v) => ({
        ...v,
        panX: start.panX + (event.clientX - start.clientX),
        panY: start.panY + (event.clientY - start.clientY),
      }))
      return
    }
    if (draggingIndex === null) return
    const { x, z } = toLocalPoint(event.clientX, event.clientY)
    dispatch({ type: 'MOVE_POINT', index: draggingIndex, x, z }, { transient: true })
  }

  const handleMouseUp = () => {
    if (draggingIndex !== null) onCommit?.()
    setDraggingIndex(null)
    panStartRef.current = null
  }

  const curvePoints =
    doc.controlPoints.length >= 3
      ? sampleClosedCatmullRom(
          doc.controlPoints.map((p) => ({ x: p.x, y: 0, z: p.z })),
          SAMPLES_PER_SEGMENT,
        )
      : []

  const pathData =
    curvePoints.length > 0
      ? `M ${curvePoints.map((p) => `${p.x},${p.z}`).join(' L ')} Z`
      : ''

  return (
    <svg
      ref={svgRef}
      data-testid="track-editor-canvas"
      width={width}
      height={height}
      style={{
        background: '#101418',
        touchAction: 'none',
        cursor: pointClickMode === 'pan' ? 'grab' : pointClickMode === 'add-point' ? 'copy' : 'default',
      }}
      onClick={handleCanvasClick}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <g
        data-testid="view-transform-group"
        transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}
      >
        {snapToGridEnabled && (
          <g data-testid="grid-overlay" stroke="#1f2730" strokeWidth={1 / view.zoom}>
            {Array.from({ length: Math.ceil(width / gridSize) + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={height} />
            ))}
            {Array.from({ length: Math.ceil(height / gridSize) + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * gridSize} x2={width} y2={i * gridSize} />
            ))}
          </g>
        )}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="#4ea8de"
            strokeWidth={3 / view.zoom}
            data-testid="track-curve"
          />
        )}
        {doc.controlPoints.map((point, index) => {
          const isStart = index === doc.startLine.controlPointIndex
          const isCheckpoint = doc.checkpoints.some((c) => c.controlPointIndex === index)
          const isSelected = index === selectedIndex
          return (
            <circle
              key={index}
              data-testid={`control-point-${index}`}
              cx={point.x}
              cy={point.z}
              r={(isSelected ? POINT_RADIUS + 3 : POINT_RADIUS) / view.zoom}
              fill={isStart ? '#ffd166' : isCheckpoint ? '#06d6a0' : '#ef476f'}
              stroke={isSelected ? '#4ea8de' : '#fff'}
              strokeWidth={(isSelected ? 3 : 1.5) / view.zoom}
              onMouseDown={handlePointMouseDown(index)}
            />
          )
        })}
      </g>
    </svg>
  )
}

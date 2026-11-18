import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import { createControlPoint, UNSET_START_LINE } from '../domain/track/schema'
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

  // Decorative direction-of-travel chevrons: a handful of evenly-spaced samples along the
  // curve, each oriented along the local tangent so they visibly point the way around the loop.
  const CHEVRON_COUNT = 8
  const chevrons =
    curvePoints.length >= CHEVRON_COUNT
      ? Array.from({ length: CHEVRON_COUNT }, (_, i) => {
          // Offset by half a step so chevrons land between control points rather than
          // exactly on them, where the (larger, later-painted) point markers would hide them.
          const index = Math.floor(((i + 0.5) / CHEVRON_COUNT) * curvePoints.length) % curvePoints.length
          const prev = curvePoints[(index - 1 + curvePoints.length) % curvePoints.length]
          const next = curvePoints[(index + 1) % curvePoints.length]
          const point = curvePoints[index]
          const angleDeg = (Math.atan2(next.z - prev.z, next.x - prev.x) * 180) / Math.PI
          return { x: point.x, z: point.z, angleDeg }
        })
      : []

  const trackLength = curvePoints.reduce((total, point, i) => {
    const prev = curvePoints[(i - 1 + curvePoints.length) % curvePoints.length]
    return total + Math.hypot(point.x - prev.x, point.z - prev.z)
  }, 0)

  const startPoint =
    doc.startLine.controlPointIndex !== UNSET_START_LINE
      ? doc.controlPoints[doc.startLine.controlPointIndex]
      : null
  const startHeadingRad = (doc.startLine.headingDeg * Math.PI) / 180
  // Perpendicular to the heading (the car's "right" vector, see carPhysics.ts), so the
  // gantry line crosses the track rather than running along it.
  const startRightX = Math.cos(startHeadingRad)
  const startRightZ = -Math.sin(startHeadingRad)
  const startHalfWidth = (startPoint?.width ?? 10) / 2 + 4

  const radarMaxRadius = Math.min(width, height) / 2

  // The grid overlay must cover whatever region of world-space is actually visible through
  // the current pan/zoom, not a fixed patch anchored at world (0,0) sized to the canvas's own
  // pixel dimensions - otherwise it renders as a small patch off to one side instead of
  // centered under the track (e.g. for any preset not centered near the origin, or after
  // panning). Snap lines to multiples of gridSize so they land on the same intersections
  // snapToGrid() itself snaps points to, with a one-cell margin so lines reach the edges.
  const visibleMinX = -view.panX / view.zoom
  const visibleMaxX = (width - view.panX) / view.zoom
  const visibleMinZ = -view.panY / view.zoom
  const visibleMaxZ = (height - view.panY) / view.zoom
  const gridMinX = Math.floor(visibleMinX / gridSize) * gridSize - gridSize
  const gridMaxX = Math.ceil(visibleMaxX / gridSize) * gridSize + gridSize
  const gridMinZ = Math.floor(visibleMinZ / gridSize) * gridSize - gridSize
  const gridMaxZ = Math.ceil(visibleMaxZ / gridSize) * gridSize + gridSize
  const gridColCount = Math.round((gridMaxX - gridMinX) / gridSize)
  const gridRowCount = Math.round((gridMaxZ - gridMinZ) / gridSize)

  return (
    <div className="canvas-frame">
    <svg
      ref={svgRef}
      data-testid="track-editor-canvas"
      width={width}
      height={height}
      style={{
        background: '#060607',
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
      <g stroke="#1c1c1f" fill="none">
        <circle cx={width / 2} cy={height / 2} r={radarMaxRadius * 0.25} opacity={0.5} />
        <circle cx={width / 2} cy={height / 2} r={radarMaxRadius * 0.5} opacity={0.5} />
        <circle cx={width / 2} cy={height / 2} r={radarMaxRadius * 0.75} opacity={0.5} />
        <circle cx={width / 2} cy={height / 2} r={radarMaxRadius} opacity={0.5} />
        <line x1={width / 2} y1={0} x2={width / 2} y2={height} opacity={0.35} />
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} opacity={0.35} />
      </g>
      <g
        data-testid="view-transform-group"
        transform={`translate(${view.panX},${view.panY}) scale(${view.zoom})`}
      >
        {snapToGridEnabled && (
          <g data-testid="grid-overlay" stroke="#1c1c1f" strokeWidth={1 / view.zoom}>
            {Array.from({ length: gridColCount + 1 }, (_, i) => {
              const x = gridMinX + i * gridSize
              return <line key={`v${i}`} x1={x} y1={gridMinZ} x2={x} y2={gridMaxZ} />
            })}
            {Array.from({ length: gridRowCount + 1 }, (_, i) => {
              const z = gridMinZ + i * gridSize
              return <line key={`h${i}`} x1={gridMinX} y1={z} x2={gridMaxX} y2={z} />
            })}
          </g>
        )}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="#e8e8ea"
            strokeWidth={3 / view.zoom}
            data-testid="track-curve"
          />
        )}
        {chevrons.length > 0 && (
          <g stroke="#8c8c92" strokeWidth={2 / view.zoom} fill="none" strokeLinecap="round" opacity={0.6}>
            {chevrons.map((chevron, i) => (
              <path
                key={i}
                d={`M ${-5 / view.zoom},${-4 / view.zoom} L ${5 / view.zoom},0 L ${-5 / view.zoom},${4 / view.zoom}`}
                transform={`translate(${chevron.x},${chevron.z}) rotate(${chevron.angleDeg})`}
              />
            ))}
          </g>
        )}
        {startPoint && (
          <line
            data-testid="start-line-gantry"
            x1={startPoint.x - startRightX * startHalfWidth}
            y1={startPoint.z - startRightZ * startHalfWidth}
            x2={startPoint.x + startRightX * startHalfWidth}
            y2={startPoint.z + startRightZ * startHalfWidth}
            stroke="#f5a623"
            strokeWidth={3 / view.zoom}
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
              fill={isStart ? '#f5a623' : isCheckpoint ? '#27c972' : '#1c1c1f'}
              stroke={isSelected ? '#f5a623' : '#e8e8ea'}
              strokeWidth={(isSelected ? 3 : 1.5) / view.zoom}
              onMouseDown={handlePointMouseDown(index)}
            />
          )
        })}
      </g>
    </svg>
    <div className="canvas-readouts">
      <span className="readout-chip">{doc.controlPoints.length} points</span>
      {trackLength > 0 && <span className="readout-chip">{trackLength.toFixed(0)} m</span>}
    </div>
    </div>
  )
}

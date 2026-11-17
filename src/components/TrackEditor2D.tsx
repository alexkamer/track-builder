import { useCallback, useEffect, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import { createControlPoint } from '../domain/track/schema'
import type { EditorAction } from '../domain/track/editorReducer'
import { sampleClosedCatmullRom } from '../domain/track/spline'
import { DEFAULT_GRID_SIZE, snapToGrid } from '../domain/track/grid'

export type PointClickMode = 'select' | 'start-line' | 'checkpoint' | 'pan'

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
  onSelectPoint?: (index: number) => void
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
    if (pointClickMode === 'pan') return // panning is a drag, not a click-to-add
    if (draggingIndex !== null) return
    if (event.target !== svgRef.current) return // clicks on points are handled separately
    const { x, z } = toLocalPoint(event.clientX, event.clientY)
    dispatch({ type: 'ADD_POINT', point: createControlPoint({ x, z }) })
  }

  const handlePointMouseDown = (index: number) => (event: React.MouseEvent) => {
    event.stopPropagation()

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
      style={{ background: '#101418', touchAction: 'none', cursor: pointClickMode === 'pan' ? 'grab' : 'default' }}
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

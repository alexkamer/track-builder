import type { ReactNode } from 'react'

interface EditorWorkAreaProps {
  /** Instructional text for the currently active tool, rendered near the canvas rather than inside a tool button's label. */
  hint: string
  canvas: ReactNode
  sideRail: ReactNode
}

/** Lays out the editor's primary work surface: the 2D canvas (plus its tool hint) on the left, a fixed-width side rail (3D preview, inspector) on the right. */
export function EditorWorkArea({ hint, canvas, sideRail }: EditorWorkAreaProps) {
  return (
    <div className="editor-work-area">
      <div className="work-area-main">
        <p className="canvas-hint" data-testid="tool-hint">
          {hint}
        </p>
        {canvas}
      </div>
      <aside className="side-rail">{sideRail}</aside>
    </div>
  )
}

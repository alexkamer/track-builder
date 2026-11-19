import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorWorkArea } from './EditorWorkArea'

describe('EditorWorkArea tool hint', () => {
  it('renders the hint in its own region, separate from the canvas and side rail', () => {
    render(
      <EditorWorkArea
        hint="Click empty canvas to add a point there."
        canvas={<div data-testid="canvas-slot" />}
        sideRail={<div data-testid="side-rail-slot" />}
      />,
    )

    const hint = screen.getByTestId('tool-hint')
    expect(hint).toHaveTextContent('Click empty canvas to add a point there.')
    expect(hint).not.toContainElement(screen.getByTestId('canvas-slot'))
    expect(hint).not.toContainElement(screen.getByTestId('side-rail-slot'))
  })

  it('replaces the hint text when the active tool changes', () => {
    const { rerender } = render(
      <EditorWorkArea hint="Drag empty canvas to pan the view." canvas={<div />} sideRail={<div />} />,
    )
    expect(screen.getByTestId('tool-hint')).toHaveTextContent('Drag empty canvas to pan the view.')

    rerender(
      <EditorWorkArea
        hint="Click a point to set it as the start/finish line."
        canvas={<div />}
        sideRail={<div />}
      />,
    )

    expect(screen.getByTestId('tool-hint')).toHaveTextContent(
      'Click a point to set it as the start/finish line.',
    )
  })
})

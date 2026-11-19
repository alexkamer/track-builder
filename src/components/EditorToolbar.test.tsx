import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorToolbar } from './EditorToolbar'
import type { PointClickMode } from './TrackEditor2D'

function baseProps(overrides: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  return {
    saveName: 'My Track',
    onSaveNameChange: vi.fn(),
    onLoadPresetById: vi.fn(),
    savedTracks: [],
    onLoadSavedById: vi.fn(),
    onSaveTrack: vi.fn(),
    canShare: true,
    onShareTrack: vi.fn(),
    shareUrl: null,
    shareError: null,
    toolMode: 'select' as PointClickMode,
    onSetToolMode: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    snapToGridEnabled: false,
    onToggleSnapToGrid: vi.fn(),
    canRace: true,
    errorCount: 0,
    onStartRace: vi.fn(),
    onBrowseTracks: vi.fn(),
    ...overrides,
  }
}

describe('EditorToolbar tool activation state', () => {
  it('marks only the active tool as pressed, with every tool label unchanged', () => {
    render(<EditorToolbar {...baseProps({ toolMode: 'add-point' })} />)

    expect(screen.getByTestId('add-point-tool-button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('select-tool-button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('start-line-tool-button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('checkpoint-tool-button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('pan-tool-button')).toHaveAttribute('aria-pressed', 'false')

    // Labels stay stable regardless of active state.
    expect(screen.getByTestId('add-point-tool-button')).toHaveTextContent('Add point')
    expect(screen.getByText('Set start/finish line')).toBeInTheDocument()
    expect(screen.getByText('Edit checkpoints')).toBeInTheDocument()
    expect(screen.getByText('Pan')).toBeInTheDocument()
  })

  it('activates a different tool by calling onSetToolMode with that tool', () => {
    const onSetToolMode = vi.fn()
    render(<EditorToolbar {...baseProps({ toolMode: 'select', onSetToolMode })} />)

    fireEvent.click(screen.getByTestId('start-line-tool-button'))

    expect(onSetToolMode).toHaveBeenCalledWith('start-line')
  })

  it('deactivates the active tool back to select', () => {
    const onSetToolMode = vi.fn()
    render(<EditorToolbar {...baseProps({ toolMode: 'pan', onSetToolMode })} />)

    fireEvent.click(screen.getByTestId('pan-tool-button'))

    expect(onSetToolMode).toHaveBeenCalledWith('select')
  })
})

describe('EditorToolbar snap-to-grid toggle', () => {
  it('reflects enabled state via aria-pressed with a stable label', () => {
    render(<EditorToolbar {...baseProps({ snapToGridEnabled: true })} />)

    const button = screen.getByTestId('snap-to-grid-button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Snap to grid')
  })

  it('calls onToggleSnapToGrid when clicked', () => {
    const onToggleSnapToGrid = vi.fn()
    render(<EditorToolbar {...baseProps({ onToggleSnapToGrid })} />)

    fireEvent.click(screen.getByTestId('snap-to-grid-button'))

    expect(onToggleSnapToGrid).toHaveBeenCalledTimes(1)
  })
})

describe('EditorToolbar race-entry validation summary', () => {
  it('shows an error count beside a disabled Start Race button when the track is invalid', () => {
    render(<EditorToolbar {...baseProps({ canRace: false, errorCount: 2 })} />)

    const startRace = screen.getByText('Start Race')
    expect(startRace).toBeDisabled()
    expect(startRace).toHaveAttribute('aria-describedby', 'race-validation-summary')
    expect(screen.getByTestId('race-validation-summary')).toHaveTextContent('2')
    expect(screen.getByTestId('race-validation-summary')).toHaveTextContent('issues to fix')
  })

  it('uses singular wording for exactly one outstanding error', () => {
    render(<EditorToolbar {...baseProps({ canRace: false, errorCount: 1 })} />)

    expect(screen.getByTestId('race-validation-summary')).toHaveTextContent('issue to fix')
  })

  it('removes the summary and enables Start Race once the track is valid', () => {
    render(<EditorToolbar {...baseProps({ canRace: true, errorCount: 0 })} />)

    const startRace = screen.getByText('Start Race')
    expect(startRace).toBeEnabled()
    expect(startRace).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('race-validation-summary')).not.toBeInTheDocument()
  })
})

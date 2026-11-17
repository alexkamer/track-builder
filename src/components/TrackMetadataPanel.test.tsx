import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrackMetadataPanel } from './TrackMetadataPanel'
import { createTrackDocument } from '../domain/track/schema'

describe('TrackMetadataPanel', () => {
  it('dispatches SET_METADATA with the author value (transiently) when typing in the author field', () => {
    const dispatch = vi.fn()
    render(<TrackMetadataPanel doc={createTrackDocument()} dispatch={dispatch} />)

    fireEvent.change(screen.getByTestId('metadata-author-input'), { target: { value: 'Alex' } })

    expect(dispatch).toHaveBeenCalledWith(
      { type: 'SET_METADATA', metadata: { author: 'Alex' } },
      { transient: true },
    )
  })

  it('dispatches SET_METADATA with the description value when typing in the description field', () => {
    const dispatch = vi.fn()
    render(<TrackMetadataPanel doc={createTrackDocument()} dispatch={dispatch} />)

    fireEvent.change(screen.getByTestId('metadata-description-input'), {
      target: { value: 'A fast oval' },
    })

    expect(dispatch).toHaveBeenCalledWith(
      { type: 'SET_METADATA', metadata: { description: 'A fast oval' } },
      { transient: true },
    )
  })

  it('calls onCommit when a field loses focus', () => {
    const dispatch = vi.fn()
    const onCommit = vi.fn()
    render(<TrackMetadataPanel doc={createTrackDocument()} dispatch={dispatch} onCommit={onCommit} />)

    fireEvent.blur(screen.getByTestId('metadata-author-input'))

    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('renders empty strings for unset metadata fields', () => {
    const dispatch = vi.fn()
    render(<TrackMetadataPanel doc={createTrackDocument()} dispatch={dispatch} />)

    expect(screen.getByTestId('metadata-author-input')).toHaveValue('')
    expect(screen.getByTestId('metadata-description-input')).toHaveValue('')
  })

  it("reflects the loaded track's existing metadata values", () => {
    const dispatch = vi.fn()
    const doc = createTrackDocument({ metadata: { author: 'Casey', description: 'A loop' } })
    render(<TrackMetadataPanel doc={doc} dispatch={dispatch} />)

    expect(screen.getByTestId('metadata-author-input')).toHaveValue('Casey')
    expect(screen.getByTestId('metadata-description-input')).toHaveValue('A loop')
  })
})

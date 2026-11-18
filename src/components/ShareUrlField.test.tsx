import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareUrlField } from './ShareUrlField'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ShareUrlField', () => {
  it('keeps the URL visible and selectable', () => {
    render(<ShareUrlField url="https://example.com/?track=abc" />)
    expect(screen.getByTestId('share-url-output')).toHaveValue('https://example.com/?track=abc')
  })

  it('copies the URL to the clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(<ShareUrlField url="https://example.com/?track=abc" />)
    fireEvent.click(screen.getByTestId('copy-share-url-button'))

    await waitFor(() => expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Copied to clipboard'))
    expect(writeText).toHaveBeenCalledWith('https://example.com/?track=abc')
  })

  it('shows a failure message and leaves the URL visible when the clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(<ShareUrlField url="https://example.com/?track=abc" />)
    fireEvent.click(screen.getByTestId('copy-share-url-button'))

    await waitFor(() =>
      expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Could not copy automatically'),
    )
    expect(screen.getByTestId('share-url-output')).toHaveValue('https://example.com/?track=abc')
  })

  it('shows a failure message when the clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })

    render(<ShareUrlField url="https://example.com/?track=abc" />)
    fireEvent.click(screen.getByTestId('copy-share-url-button'))

    await waitFor(() =>
      expect(screen.getByTestId('copy-feedback')).toHaveTextContent('Could not copy automatically'),
    )
  })
})

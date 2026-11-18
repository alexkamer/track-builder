import { useState } from 'react'

interface ShareUrlFieldProps {
  url: string
}

type CopyState = 'idle' | 'copied' | 'error'

/**
 * A labeled, read-only field for a generated shareable track URL with a copy-to-clipboard
 * button. The URL itself stays visible and selectable (readOnly input, not hidden) so a
 * failed clipboard write still leaves the user able to copy it manually.
 *
 * Callers should render this keyed by `url` (e.g. `<ShareUrlField key={url} url={url} />`)
 * so a newly generated URL remounts with fresh `copyState` instead of keeping feedback from
 * a previous copy attempt.
 */
export function ShareUrlField({ url }: ShareUrlFieldProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className="field share-field" data-testid="share-url-field">
      <label htmlFor="share-url-output">Shareable URL</label>
      <div className="share-field-row">
        <input id="share-url-output" type="text" data-testid="share-url-output" readOnly value={url} />
        <button type="button" className="btn" data-testid="copy-share-url-button" onClick={handleCopy}>
          Copy
        </button>
      </div>
      {copyState === 'copied' && (
        <span className="copy-feedback" data-testid="copy-feedback">
          Copied to clipboard
        </span>
      )}
      {copyState === 'error' && (
        <span className="copy-feedback copy-feedback--error" data-testid="copy-feedback">
          Could not copy automatically - select the URL above and copy it manually.
        </span>
      )}
    </div>
  )
}

import '@testing-library/jest-dom/vitest'
import ResizeObserverPolyfill from 'resize-observer-polyfill'

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}

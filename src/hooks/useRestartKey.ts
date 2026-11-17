import { useEffect } from 'react'

const RESTART_KEYS = new Set(['r', 'R'])

/** Fires `onRestart` when the restart key is pressed, kept separate from `useKeyboardCarInput` since it's not steering/throttle input. */
export function useRestartKey(onRestart: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (RESTART_KEYS.has(e.key)) onRestart()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRestart])
}

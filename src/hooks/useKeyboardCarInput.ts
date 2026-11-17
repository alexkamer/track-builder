import { useEffect, useRef } from 'react'
import type { CarInput } from '../domain/physics/carPhysics'

const THROTTLE_KEYS = new Set(['ArrowUp', 'w', 'W'])
const BRAKE_KEYS = new Set(['ArrowDown', 's', 'S'])
const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])

/**
 * Tracks currently-held keys and exposes a ref to the derived CarInput, read
 * once per fixed physics tick (not per keystroke) by the simulation loop.
 */
export function useKeyboardCarInput() {
  const pressed = useRef(new Set<string>())
  const inputRef = useRef<CarInput>({ throttle: 0, brake: 0, steer: 0 })

  useEffect(() => {
    const recompute = () => {
      const keys = pressed.current
      let steer = 0
      if (anyKeyIn(keys, LEFT_KEYS)) steer -= 1
      if (anyKeyIn(keys, RIGHT_KEYS)) steer += 1
      inputRef.current = {
        throttle: anyKeyIn(keys, THROTTLE_KEYS) ? 1 : 0,
        brake: anyKeyIn(keys, BRAKE_KEYS) ? 1 : 0,
        steer,
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      pressed.current.add(e.key)
      recompute()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      pressed.current.delete(e.key)
      recompute()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return inputRef
}

function anyKeyIn(pressed: Set<string>, candidates: Set<string>): boolean {
  for (const key of pressed) {
    if (candidates.has(key)) return true
  }
  return false
}

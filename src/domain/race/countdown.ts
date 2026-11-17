export type CountdownPhase = 3 | 2 | 1 | 'go' | null

/** Real seconds each countdown phase (3, 2, 1, "GO") is shown for, before advancing to the next. */
export const COUNTDOWN_PHASE_DURATION_SECONDS = 1

export interface CountdownState {
  phase: CountdownPhase
  elapsedInPhaseSeconds: number
}

export function createCountdownState(): CountdownState {
  return { phase: 3, elapsedInPhaseSeconds: 0 }
}

function nextPhase(phase: CountdownPhase): CountdownPhase {
  switch (phase) {
    case 3:
      return 2
    case 2:
      return 1
    case 1:
      return 'go'
    case 'go':
      return null
    case null:
      return null
  }
}

/**
 * Advances the countdown by one render frame's worth of real elapsed time, using the same
 * clock source as the fixed-timestep physics accumulator so the countdown doesn't drift
 * relative to it when a tab is throttled.
 */
export function tickCountdown(state: CountdownState, deltaSeconds: number): CountdownState {
  if (state.phase === null) return state

  let elapsed = state.elapsedInPhaseSeconds + deltaSeconds
  let phase: CountdownPhase = state.phase
  while (phase !== null && elapsed >= COUNTDOWN_PHASE_DURATION_SECONDS) {
    elapsed -= COUNTDOWN_PHASE_DURATION_SECONDS
    phase = nextPhase(phase)
  }
  return { phase, elapsedInPhaseSeconds: phase === null ? 0 : elapsed }
}

export function isControllable(phase: CountdownPhase): boolean {
  return phase === null
}

export function formatCountdownPhase(phase: CountdownPhase): string {
  if (phase === 'go') return 'GO'
  if (phase === null) return ''
  return String(phase)
}

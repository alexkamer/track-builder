/**
 * Accumulator that converts variable-length real-time frame deltas into a
 * stream of fixed-size simulation ticks, so the simulation rate never depends
 * on render frame rate (see design.md's determinism decision).
 */
export class FixedTimestepAccumulator {
  readonly fixedDt: number
  private accumulated = 0

  constructor(fixedDt: number) {
    this.fixedDt = fixedDt
  }

  /** Call once per render frame with the elapsed real seconds; returns how many fixed ticks to run now. */
  consume(elapsedSeconds: number): number {
    this.accumulated += elapsedSeconds
    let ticks = 0
    while (this.accumulated >= this.fixedDt) {
      this.accumulated -= this.fixedDt
      ticks++
    }
    return ticks
  }
}

export function runFixedTimestepSimulation<State, Input>(
  initialState: State,
  inputs: Input[],
  step: (state: State, input: Input, dt: number) => State,
  fixedDt: number,
): State[] {
  const states: State[] = []
  let state = initialState
  for (const input of inputs) {
    state = step(state, input, fixedDt)
    states.push(state)
  }
  return states
}

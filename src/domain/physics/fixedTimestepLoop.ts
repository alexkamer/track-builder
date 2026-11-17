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

  /**
   * How far (0..1) past the last completed tick the accumulator currently sits. Lets a
   * renderer interpolate between the previous and current tick's state for this frame
   * instead of holding position at the last tick until the next one lands, which is what
   * produces visible micro-stutter when the render frame rate doesn't line up exactly with
   * the fixed tick rate.
   */
  get alpha(): number {
    return this.accumulated / this.fixedDt
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

import { describe, expect, it } from 'vitest'
import { FixedTimestepAccumulator } from './fixedTimestepLoop'

describe('FixedTimestepAccumulator', () => {
  it('produces the same total tick count for the same total elapsed time regardless of frame rate', () => {
    const fixedDt = 1 / 60
    const totalSeconds = 2

    // Simulate steady 60fps frames (16.666ms each).
    const sixtyFps = new FixedTimestepAccumulator(fixedDt)
    let ticksAt60 = 0
    const frameDt60 = 1 / 60
    for (let t = 0; t < totalSeconds; t += frameDt60) {
      ticksAt60 += sixtyFps.consume(frameDt60)
    }

    // Simulate choppy, variable frame rate (30fps-ish with jitter) covering the same total time.
    const choppy = new FixedTimestepAccumulator(fixedDt)
    let ticksChoppy = 0
    const frameDurations = [0.04, 0.02, 0.05, 0.015, 0.06, 0.01, 0.033]
    let elapsed = 0
    let i = 0
    while (elapsed < totalSeconds) {
      const d = frameDurations[i % frameDurations.length]
      ticksChoppy += choppy.consume(d)
      elapsed += d
      i++
    }

    // Both runs simulate ~2 seconds of game time; tick counts should match within one tick.
    expect(Math.abs(ticksAt60 - ticksChoppy)).toBeLessThanOrEqual(1)
  })

  it('never drops time: accumulated ticks * fixedDt stays close to total elapsed time', () => {
    const fixedDt = 1 / 60
    const accumulator = new FixedTimestepAccumulator(fixedDt)
    let totalTicks = 0
    let totalElapsed = 0
    const frameDurations = [0.1, 0.1, 0.1, 0.1, 0.1]
    for (const d of frameDurations) {
      totalTicks += accumulator.consume(d)
      totalElapsed += d
    }
    expect(totalTicks * fixedDt).toBeCloseTo(totalElapsed, 1)
  })
})

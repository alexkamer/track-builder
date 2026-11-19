export interface CarInput {
  /** 0..1 */
  throttle: number
  /** 0..1 */
  brake: number
  /** -1 (left) .. 1 (right) */
  steer: number
}

export interface CarState {
  x: number
  z: number
  /** radians, 0 = facing +z */
  headingRad: number
  /** signed forward speed, world units/second */
  speed: number
  /** signed lateral (sideways) speed relative to heading, world units/second - the car's drift/slide */
  lateralSlip: number
}

export const NEUTRAL_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0 }

function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2
  let diff = ((b - a) % twoPi + twoPi) % twoPi
  if (diff > Math.PI) diff -= twoPi
  return a + diff * t
}

/**
 * Blends between the tick state from before this render frame and the tick state after it,
 * for rendering only - physics itself always advances in exact fixed steps. Used so the car's
 * on-screen position glides between ticks instead of holding still until the next tick lands,
 * which otherwise reads as a stutter whenever render frame rate doesn't exactly match the
 * fixed tick rate (see FixedTimestepAccumulator.alpha).
 */
export function interpolateCarState(prev: CarState, next: CarState, alpha: number): CarState {
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    z: prev.z + (next.z - prev.z) * alpha,
    headingRad: lerpAngle(prev.headingRad, next.headingRad, alpha),
    speed: next.speed,
    lateralSlip: next.lateralSlip,
  }
}

export interface CarPhysicsParams {
  acceleration: number
  brakeDeceleration: number
  drag: number
  maxSpeed: number
  maxReverseSpeed: number
  baseTurnRate: number
  /** Largest lateral slip speed the tires can be pushed to, world units/second. */
  maxLateralSlip: number
  /** How quickly actual lateral slip approaches its speed/steering-driven target, 1/second - higher = more grip. */
  gripResponseRate: number
  /**
   * Extra per-second speed decay applied while off the road surface, on top of normal drag.
   * Tuned low enough that the car can still accelerate and steer back onto a curving road
   * after clipping the edge - a steeper value traps the car in a self-reinforcing spiral
   * (slower speed -> less turn authority, since turn rate scales with speed -> can't catch
   * back up to a curving road -> stays off-track), which reads as "the car never goes fast"
   * rather than as a corner-cutting penalty.
   */
  offTrackDecay: number
}

export const DEFAULT_CAR_PARAMS: CarPhysicsParams = {
  // Drag is linear in speed (`speed -= speed * drag * dt`), so full-throttle speed doesn't
  // climb toward maxSpeed at all on its own - it settles at the accel/drag equilibrium,
  // acceleration / drag, same as a terminal velocity. At the old acceleration (20) that
  // equilibrium was 20 / 0.6 ≈ 33.3 units/s (~74.6 mph) - *below* even the old maxSpeed (40),
  // so the car never reached its displayed top speed at all, on any track. Raising maxSpeed
  // alone (see below) didn't change that ceiling one bit. Acceleration now clears
  // maxSpeed * drag (55 * 0.6 = 33), so the car actually climbs to and gets clamped at
  // maxSpeed instead of asymptoting below it.
  acceleration: 35,
  brakeDeceleration: 30,
  drag: 0.6,
  maxSpeed: 55,
  maxReverseSpeed: -12,
  // achievableTurnRadius = maxSpeed / baseTurnRate, independent of actual speed (see that
  // function's doc comment) - raising maxSpeed alone would *widen* the minimum corner radius
  // validation requires, pushing generated tracks toward even wider, gentler sweeps. Raising
  // baseTurnRate by more than maxSpeed's own increase shrinks the achievable radius instead
  // (55/4.6 ~ 12 vs the old 40/2.2 ~ 18.2), so tracks can carry real hairpins/chicanes - the
  // sharp, F1-style corners a bigger minimum radius was ruling out - while the car is also
  // faster everywhere else.
  baseTurnRate: 4.6,
  maxLateralSlip: 14,
  gripResponseRate: 6,
  offTrackDecay: 0.8,
}

/**
 * The tightest turning radius the car can achieve at full steering lock. Turn rate is
 * `steer * baseTurnRate * (|speed| / maxSpeed)`, so radius = speed / turnRate reduces to
 * `maxSpeed / baseTurnRate` at `steer = 1` - independent of speed, since turn rate scales
 * linearly with speed in this model. Used to calibrate the track editor's minimum corner
 * radius validation against what the car can actually drive.
 */
export function achievableTurnRadius(params: CarPhysicsParams = DEFAULT_CAR_PARAMS): number {
  return params.maxSpeed / params.baseTurnRate
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Advances car state by one fixed tick. Pure function of (state, input, dt, params) -
 * no wall-clock, no randomness - so identical input sequences always produce identical
 * output sequences (see design.md's determinism decision).
 */
export function stepCarPhysics(
  state: CarState,
  input: CarInput,
  dt: number,
  params: CarPhysicsParams = DEFAULT_CAR_PARAMS,
  isOffTrack = false,
): CarState {
  let speed = state.speed
  speed += input.throttle * params.acceleration * dt

  if (input.brake > 0) {
    const brakeAmount = params.brakeDeceleration * input.brake * dt
    if (speed > 0) speed = Math.max(0, speed - brakeAmount)
    else if (speed < 0) speed = Math.min(0, speed + brakeAmount)
  }

  speed -= speed * params.drag * dt
  if (isOffTrack) {
    speed -= speed * params.offTrackDecay * dt
  }
  speed = clamp(speed, params.maxReverseSpeed, params.maxSpeed)

  // Steering authority scales with speed so the car can't pivot in place,
  // and reverses handling sense when driving backward.
  const speedFactor = clamp(Math.abs(speed) / params.maxSpeed, 0, 1)
  const direction = speed < 0 ? -1 : 1
  const turnRate = input.steer * params.baseTurnRate * speedFactor * direction
  const headingRad = state.headingRad + turnRate * dt

  // Grip/drift: the lateral slip the tires are being pushed toward grows with both
  // steering sharpness and speed (squared, so it only shows up meaningfully at speed);
  // actual slip approaches that target at a grip-limited rate rather than snapping to it,
  // so easing off steering or slowing down lets grip reel the slide back in.
  const slipTarget = clamp(
    input.steer * speedFactor * speedFactor * params.maxLateralSlip * direction,
    -params.maxLateralSlip,
    params.maxLateralSlip,
  )
  const slipBlend = clamp(params.gripResponseRate * dt, 0, 1)
  const lateralSlip = state.lateralSlip + (slipTarget - state.lateralSlip) * slipBlend

  const forwardX = Math.sin(headingRad)
  const forwardZ = Math.cos(headingRad)
  const rightX = Math.cos(headingRad)
  const rightZ = -Math.sin(headingRad)

  const x = state.x + (forwardX * speed + rightX * lateralSlip) * dt
  const z = state.z + (forwardZ * speed + rightZ * lateralSlip) * dt

  return { x, z, headingRad, speed, lateralSlip }
}

export function createInitialCarState(x = 0, z = 0, headingRad = 0): CarState {
  return { x, z, headingRad, speed: 0, lateralSlip: 0 }
}

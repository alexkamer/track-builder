import type { GeneratedTrack } from '../generation/generateTrack'
import type { CarInput, CarState } from './carPhysics'
import { stepCarPhysics } from './carPhysics'
import { isOnRoadSurface } from './trackSurface'
import { resolveBarrierCollision } from './barrierCollision'

/**
 * One fixed physics tick with off-track penalty and barrier collision applied - shared by
 * the live car and ghost replay so a recorded input log reproduces the exact same path.
 */
export function advanceCarTick(state: CarState, input: CarInput, dt: number, track: GeneratedTrack): CarState {
  const offTrack = !isOnRoadSurface(state, track)
  const stepped = stepCarPhysics(state, input, dt, undefined, offTrack)
  return resolveBarrierCollision(stepped, track)
}

import type { CarInput } from './carPhysics'

const STEER_DEADZONE = 0.1

/** Reads the first connected gamepad's throttle/brake/steer as a CarInput, or null if none is connected. */
export function readGamepadInput(): CarInput | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null

  const pads = navigator.getGamepads()
  const pad = pads[0]
  if (!pad) return null

  const rawSteer = pad.axes[0] ?? 0
  const steer = Math.abs(rawSteer) > STEER_DEADZONE ? rawSteer : 0
  const throttle = pad.buttons[7]?.value ?? 0 // right trigger (standard mapping)
  const brake = pad.buttons[6]?.value ?? 0 // left trigger (standard mapping)

  return { throttle, brake, steer }
}

/** Combines keyboard and gamepad input, taking whichever source is pushing each axis harder. */
export function mergeCarInputs(primary: CarInput, secondary: CarInput | null): CarInput {
  if (!secondary) return primary
  return {
    throttle: Math.max(primary.throttle, secondary.throttle),
    brake: Math.max(primary.brake, secondary.brake),
    steer: Math.abs(secondary.steer) > Math.abs(primary.steer) ? secondary.steer : primary.steer,
  }
}

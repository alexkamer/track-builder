import { afterEach, describe, expect, it, vi } from 'vitest'
import { mergeCarInputs, readGamepadInput } from './gamepadInput'

function mockGamepad(overrides: Partial<Gamepad> = {}): Gamepad {
  return {
    axes: [0, 0],
    buttons: Array.from({ length: 8 }, () => ({ value: 0, pressed: false, touched: false })),
    connected: true,
    id: 'mock',
    index: 0,
    mapping: 'standard',
    timestamp: 0,
    hapticActuators: [],
    vibrationActuator: null,
    ...overrides,
  } as Gamepad
}

describe('readGamepadInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when no gamepad is connected', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [null] })
    expect(readGamepadInput()).toBeNull()
  })

  it('maps stick and trigger values to throttle/brake/steer', () => {
    const pad = mockGamepad({
      axes: [0.6, 0],
      buttons: [
        { value: 0, pressed: false, touched: false },
        { value: 0, pressed: false, touched: false },
        { value: 0, pressed: false, touched: false },
        { value: 0, pressed: false, touched: false },
        { value: 0, pressed: false, touched: false },
        { value: 0, pressed: false, touched: false },
        { value: 0.3, pressed: true, touched: true }, // left trigger -> brake
        { value: 0.8, pressed: true, touched: true }, // right trigger -> throttle
      ],
    })
    vi.stubGlobal('navigator', { getGamepads: () => [pad] })

    const input = readGamepadInput()
    expect(input).toEqual({ throttle: 0.8, brake: 0.3, steer: 0.6 })
  })

  it('applies a deadzone to small stick movements', () => {
    const pad = mockGamepad({ axes: [0.03, 0] })
    vi.stubGlobal('navigator', { getGamepads: () => [pad] })
    expect(readGamepadInput()?.steer).toBe(0)
  })
})

describe('mergeCarInputs', () => {
  it('returns the keyboard input unchanged when no gamepad is present', () => {
    const keyboard = { throttle: 1, brake: 0, steer: -0.5 }
    expect(mergeCarInputs(keyboard, null)).toEqual(keyboard)
  })

  it('takes the stronger value on each axis between keyboard and gamepad', () => {
    const keyboard = { throttle: 0, brake: 0, steer: 0.2 }
    const gamepad = { throttle: 0.9, brake: 0.4, steer: -0.7 }
    expect(mergeCarInputs(keyboard, gamepad)).toEqual({ throttle: 0.9, brake: 0.4, steer: -0.7 })
  })
})

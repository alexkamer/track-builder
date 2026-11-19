import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOWPOLY_CAR_ID, parseCarSource } from './carSource'

const DEV = true
const PROD = false

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseCarSource', () => {
  it('uses the primitive car when no parameter is present', () => {
    expect(parseCarSource('', DEV)).toEqual({ kind: 'primitive' })
    expect(parseCarSource('?other=1', DEV)).toEqual({ kind: 'primitive' })
  })

  it('selects the default low-poly car for a bare ?car=lowpoly', () => {
    expect(parseCarSource('?car=lowpoly', DEV)).toEqual({
      kind: 'lowpoly',
      id: DEFAULT_LOWPOLY_CAR_ID,
    })
  })

  it('selects a specific car with ?car=lowpoly:<id>', () => {
    expect(parseCarSource('?car=lowpoly:car04', DEV)).toEqual({ kind: 'lowpoly', id: 'car04' })
  })

  it('accepts an explicit ?car=primitive', () => {
    expect(parseCarSource('?car=primitive', DEV)).toEqual({ kind: 'primitive' })
  })

  it('falls back to the primitive car for an unrecognized value, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseCarSource('?car=banana', DEV)).toEqual({ kind: 'primitive' })
    expect(warn).toHaveBeenCalledOnce()
  })

  it('rejects a car id that could escape the dev-cars directory', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const id of ['../secret', 'a/b', 'car20?x=1', 'http://evil.test/car']) {
      expect(parseCarSource(`?car=lowpoly:${id}`, DEV)).toEqual({ kind: 'primitive' })
    }
    expect(warn).toHaveBeenCalledTimes(4)
  })

  it('ignores the parameter entirely in a production build', () => {
    expect(parseCarSource('?car=lowpoly', PROD)).toEqual({ kind: 'primitive' })
    expect(parseCarSource('?car=lowpoly:car04', PROD)).toEqual({ kind: 'primitive' })
  })

  it('does not warn in production, since the parameter is simply inert there', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseCarSource('?car=banana', PROD)).toEqual({ kind: 'primitive' })
    expect(warn).not.toHaveBeenCalled()
  })
})

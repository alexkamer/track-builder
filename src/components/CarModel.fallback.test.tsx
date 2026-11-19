/**
 * The primitive car must be what renders whenever the optional low-poly source is not usable.
 *
 * `CarModel` renders the primitive car exactly when `useLowPolyCar` returns null, so these
 * exercise the hook directly: the three.js parts of the component only mount inside a WebGL
 * canvas, which jsdom cannot provide, and a smoke test there could not tell the two cars apart.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { Group } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WHEEL_RADIUS } from './CarModel'
import { useLowPolyCar } from './useLowPolyCar'
import type { CarSource } from './carSource'

const { loadLowPolyCar, buildLowPolyCar } = vi.hoisted(() => ({
  loadLowPolyCar: vi.fn(),
  buildLowPolyCar: vi.fn(),
}))

vi.mock('./lowPolyCar', () => ({ loadLowPolyCar, buildLowPolyCar }))

const PRIMITIVE: CarSource = { kind: 'primitive' }

/**
 * A distinct car id per test. Loaded assets are cached per id for the lifetime of the module,
 * which is what lets the player's car and the ghost share one parse - so tests must not share an
 * id, or one test's cached promise answers the next test's load.
 */
let nextCarId = 0
function lowPolySource(): CarSource {
  nextCarId += 1
  return { kind: 'lowpoly', id: `test-car-${nextCarId}` }
}

function fakeBuilt(wheelRadius: number) {
  const root = new Group()
  return {
    handle: {
      root,
      frontSteerPivots: [new Group(), new Group()] as [Group, Group],
      wheelMeshes: [],
      wheelRadius,
    },
    dispose: vi.fn(),
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useLowPolyCar', () => {
  it('returns null for the primitive source without loading anything', () => {
    const { result } = renderHook(() => useLowPolyCar(PRIMITIVE, '#ffd166', 1))

    expect(result.current).toBeNull()
    expect(loadLowPolyCar).not.toHaveBeenCalled()
  })

  it('returns null while the load is still pending, so the primitive car fills the gap', () => {
    loadLowPolyCar.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useLowPolyCar(lowPolySource(), '#ffd166', 1))

    expect(result.current).toBeNull()
  })

  it('returns null and warns when the files are absent', async () => {
    const source = lowPolySource()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadLowPolyCar.mockRejectedValue(new Error('no car manifest at /dev-cars/car20.json (404)'))

    const { result } = renderHook(() => useLowPolyCar(source, '#ffd166', 1))

    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(result.current).toBeNull()
    expect(buildLowPolyCar).not.toHaveBeenCalled()
    expect(String(warn.mock.calls[0][0])).toMatch(/rendering the primitive car/)
  })

  it('returns null and warns when the manifest is missing a required field', async () => {
    const source = lowPolySource()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadLowPolyCar.mockRejectedValue(new Error('manifest.axles must hold exactly 4 positions'))

    const { result } = renderHook(() => useLowPolyCar(source, '#ffd166', 1))

    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })

  it('returns the built car once loading succeeds, carrying its own wheel radius', async () => {
    const source = lowPolySource()
    const built = fakeBuilt(0.44)
    loadLowPolyCar.mockResolvedValue({ manifest: { wheelRadius: 0.44 } })
    buildLowPolyCar.mockReturnValue(built)

    const { result } = renderHook(() => useLowPolyCar(source, '#ffd166', 1))

    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.handle.wheelRadius).toBe(0.44)
    // Distinctly not the primitive car's wheels, which is what the rigs would otherwise assume.
    expect(result.current?.handle.wheelRadius).not.toBe(WHEEL_RADIUS)
  })

  it('passes the car colour and ghost opacity through to the build', async () => {
    const source = lowPolySource()
    loadLowPolyCar.mockResolvedValue({ manifest: { wheelRadius: 0.44 } })
    buildLowPolyCar.mockReturnValue(fakeBuilt(0.44))

    renderHook(() => useLowPolyCar(source, '#4ea8de', 0.45))

    await waitFor(() => expect(buildLowPolyCar).toHaveBeenCalled())
    expect(buildLowPolyCar.mock.calls[0][1]).toEqual({ color: '#4ea8de', opacity: 0.45 })
  })

  it('disposes the built car when the component unmounts', async () => {
    const source = lowPolySource()
    const built = fakeBuilt(0.44)
    loadLowPolyCar.mockResolvedValue({ manifest: { wheelRadius: 0.44 } })
    buildLowPolyCar.mockReturnValue(built)

    const { result, unmount } = renderHook(() => useLowPolyCar(source, '#ffd166', 1))
    await waitFor(() => expect(result.current).not.toBeNull())

    unmount()
    expect(built.dispose).toHaveBeenCalled()
  })

  it('does not cache a failed load, so a later run of the extractor is picked up', async () => {
    const source = lowPolySource()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadLowPolyCar.mockRejectedValueOnce(new Error('404'))

    const first = renderHook(() => useLowPolyCar(source, '#ffd166', 1))
    await waitFor(() => expect(warn).toHaveBeenCalled())
    first.unmount()

    loadLowPolyCar.mockResolvedValue({ manifest: { wheelRadius: 0.44 } })
    buildLowPolyCar.mockReturnValue(fakeBuilt(0.44))

    const second = renderHook(() => useLowPolyCar(source, '#ffd166', 1))
    await waitFor(() => expect(second.result.current).not.toBeNull())
    expect(loadLowPolyCar).toHaveBeenCalledTimes(2)
  })
})

/**
 * Which car geometry to render.
 *
 * The shipped car is always `primitive`: it is built from primitives in code, so it depends on
 * no asset and cannot fail to load. The `lowpoly` source reads geometry extracted from a local
 * car pack by `scripts/extract_car.py`, which is a non-redistributable download - those files
 * are gitignored and absent from any build, so this source exists only as a development
 * convenience and is unreachable in production. See docs/dev-cars.md.
 *
 * Selection is a query parameter rather than a build-time env var because a developer needs to
 * compare cars without a rebuild, and rather than a UI control because the picker must not
 * exist in the shipped interface.
 */

export type CarSource = { kind: 'primitive' } | { kind: 'lowpoly'; id: string }

export const PRIMITIVE_CAR: CarSource = { kind: 'primitive' }

/** The car used for a bare `?car=lowpoly`. A sedan, the closest thing in the pack to a racer. */
export const DEFAULT_LOWPOLY_CAR_ID = 'car20'

/** Where the extractor writes, and so where the loader fetches from. */
export const LOWPOLY_CAR_BASE_URL = '/dev-cars'

/**
 * Car ids become a URL path segment, so they are restricted to characters that cannot escape
 * the dev-cars directory or smuggle in a query or host.
 */
const SAFE_ID = /^[A-Za-z0-9_-]+$/

/**
 * Parse a car selection from a URL query string.
 *
 * `isDev` gates the whole feature: in a production build the parameter is ignored, so the
 * primitive car is the only possible result.
 */
export function parseCarSource(search: string, isDev: boolean): CarSource {
  if (!isDev) return PRIMITIVE_CAR

  const raw = new URLSearchParams(search).get('car')
  if (raw === null) return PRIMITIVE_CAR

  const value = raw.trim()
  if (value === '' || value === 'primitive') return PRIMITIVE_CAR

  const [kind, ...rest] = value.split(':')
  if (kind !== 'lowpoly') {
    console.warn(`[carSource] unrecognized ?car=${raw}; rendering the primitive car instead`)
    return PRIMITIVE_CAR
  }

  const id = rest.join(':').trim()
  if (id === '') return { kind: 'lowpoly', id: DEFAULT_LOWPOLY_CAR_ID }
  if (!SAFE_ID.test(id)) {
    console.warn(`[carSource] unsafe car id in ?car=${raw}; rendering the primitive car instead`)
    return PRIMITIVE_CAR
  }
  return { kind: 'lowpoly', id }
}

/**
 * Read the selection once from the current URL. Read at module scope by callers so switching
 * cars is a reload, which also guarantees a clean three.js scene for the new geometry.
 */
export function readCarSource(): CarSource {
  if (typeof window === 'undefined') return PRIMITIVE_CAR
  return parseCarSource(window.location.search, import.meta.env.DEV)
}

import { useEffect, useState } from 'react'
import type { CarSource } from './carSource'
// Type-only: erased at compile time, so the shipped bundle keeps no reference to the dev-only
// loader. The one runtime reference is the DEV-gated dynamic import below.
import type { BuiltLowPolyCar, LowPolyCarAssets } from './lowPolyCar'

/**
 * Loaded assets are cached per car id so the player's car and the ghost share one parse of the
 * mesh instead of fetching and parsing it twice.
 */
const assetCache = new Map<string, Promise<LowPolyCarAssets>>()

/**
 * Load and build the optional low-poly car, or return null to mean "render the primitive one".
 *
 * Null is returned while loading and after any failure, so the primitive car is what fills the
 * gap in both cases: a development convenience must never be able to leave the race carless.
 */
export function useLowPolyCar(
  source: CarSource,
  color: string,
  opacity: number,
): BuiltLowPolyCar | null {
  const [built, setBuilt] = useState<BuiltLowPolyCar | null>(null)

  useEffect(() => {
    // `import.meta.env.DEV` is statically false in a production build, so this whole branch -
    // including the dynamic import below - is eliminated from the shipped bundle.
    if (!import.meta.env.DEV) return
    if (source.kind !== 'lowpoly') return

    let cancelled = false
    let disposeBuilt: (() => void) | undefined

    void import('./lowPolyCar')
      .then(async (module) => {
        let assets = assetCache.get(source.id)
        if (assets === undefined) {
          assets = module.loadLowPolyCar(source.id)
          assetCache.set(source.id, assets)
        }
        const resolved = await assets.catch((error: unknown) => {
          // Don't cache a failure: the developer may well be running the extractor right now.
          assetCache.delete(source.id)
          throw error
        })
        if (cancelled) return

        const result = module.buildLowPolyCar(resolved, { color, opacity })
        disposeBuilt = result.dispose
        setBuilt(result)
      })
      .catch((error: unknown) => {
        console.warn(
          `[CarModel] low-poly car "${source.id}" unavailable; rendering the primitive car. ` +
            'See docs/dev-cars.md',
          error,
        )
      })

    return () => {
      cancelled = true
      disposeBuilt?.()
      setBuilt(null)
    }
  }, [source, color, opacity])

  return built
}

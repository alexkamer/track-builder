import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SceneAssetsProvider, useSurfaceTextures } from './SceneAssets'

/** Reports what the provider is publishing for a surface, so the degradation path is observable. */
function RoadTextureProbe() {
  const textures = useSurfaceTextures('road')
  return <span data-testid="road-textures">{textures ? 'textured' : 'flat'}</span>
}

describe('SceneAssetsProvider', () => {
  it('renders children with no textures when the manifest is empty', () => {
    render(
      <SceneAssetsProvider manifest={{}}>
        <RoadTextureProbe />
      </SceneAssetsProvider>,
    )

    expect(screen.getByTestId('road-textures')).toHaveTextContent('flat')
  })

  it('still renders children, with no textures, when loading rejects', async () => {
    // jsdom cannot decode an image, so this URL can never resolve - the same shape of failure
    // as an absent file or an offline dev server. The scene must stay drivable regardless.
    const onError = vi.fn()

    render(
      <SceneAssetsProvider manifest={{ road: { map: '/assets/does-not-exist.webp' } }} onError={onError}>
        <RoadTextureProbe />
      </SceneAssetsProvider>,
    )

    // Children are siblings of the loader, so they are present immediately rather than waiting
    // on the fetch - this is what keeps a failed load from blocking the scene indefinitely.
    expect(screen.getByTestId('road-textures')).toHaveTextContent('flat')

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(screen.getByTestId('road-textures')).toHaveTextContent('flat')
  })

  it('does not remount children when asset state changes', async () => {
    // Remounting would reset the car's physics mid-race, so the provider must keep children
    // mounted across a load resolving or failing.
    const mounted = vi.fn()

    // A one-shot mount observer rather than a render counter: re-renders are fine, remounts are not.
    function MountCounter() {
      useEffect(() => {
        mounted()
      }, [])
      return <RoadTextureProbe />
    }

    render(
      <SceneAssetsProvider manifest={{ road: { map: '/assets/does-not-exist.webp' } }}>
        <MountCounter />
      </SceneAssetsProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('road-textures')).toBeInTheDocument())
    expect(mounted).toHaveBeenCalledTimes(1)
  })
})

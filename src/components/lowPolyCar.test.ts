import { Group, Mesh, MeshStandardMaterial } from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { describe, expect, it, vi } from 'vitest'
import {
  buildLowPolyCar,
  collectParts,
  createRoleMaterials,
  loadLowPolyCar,
  parseManifest,
  type LowPolyCarManifest,
} from './lowPolyCar'

/** A square in the x/z plane, as the extractor emits groups: `g <name>` + `usemtl <name>`. */
function objGroup(name: string, y: number): string {
  return [
    `g ${name}`,
    `usemtl ${name}`,
    `v -0.5 ${y} -0.5`,
    `v 0.5 ${y} -0.5`,
    `v 0.5 ${y} 0.5`,
    'f -3 -2 -1',
  ].join('\n')
}

const OBJ_TEXT = [
  objGroup('tile_0_2', 1),
  objGroup('tile_0_4', 2),
  objGroup('tile_0_0', 3),
  objGroup('wheel', 4),
].join('\n')

const MANIFEST: LowPolyCarManifest = {
  name: 'car20',
  mesh: 'car20.obj',
  wheelRadius: 0.44,
  axles: [
    { x: -0.78, y: 0.44, z: 1.19 },
    { x: 0.78, y: 0.44, z: 1.19 },
    { x: -0.78, y: 0.44, z: -1.53 },
    { x: 0.78, y: 0.44, z: -1.53 },
  ],
  roles: { tile_0_2: 'paint', tile_0_4: 'glass', tile_0_0: 'light' },
}

const parseObj = (text: string) => new OBJLoader().parse(text)

function response(body: unknown, contentType: string): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': contentType }),
    json: async () => body,
    text: async () => String(body),
  } as Response
}

function stubFetch(
  files: Record<string, unknown>,
  { missing = [] as string[] } = {},
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const key = Object.keys(files).find((name) => url.endsWith(name))
    if (key === undefined || missing.some((name) => url.endsWith(name))) {
      return { ok: false, status: 404, headers: new Headers() } as Response
    }
    const body = files[key]
    return response(body, url.endsWith('.json') ? 'application/json' : 'text/plain')
  }) as unknown as typeof fetch
}

/** What a dev server's SPA fallback answers with when the car files were never generated. */
const INDEX_HTML = '<!doctype html>\n<html lang="en">\n<head></head>\n</html>'

describe('parseManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(parseManifest({ ...MANIFEST }).wheelRadius).toBe(0.44)
  })

  it.each([
    ['not an object', 42],
    ['a missing mesh name', { ...MANIFEST, mesh: undefined }],
    ['a zero wheel radius', { ...MANIFEST, wheelRadius: 0 }],
    ['a non-numeric wheel radius', { ...MANIFEST, wheelRadius: 'big' }],
    ['three axles', { ...MANIFEST, axles: MANIFEST.axles.slice(0, 3) }],
    ['an axle missing a coordinate', { ...MANIFEST, axles: [{ x: 0, y: 0 }, ...MANIFEST.axles] }],
    ['no roles map', { ...MANIFEST, roles: null }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseManifest(value)).toThrow()
  })
})

describe('collectParts', () => {
  it('names body groups from the OBJ and maps them to manifest roles', () => {
    const { bodyParts, wheelGeometry } = collectParts(parseObj(OBJ_TEXT), MANIFEST)

    expect(bodyParts.map((part) => [part.name, part.role])).toEqual([
      ['tile_0_2', 'paint'],
      ['tile_0_4', 'glass'],
      ['tile_0_0', 'light'],
    ])
    expect(wheelGeometry.attributes.position.count).toBe(3)
  })

  it('draws an unmapped or unknown group as trim rather than dropping it', () => {
    const manifest = { ...MANIFEST, roles: { tile_0_2: 'chartreuse' } }
    const { bodyParts } = collectParts(parseObj(OBJ_TEXT), manifest)

    expect(bodyParts).toHaveLength(3)
    expect(bodyParts.every((part) => part.role === 'trim')).toBe(true)
  })

  it('throws when the mesh has no wheel group', () => {
    const noWheel = [objGroup('tile_0_2', 1)].join('\n')
    expect(() => collectParts(parseObj(noWheel), MANIFEST)).toThrow(/no "wheel" group/)
  })

  it('throws when the mesh has no body groups', () => {
    expect(() => collectParts(parseObj(objGroup('wheel', 1)), MANIFEST)).toThrow(/no body groups/)
  })
})

describe('loadLowPolyCar', () => {
  it('fetches the manifest and mesh and returns the assembled assets', async () => {
    const assets = await loadLowPolyCar('car20', {
      baseUrl: '/dev-cars',
      fetchImpl: stubFetch({ 'car20.json': MANIFEST, 'car20.obj': OBJ_TEXT }),
      parseObj,
    })

    expect(assets.manifest.wheelRadius).toBe(0.44)
    expect(assets.bodyParts).toHaveLength(3)
  })

  it('reports a missing manifest with a pointer to the extractor', async () => {
    await expect(
      loadLowPolyCar('car20', {
        fetchImpl: stubFetch({}),
        parseObj,
      }),
    ).rejects.toThrow(/extract_car\.py/)
  })

  it('treats an SPA-fallback HTML manifest as a missing car, not a parse error', async () => {
    const fetchImpl = vi.fn(async () =>
      response(INDEX_HTML, 'text/html'),
    ) as unknown as typeof fetch

    await expect(loadLowPolyCar('car20', { fetchImpl, parseObj })).rejects.toThrow(
      /no car manifest.*got text\/html.*extract_car\.py/s,
    )
  })

  it('treats an SPA-fallback HTML mesh as a missing car', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('.json')
        ? response(MANIFEST, 'application/json')
        : response(INDEX_HTML, 'text/html'),
    ) as unknown as typeof fetch

    await expect(loadLowPolyCar('car20', { fetchImpl, parseObj })).rejects.toThrow(
      /no car mesh.*served HTML/s,
    )
  })

  it('reports a missing mesh file', async () => {
    await expect(
      loadLowPolyCar('car20', {
        fetchImpl: stubFetch({ 'car20.json': MANIFEST, 'car20.obj': OBJ_TEXT }, {
          missing: ['car20.obj'],
        }),
        parseObj,
      }),
    ).rejects.toThrow(/no car mesh/)
  })
})

describe('createRoleMaterials', () => {
  it('paints only the paint role in the car colour', () => {
    const materials = createRoleMaterials('#ff0000', 1)

    expect(materials.paint.color.getHexString()).toBe('ff0000')
    for (const role of ['glass', 'trim', 'light', 'tyre'] as const) {
      expect(materials[role].color.getHexString()).not.toBe('ff0000')
    }
  })

  it('makes every role transparent for a ghost', () => {
    const materials = createRoleMaterials('#4ea8de', 0.45)

    for (const material of Object.values(materials)) {
      expect(material.transparent).toBe(true)
      expect(material.opacity).toBeLessThan(1)
    }
  })

  it('keeps glass opaque on a live car, so the road is not visible through the roof', () => {
    // The pack merges the roof panel into the same atlas tile as the windows, so a see-through
    // glass material makes the whole cabin transparent when viewed from above.
    const materials = createRoleMaterials('#ffd166', 1)

    expect(materials.glass.transparent).toBe(false)
    expect(materials.glass.opacity).toBe(1)
  })
})

describe('buildLowPolyCar', () => {
  const load = () => collectParts(parseObj(OBJ_TEXT), MANIFEST)

  it('satisfies the CarModelHandle contract', () => {
    const { handle } = buildLowPolyCar({ manifest: MANIFEST, ...load() }, { color: '#ffd166' })

    expect(handle.root).toBeInstanceOf(Group)
    expect(handle.frontSteerPivots).toHaveLength(2)
    expect(handle.frontSteerPivots.every((pivot) => pivot instanceof Group)).toBe(true)
    expect(handle.wheelMeshes).toHaveLength(4)
    expect(handle.wheelMeshes.every((mesh) => mesh instanceof Mesh)).toBe(true)
    expect(handle.wheelRadius).toBe(MANIFEST.wheelRadius)
  })

  it('positions the wheels at the manifest axles, front pair steerable', () => {
    const { handle } = buildLowPolyCar({ manifest: MANIFEST, ...load() }, { color: '#ffd166' })

    // +z is forward in the physics model, so the steered pair is the one at the larger z.
    for (const pivot of handle.frontSteerPivots) {
      expect(pivot.position.z).toBeCloseTo(1.19, 6)
    }
    expect(handle.frontSteerPivots[0].position.x).toBeLessThan(0)
    expect(handle.frontSteerPivots[1].position.x).toBeGreaterThan(0)

    const zs = handle.wheelMeshes.map((mesh) => mesh.parent!.parent!.position.z).sort()
    expect(zs).toEqual([-1.53, -1.53, 1.19, 1.19])
  })

  it('nests each wheel so steering and spin do not fight', () => {
    const { handle } = buildLowPolyCar({ manifest: MANIFEST, ...load() }, { color: '#ffd166' })

    for (const mesh of handle.wheelMeshes) {
      const tilt = mesh.parent!
      // The tilt group carries the fixed sideways axle rotation, matching the primitive car.
      expect(tilt.rotation.z).toBeCloseTo(Math.PI / 2, 10)
      // The steering pivot above it carries no tilt of its own, so the rig owns rotation.y.
      expect(tilt.parent!.rotation.z).toBe(0)
      expect(mesh.rotation.y).toBe(0)
    }
  })

  it('gives the wheels the tyre material, not the body colour', () => {
    const { handle } = buildLowPolyCar({ manifest: MANIFEST, ...load() }, { color: '#ff0000' })

    for (const mesh of handle.wheelMeshes) {
      expect((mesh.material as MeshStandardMaterial).color.getHexString()).not.toBe('ff0000')
    }
  })

  it('does not rotate the shared wheel geometry twice across builds', () => {
    const assets = { manifest: MANIFEST, ...load() }
    const before = Array.from(assets.wheelGeometry.attributes.position.array)

    buildLowPolyCar(assets, { color: '#ffd166' })
    buildLowPolyCar(assets, { color: '#4ea8de', opacity: 0.45 })

    expect(Array.from(assets.wheelGeometry.attributes.position.array)).toEqual(before)
  })

  it('disposes the materials it created', () => {
    const { handle, dispose } = buildLowPolyCar(
      { manifest: MANIFEST, ...load() },
      { color: '#ffd166' },
    )
    const material = handle.wheelMeshes[0].material as MeshStandardMaterial
    const disposed = vi.fn()
    material.addEventListener('dispose', disposed)

    dispose()
    expect(disposed).toHaveBeenCalled()
  })
})

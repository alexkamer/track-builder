/**
 * Loads a car extracted from a local car pack by `scripts/extract_car.py` and assembles it into
 * the same `CarModelHandle` the primitive car provides, so the rigs cannot tell the difference.
 *
 * DEVELOPMENT ONLY. The source packs are not redistributable, so the files this reads are
 * gitignored and never present in a build; `carSource` makes this module unreachable unless
 * `import.meta.env.DEV`, and `CarModel` only ever imports it dynamically. See docs/dev-cars.md.
 *
 * The pack encodes colour as a position in a shading-ramp atlas rather than as materials, so the
 * extractor splits the body into one group per atlas tile and names a role for each. This module
 * throws those UVs away and assigns real materials by role, which is what keeps the car's paint
 * driven by a prop instead of baked into a texture.
 */

import {
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from 'three'
import { LOWPOLY_CAR_BASE_URL } from './carSource'
import type { CarModelHandle } from './CarModel'

export type CarPartRole = 'paint' | 'glass' | 'trim' | 'light' | 'tyre'

const ROLES: readonly CarPartRole[] = ['paint', 'glass', 'trim', 'light', 'tyre']

export interface LowPolyCarManifest {
  name: string
  mesh: string
  wheelRadius: number
  axles: Array<{ x: number; y: number; z: number }>
  roles: Record<string, string>
}

export interface LowPolyCarAssets {
  manifest: LowPolyCarManifest
  /** One entry per body group, carrying the role the manifest assigned to it. */
  bodyParts: Array<{ name: string; role: CarPartRole; geometry: BufferGeometry }>
  wheelGeometry: BufferGeometry
}

/** The group name the extractor gives the single wheel mesh that all four wheels instance. */
const WHEEL_GROUP = 'wheel'

function isRole(value: unknown): value is CarPartRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

/**
 * Validate a manifest before anything is built from it. A half-valid manifest would otherwise
 * surface much later as a car with three wheels or wheels of radius NaN.
 */
export function parseManifest(value: unknown): LowPolyCarManifest {
  if (typeof value !== 'object' || value === null) throw new Error('manifest is not an object')
  const manifest = value as Record<string, unknown>

  if (typeof manifest.mesh !== 'string' || manifest.mesh === '') {
    throw new Error('manifest.mesh must name the OBJ file')
  }
  if (typeof manifest.wheelRadius !== 'number' || !(manifest.wheelRadius > 0)) {
    throw new Error('manifest.wheelRadius must be a positive number')
  }
  if (!Array.isArray(manifest.axles) || manifest.axles.length !== 4) {
    throw new Error(`manifest.axles must hold exactly 4 positions, got ${
      Array.isArray(manifest.axles) ? manifest.axles.length : typeof manifest.axles
    }`)
  }
  for (const axle of manifest.axles) {
    const point = axle as Record<string, unknown>
    if (
      typeof point?.x !== 'number' ||
      typeof point?.y !== 'number' ||
      typeof point?.z !== 'number'
    ) {
      throw new Error('every manifest.axles entry needs numeric x, y and z')
    }
  }
  if (typeof manifest.roles !== 'object' || manifest.roles === null) {
    throw new Error('manifest.roles must map group names to material roles')
  }

  return {
    name: typeof manifest.name === 'string' ? manifest.name : 'car',
    mesh: manifest.mesh,
    wheelRadius: manifest.wheelRadius,
    axles: manifest.axles as LowPolyCarManifest['axles'],
    roles: manifest.roles as Record<string, string>,
  }
}

/**
 * Pull the body groups and the wheel out of a parsed OBJ scene.
 *
 * The extractor writes one `g`/`usemtl` pair per group, which OBJLoader turns into one named
 * child mesh each - so group names survive the trip and are the lookup key for roles.
 */
export function collectParts(
  scene: Group,
  manifest: LowPolyCarManifest,
): Omit<LowPolyCarAssets, 'manifest'> {
  const bodyParts: LowPolyCarAssets['bodyParts'] = []
  let wheelGeometry: BufferGeometry | null = null

  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const name = child.name || (child.material as Material | undefined)?.name || ''
    if (name === WHEEL_GROUP) {
      wheelGeometry = child.geometry
      return
    }
    const declared = manifest.roles[name]
    // An unmapped or unknown group is drawn as trim rather than dropped: a visible grey panel
    // is a far better failure than a car with a hole in it.
    const role = isRole(declared) ? declared : 'trim'
    bodyParts.push({ name, role, geometry: child.geometry })
  })

  if (wheelGeometry === null) {
    throw new Error(`car mesh has no "${WHEEL_GROUP}" group`)
  }
  if (bodyParts.length === 0) {
    throw new Error('car mesh has no body groups')
  }
  return { bodyParts, wheelGeometry }
}

/** Fetch and parse a car's manifest and mesh. `fetchImpl` is injectable so tests need no network. */
export async function loadLowPolyCar(
  id: string,
  options: {
    baseUrl?: string
    fetchImpl?: typeof fetch
    parseObj?: (text: string) => Group
  } = {},
): Promise<LowPolyCarAssets> {
  const baseUrl = options.baseUrl ?? LOWPOLY_CAR_BASE_URL
  const fetchImpl = options.fetchImpl ?? fetch

  const missingCarHint = 'Run scripts/extract_car.py first - see docs/dev-cars.md'

  const manifestResponse = await fetchImpl(`${baseUrl}/${id}.json`)
  // An absent car does not 404: the dev server's SPA fallback answers with index.html, so the
  // content type is what actually distinguishes "no such car" from a real manifest. Checking it
  // keeps the common mistake - forgetting to run the extractor - a readable message instead of
  // a JSON parse error.
  const manifestType = manifestResponse.headers?.get('content-type') ?? ''
  if (!manifestResponse.ok || (manifestType !== '' && !manifestType.includes('json'))) {
    throw new Error(
      `no car manifest at ${baseUrl}/${id}.json (${manifestResponse.status}` +
        `${manifestType === '' ? '' : `, got ${manifestType}`}). ${missingCarHint}`,
    )
  }
  const manifest = parseManifest(await manifestResponse.json())

  const meshResponse = await fetchImpl(`${baseUrl}/${manifest.mesh}`)
  if (!meshResponse.ok) {
    throw new Error(`no car mesh at ${baseUrl}/${manifest.mesh} (${meshResponse.status})`)
  }
  const text = await meshResponse.text()
  if (text.trimStart().startsWith('<')) {
    throw new Error(`no car mesh at ${baseUrl}/${manifest.mesh} (served HTML). ${missingCarHint}`)
  }

  let parseObj: (objText: string) => Group
  if (options.parseObj !== undefined) {
    parseObj = options.parseObj
  } else {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
    const loader = new OBJLoader()
    parseObj = (objText: string) => loader.parse(objText)
  }

  return { manifest, ...collectParts(parseObj(text), manifest) }
}

/**
 * Materials per role. The pack's own atlas texture is deliberately unused: roles let the paint
 * follow the `color` prop, which a baked texture could not.
 */
export function createRoleMaterials(color: string, opacity: number): Record<CarPartRole, MeshStandardMaterial> {
  const transparent = opacity < 1

  return {
    paint: new MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.15,
      transparent,
      opacity,
    }),
    // Dark and glossy but opaque, matching the source art's flat tinted panels. Deliberately
    // not see-through: the pack merges the roof into the same atlas tile as the windows, so a
    // translucent glass material shows the road through the car's roof from above.
    glass: new MeshStandardMaterial({
      color: '#1b2228',
      roughness: 0.08,
      metalness: 0.1,
      transparent,
      opacity,
    }),
    trim: new MeshStandardMaterial({
      color: '#5a5f66',
      roughness: 0.4,
      metalness: 0.7,
      transparent,
      opacity,
    }),
    light: new MeshStandardMaterial({
      color: '#fff6d8',
      emissive: '#ffd98a',
      emissiveIntensity: 0.35,
      roughness: 0.25,
      transparent,
      opacity,
    }),
    tyre: new MeshStandardMaterial({
      color: '#141416',
      roughness: 0.9,
      metalness: 0,
      transparent,
      opacity,
    }),
  }
}

export interface BuiltLowPolyCar {
  handle: CarModelHandle
  /** Releases the materials this build created. Geometry is owned by the loaded assets. */
  dispose: () => void
}

/**
 * Assemble the loaded parts into a posable car.
 *
 * The wheel hierarchy deliberately mirrors the primitive car's: an outer steering pivot (front
 * wheels only, rotated by the rig), a middle group holding the fixed 90-degree tilt that points
 * the axle sideways, and an inner mesh whose local-Y rotation is the rolling spin. Keeping the
 * same shape means the rigs drive both sources with identical code.
 *
 * The extracted wheel's axle runs along its own X, so its geometry is rotated onto Y first to
 * match the primitive's cylinder convention.
 */
export function buildLowPolyCar(
  assets: LowPolyCarAssets,
  { color, opacity = 1 }: { color: string; opacity?: number },
): BuiltLowPolyCar {
  const materials = createRoleMaterials(color, opacity)
  const root = new Group()

  for (const part of assets.bodyParts) {
    const mesh = new Mesh(part.geometry, materials[part.role])
    mesh.name = part.name
    mesh.castShadow = true
    root.add(mesh)
  }

  // Rotate a copy of the wheel geometry so its axle lies along local Y, as the primitive's
  // cylinder does. Cloned rather than rotated in place so re-building (a colour change, a
  // second car in the scene) cannot rotate the same geometry twice.
  const wheelGeometry = assets.wheelGeometry.clone()
  wheelGeometry.rotateZ(Math.PI / 2)

  const axles = [...assets.manifest.axles].sort((a, b) => b.z - a.z || a.x - b.x)
  const steerPivots: Group[] = []
  const wheelMeshes: Mesh[] = []

  axles.forEach((axle, index) => {
    const pivot = new Group()
    pivot.position.set(axle.x, axle.y, axle.z)

    const tilt = new Group()
    tilt.rotation.z = Math.PI / 2

    const mesh = new Mesh(wheelGeometry, materials.tyre)
    mesh.name = `${WHEEL_GROUP}-${index}`
    mesh.castShadow = true

    tilt.add(mesh)
    pivot.add(tilt)
    root.add(pivot)

    steerPivots.push(pivot)
    wheelMeshes.push(mesh)
  })

  // Axles are sorted front-first (largest z, matching the physics model's +z forward), so the
  // first two pivots are the steered pair.
  const frontSteerPivots: [Group, Group] = [steerPivots[0], steerPivots[1]]

  return {
    handle: { root, frontSteerPivots, wheelMeshes, wheelRadius: assets.manifest.wheelRadius },
    dispose: () => {
      wheelGeometry.dispose()
      for (const material of Object.values(materials)) material.dispose()
    },
  }
}

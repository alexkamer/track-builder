import { Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { orientCarRoot } from './CarModel'

describe('orientCarRoot', () => {
  it('rolls the right side down and the left side up for positive banking (negative roll)', () => {
    const root = new Group()
    const bankingRad = (10 * Math.PI) / 180
    orientCarRoot(root, 0, -bankingRad)

    const right = new Vector3(1, 0, 0).applyQuaternion(root.quaternion)
    const left = new Vector3(-1, 0, 0).applyQuaternion(root.quaternion)

    expect(right.y).toBeLessThan(0)
    expect(left.y).toBeGreaterThan(0)
  })

  it('applies no roll when rollRad is 0', () => {
    const root = new Group()
    orientCarRoot(root, 0, 0)

    const right = new Vector3(1, 0, 0).applyQuaternion(root.quaternion)
    expect(right.y).toBeCloseTo(0, 10)
  })

  it('rolls relative to the car facing direction, independent of heading', () => {
    // Facing +x (heading 90deg): the car's own "right" is now world -z, not world +x.
    const root = new Group()
    const bankingRad = (10 * Math.PI) / 180
    orientCarRoot(root, Math.PI / 2, -bankingRad)

    const localRight = new Vector3(1, 0, 0).applyQuaternion(root.quaternion)
    expect(localRight.y).toBeLessThan(0)
    expect(Math.abs(localRight.z)).toBeGreaterThan(Math.abs(localRight.x))
  })

  it('still points forward along the heading when rolled', () => {
    const root = new Group()
    orientCarRoot(root, Math.PI / 2, (10 * Math.PI) / 180)

    const forward = new Vector3(0, 0, 1).applyQuaternion(root.quaternion)
    expect(forward.x).toBeCloseTo(1, 5)
    expect(forward.z).toBeCloseTo(0, 5)
  })
})

import { describe, expect, it } from 'vitest'
import { snapToGrid } from './grid'

describe('snapToGrid', () => {
  it('snaps to the nearest grid intersection', () => {
    expect(snapToGrid({ x: 23, z: 48 }, 20)).toEqual({ x: 20, z: 40 })
    expect(snapToGrid({ x: 29, z: 51 }, 20)).toEqual({ x: 20, z: 60 })
  })

  it('leaves an already-aligned point unchanged', () => {
    expect(snapToGrid({ x: 40, z: 60 }, 20)).toEqual({ x: 40, z: 60 })
  })
})

export const DEFAULT_GRID_SIZE = 20

export interface Point2D {
  x: number
  z: number
}

export function snapToGrid(point: Point2D, gridSize: number = DEFAULT_GRID_SIZE): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    z: Math.round(point.z / gridSize) * gridSize,
  }
}

export const TRACK_SCHEMA_VERSION = 1 as const

export interface ControlPoint {
  x: number
  z: number
  elevation: number
  width: number
  bankingDeg: number
}

/** `controlPointIndex: UNSET_START_LINE` means no control point has been designated yet. */
export const UNSET_START_LINE = -1

export interface StartLine {
  controlPointIndex: number
  headingDeg: number
}

export interface Checkpoint {
  controlPointIndex: number
}

export interface TrackMetadata {
  author?: string
  description?: string
}

export interface TrackDocument {
  schemaVersion: typeof TRACK_SCHEMA_VERSION
  id: string
  name: string
  createdAt: string
  controlPoints: ControlPoint[]
  startLine: StartLine
  checkpoints: Checkpoint[]
  metadata: TrackMetadata
}

export function createControlPoint(
  overrides: Partial<ControlPoint> = {},
): ControlPoint {
  return {
    x: 0,
    z: 0,
    elevation: 0,
    width: 10,
    bankingDeg: 0,
    ...overrides,
  }
}

export function createTrackDocument(
  overrides: Partial<TrackDocument> = {},
): TrackDocument {
  return {
    schemaVersion: TRACK_SCHEMA_VERSION,
    id: overrides.id ?? '',
    name: overrides.name ?? 'Untitled Track',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    controlPoints: overrides.controlPoints ?? [],
    startLine: overrides.startLine ?? { controlPointIndex: UNSET_START_LINE, headingDeg: 0 },
    checkpoints: overrides.checkpoints ?? [],
    metadata: overrides.metadata ?? {},
  }
}

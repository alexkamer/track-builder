import { createControlPoint, createTrackDocument, type TrackDocument } from './schema'
import { tangentHeadingDeg } from './heading'

/** Index of the control point each preset below designates as its start/finish line. */
const START_INDEX = 0

function ovalSpeedway(): TrackDocument {
  const width = 14
  const controlPoints = [
    createControlPoint({ x: -120, z: -60, width }),
    createControlPoint({ x: 0, z: -90, width }),
    createControlPoint({ x: 120, z: -60, width }),
    createControlPoint({ x: 150, z: 0, width }),
    createControlPoint({ x: 120, z: 60, width }),
    createControlPoint({ x: 0, z: 90, width }),
    createControlPoint({ x: -120, z: 60, width }),
    createControlPoint({ x: -150, z: 0, width }),
  ]
  const startIndex = 7
  return createTrackDocument({
    id: 'preset-oval-speedway',
    name: 'Oval Speedway',
    controlPoints,
    startLine: { controlPointIndex: startIndex, headingDeg: tangentHeadingDeg(controlPoints, startIndex) },
    metadata: { description: 'A fast, wide oval - good for learning the controls.' },
  })
}

function serpentineCircuit(): TrackDocument {
  const width = 12
  // Scaled 2x from the original layout (uniformly, about the origin) so the tightest
  // corner (near the last control point) clears the car's realistic minimum turning
  // radius - see MIN_CORNER_RADIUS in ../track/validation.ts.
  const controlPoints = [
    createControlPoint({ x: 0, z: 0, width }),
    createControlPoint({ x: 200, z: -80, width }),
    createControlPoint({ x: 400, z: 0, width }),
    createControlPoint({ x: 520, z: 160, width }),
    createControlPoint({ x: 440, z: 320, width }),
    createControlPoint({ x: 240, z: 360, width }),
    createControlPoint({ x: 80, z: 280, width }),
    createControlPoint({ x: -80, z: 200, width }),
    createControlPoint({ x: -160, z: 80, width }),
  ]
  return createTrackDocument({
    id: 'preset-serpentine-circuit',
    name: 'Serpentine Circuit',
    controlPoints,
    startLine: { controlPointIndex: START_INDEX, headingDeg: tangentHeadingDeg(controlPoints, START_INDEX) },
    metadata: { description: 'A winding circuit with a mix of fast and technical corners.' },
  })
}

function grandLoop(): TrackDocument {
  const width = 13
  const controlPoints = [
    createControlPoint({ x: 0, z: -140, width, elevation: 0 }),
    createControlPoint({ x: 130, z: -130, width, elevation: 8, bankingDeg: 10 }),
    createControlPoint({ x: 200, z: -40, width, elevation: 12 }),
    createControlPoint({ x: 190, z: 80, width, elevation: 6, bankingDeg: -8 }),
    createControlPoint({ x: 100, z: 160, width, elevation: 0 }),
    createControlPoint({ x: -40, z: 170, width, elevation: 0 }),
    createControlPoint({ x: -160, z: 100, width, elevation: 4, bankingDeg: 8 }),
    createControlPoint({ x: -200, z: -20, width, elevation: 0 }),
    createControlPoint({ x: -130, z: -120, width, elevation: 0 }),
  ]
  return createTrackDocument({
    id: 'preset-grand-loop',
    name: 'Grand Loop',
    controlPoints,
    startLine: { controlPointIndex: START_INDEX, headingDeg: tangentHeadingDeg(controlPoints, START_INDEX) },
    metadata: { description: 'A long, varied loop with elevation changes and banked corners.' },
  })
}

function deltaCircuit(): TrackDocument {
  const width = 12
  // A rounded triangle: two long straights into a steep climb to a high apex, then back
  // down through a pair of oppositely-banked corners - a deliberately angular silhouette
  // next to the ovals/loops above.
  const controlPoints = [
    createControlPoint({ x: -130, z: 170, width, elevation: 0 }),
    createControlPoint({ x: 130, z: 170, width, elevation: 0 }),
    createControlPoint({ x: 230, z: 100, width, elevation: 4, bankingDeg: 8 }),
    createControlPoint({ x: 220, z: -10, width, elevation: 8, bankingDeg: 8 }),
    createControlPoint({ x: 150, z: -140, width, elevation: 14 }),
    createControlPoint({ x: 60, z: -230, width, elevation: 18 }),
    createControlPoint({ x: -60, z: -230, width, elevation: 18 }),
    createControlPoint({ x: -150, z: -140, width, elevation: 10 }),
    createControlPoint({ x: -220, z: -10, width, elevation: 4, bankingDeg: -8 }),
    // Banking eases back to flat by the time the road returns to ground level, rather than
    // staying banked at elevation 0 - which would tilt one edge of the road below ground
    // (see validateGroundClearance).
    createControlPoint({ x: -230, z: 100, width, elevation: 0 }),
  ]
  return createTrackDocument({
    id: 'preset-delta-circuit',
    name: 'Delta Circuit',
    controlPoints,
    startLine: { controlPointIndex: START_INDEX, headingDeg: tangentHeadingDeg(controlPoints, START_INDEX) },
    metadata: { description: 'A rounded triangle with a steep climb to its highest corner and banked turns on the way back down.' },
  })
}

function hairpinAlley(): TrackDocument {
  const width = 11
  // A long back straight into a tight, banked hairpin at the far end, then home via a
  // short chicane - a narrower, pointier shape than the loop/oval presets.
  const controlPoints = [
    createControlPoint({ x: 180, z: 220, width, elevation: 0 }),
    createControlPoint({ x: 200, z: 60, width, elevation: 0 }),
    createControlPoint({ x: 180, z: -120, width, elevation: 6, bankingDeg: 10 }),
    createControlPoint({ x: 110, z: -230, width, elevation: 10, bankingDeg: 10 }),
    createControlPoint({ x: 0, z: -260, width, elevation: 12 }),
    createControlPoint({ x: -110, z: -230, width, elevation: 10, bankingDeg: -10 }),
    createControlPoint({ x: -190, z: -100, width, elevation: 4, bankingDeg: -10 }),
    createControlPoint({ x: -160, z: 40, width, elevation: 0 }),
    createControlPoint({ x: -200, z: 180, width, elevation: 0 }),
    createControlPoint({ x: -100, z: 230, width, elevation: 0 }),
  ]
  return createTrackDocument({
    id: 'preset-hairpin-alley',
    name: 'Hairpin Alley',
    controlPoints,
    startLine: { controlPointIndex: START_INDEX, headingDeg: tangentHeadingDeg(controlPoints, START_INDEX) },
    metadata: { description: 'A long straight into a tight banked hairpin, home via a short chicane.' },
  })
}

export const PRESET_TRACKS: TrackDocument[] = [
  ovalSpeedway(),
  serpentineCircuit(),
  grandLoop(),
  deltaCircuit(),
  hairpinAlley(),
]

import { createControlPoint, createTrackDocument, type TrackDocument } from './schema'

function ovalSpeedway(): TrackDocument {
  const width = 14
  return createTrackDocument({
    id: 'preset-oval-speedway',
    name: 'Oval Speedway',
    controlPoints: [
      createControlPoint({ x: -120, z: -60, width }),
      createControlPoint({ x: 0, z: -90, width }),
      createControlPoint({ x: 120, z: -60, width }),
      createControlPoint({ x: 150, z: 0, width }),
      createControlPoint({ x: 120, z: 60, width }),
      createControlPoint({ x: 0, z: 90, width }),
      createControlPoint({ x: -120, z: 60, width }),
      createControlPoint({ x: -150, z: 0, width }),
    ],
    startLine: { controlPointIndex: 7, headingDeg: 0 },
    metadata: { description: 'A fast, wide oval - good for learning the controls.' },
  })
}

function serpentineCircuit(): TrackDocument {
  const width = 12
  return createTrackDocument({
    id: 'preset-serpentine-circuit',
    name: 'Serpentine Circuit',
    // Scaled 2x from the original layout (uniformly, about the origin) so the tightest
    // corner (near the last control point) clears the car's realistic minimum turning
    // radius - see MIN_CORNER_RADIUS in ../track/validation.ts.
    controlPoints: [
      createControlPoint({ x: 0, z: 0, width }),
      createControlPoint({ x: 200, z: -80, width }),
      createControlPoint({ x: 400, z: 0, width }),
      createControlPoint({ x: 520, z: 160, width }),
      createControlPoint({ x: 440, z: 320, width }),
      createControlPoint({ x: 240, z: 360, width }),
      createControlPoint({ x: 80, z: 280, width }),
      createControlPoint({ x: -80, z: 200, width }),
      createControlPoint({ x: -160, z: 80, width }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 60 },
    metadata: { description: 'A winding circuit with a mix of fast and technical corners.' },
  })
}

function grandLoop(): TrackDocument {
  const width = 13
  return createTrackDocument({
    id: 'preset-grand-loop',
    name: 'Grand Loop',
    controlPoints: [
      createControlPoint({ x: 0, z: -140, width, elevation: 0 }),
      createControlPoint({ x: 130, z: -130, width, elevation: 8, bankingDeg: 10 }),
      createControlPoint({ x: 200, z: -40, width, elevation: 12 }),
      createControlPoint({ x: 190, z: 80, width, elevation: 6, bankingDeg: -8 }),
      createControlPoint({ x: 100, z: 160, width, elevation: 0 }),
      createControlPoint({ x: -40, z: 170, width, elevation: 0 }),
      createControlPoint({ x: -160, z: 100, width, elevation: 4, bankingDeg: 8 }),
      createControlPoint({ x: -200, z: -20, width, elevation: 0 }),
      createControlPoint({ x: -130, z: -120, width, elevation: 0 }),
    ],
    startLine: { controlPointIndex: 0, headingDeg: 90 },
    metadata: { description: 'A long, varied loop with elevation changes and banked corners.' },
  })
}

export const PRESET_TRACKS: TrackDocument[] = [ovalSpeedway(), serpentineCircuit(), grandLoop()]

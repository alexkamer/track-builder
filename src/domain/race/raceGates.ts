import type { TrackDocument } from '../track/schema'
import type { GeneratedTrack } from '../generation/generateTrack'
import type { StartLineGate } from './lapTimer'

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export interface RaceGates {
  startGate: StartLineGate
  checkpointGates: StartLineGate[]
}

/**
 * Derives the start-line and checkpoint crossing gates from a generated track. Shared by the
 * client (live lap tracking) and the server (replay verification) so both compute identical
 * gates from the same track data - required for server-side verification to agree with the client.
 */
export function computeRaceGates(doc: TrackDocument, generated: GeneratedTrack): RaceGates {
  const startGate: StartLineGate = {
    position: { x: generated.spawn.position.x, z: generated.spawn.position.z },
    headingRad: degToRad(generated.spawn.headingDeg),
    width: doc.controlPoints[doc.startLine.controlPointIndex]?.width ?? 10,
  }

  const checkpointGates: StartLineGate[] = generated.checkpointTriggers.map((trigger) => {
    const dx = trigger.left.x - trigger.right.x
    const dz = trigger.left.z - trigger.right.z
    const width = Math.hypot(dx, dz)
    // Heading perpendicular to the left/right span, pointing in the direction of travel
    // (consistent with forward = (sin(heading), cos(heading)) used throughout physics/lap code).
    const headingRad = Math.atan2(dz, -dx)
    return {
      position: { x: (trigger.left.x + trigger.right.x) / 2, z: (trigger.left.z + trigger.right.z) / 2 },
      headingRad,
      width,
    }
  })

  return { startGate, checkpointGates }
}

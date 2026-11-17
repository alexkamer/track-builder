import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { CarState } from '../domain/physics/carPhysics'
import { elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'

const BEHIND_DISTANCE = 12
const HEIGHT = 5
const LOOK_AHEAD_HEIGHT = 1.5
/** Smoothing factor per frame so the camera trails the car instead of snapping rigidly to it. */
const FOLLOW_LERP = 0.12

interface ChaseCameraProps {
  carStateRef: RefObject<CarState>
  track: GeneratedTrack
}

/** Follows behind the car, tracking its position, heading, and road elevation every frame. */
export function ChaseCamera({ carStateRef, track }: ChaseCameraProps) {
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    const car = carStateRef.current
    if (!car) return

    // TopDownCamera repoints "up" to look straight down without rolling; reset it here every
    // frame so switching back from top-down doesn't leave this camera rolled 90 degrees.
    camera.up.set(0, 1, 0)

    const roadY = elevationAt(car, track)
    const targetX = car.x - Math.sin(car.headingRad) * BEHIND_DISTANCE
    const targetZ = car.z - Math.cos(car.headingRad) * BEHIND_DISTANCE

    camera.position.x += (targetX - camera.position.x) * FOLLOW_LERP
    camera.position.y += (roadY + HEIGHT - camera.position.y) * FOLLOW_LERP
    camera.position.z += (targetZ - camera.position.z) * FOLLOW_LERP
    camera.lookAt(car.x, roadY + LOOK_AHEAD_HEIGHT, car.z)
  })

  return null
}

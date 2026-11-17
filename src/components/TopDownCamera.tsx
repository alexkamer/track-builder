import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { CarState } from '../domain/physics/carPhysics'
import { elevationAt } from '../domain/physics/trackSurface'
import type { GeneratedTrack } from '../domain/generation/generateTrack'

const HEIGHT = 60

interface TopDownCameraProps {
  carStateRef: RefObject<CarState>
  track: GeneratedTrack
}

/** Follows directly above the car, looking straight down at the road surface beneath it. */
export function TopDownCamera({ carStateRef, track }: TopDownCameraProps) {
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    const car = carStateRef.current
    if (!car) return
    const roadY = elevationAt(car, track)
    camera.position.set(car.x, roadY + HEIGHT, car.z)
    camera.lookAt(car.x, roadY, car.z)
    camera.up.set(0, 0, -1) // keep "forward" oriented consistently in the top-down view
  })

  return null
}

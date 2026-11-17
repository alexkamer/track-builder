import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { CarState } from '../domain/physics/carPhysics'

const HEIGHT = 60

interface TopDownCameraProps {
  carStateRef: RefObject<CarState>
}

/** Follows directly above the car, looking straight down. */
export function TopDownCamera({ carStateRef }: TopDownCameraProps) {
  const camera = useThree((state) => state.camera)

  useFrame(() => {
    const car = carStateRef.current
    if (!car) return
    camera.position.set(car.x, HEIGHT, car.z)
    camera.lookAt(car.x, 0, car.z)
    camera.up.set(0, 0, -1) // keep "forward" oriented consistently in the top-down view
  })

  return null
}

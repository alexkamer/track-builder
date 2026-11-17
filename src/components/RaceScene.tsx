import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import { generateTrack } from '../domain/generation/generateTrack'
import { useKeyboardCarInput } from '../hooks/useKeyboardCarInput'
import { useRaceSession } from '../hooks/useRaceSession'
import { useRestartKey } from '../hooks/useRestartKey'
import { createInitialCarState, type CarState } from '../domain/physics/carPhysics'
import {
  createCountdownState,
  formatCountdownPhase,
  isControllable,
  tickCountdown,
  type CountdownState,
} from '../domain/race/countdown'
import { RibbonMesh3D, RoadMesh3D } from './RoadMesh3D'
import { CarRig } from './CarRig'
import { GhostRig } from './GhostRig'
import { ChaseCamera } from './ChaseCamera'
import { TopDownCamera } from './TopDownCamera'
import { TrackScenery } from './TrackScenery'
import { LeaderboardPanel } from './LeaderboardPanel'

interface RaceSceneProps {
  doc: TrackDocument
  trackId?: string | null
}

type CameraMode = 'chase' | 'topdown'

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2).padStart(5, '0')
  return `${minutes}:${secs}`
}

/** Renders inside the Canvas to advance the countdown using the same real-elapsed-time clock as the physics loop, so it doesn't drift under tab throttling. */
function CountdownDriver({ active, onTick }: { active: boolean; onTick: (deltaSeconds: number) => void }) {
  useFrame((_, delta) => {
    if (active) onTick(delta)
  })
  return null
}

/** Renders the generated track and a keyboard/gamepad-drivable car with lap timing, best-lap ghost, and switchable camera. */
export function RaceScene({ doc, trackId = null }: RaceSceneProps) {
  const generated = useMemo(() => generateTrack(doc), [doc])
  const inputRef = useKeyboardCarInput()
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase')
  const [countdown, setCountdown] = useState<CountdownState>(createCountdownState)
  const [resetToken, setResetToken] = useState(0)

  const startHeadingRad = degToRad(generated.spawn.headingDeg)
  const carStateRef = useRef<CarState>(
    createInitialCarState(generated.spawn.position.x, generated.spawn.position.z, startHeadingRad),
  )

  const { liveLapSeconds, lastLapSeconds, bestLapSeconds, ghostInputLog, handleTick, resetAttempt } = useRaceSession(
    doc,
    generated,
  )

  const controllable = isControllable(countdown.phase)

  const handleRestart = () => {
    carStateRef.current = createInitialCarState(generated.spawn.position.x, generated.spawn.position.z, startHeadingRad)
    setResetToken((t) => t + 1)
    resetAttempt()
    setCountdown(createCountdownState())
  }

  useRestartKey(handleRestart)

  return (
    <>
      <div className="race-hud" data-testid="race-hud">
        <span>Current lap: {formatLapTime(liveLapSeconds)}</span>
        <span data-testid="last-lap-time">
          Last lap: {lastLapSeconds !== null ? formatLapTime(lastLapSeconds) : '--:--'}
        </span>
        <span data-testid="best-lap-time">
          Best lap: {bestLapSeconds !== null ? formatLapTime(bestLapSeconds) : '--:--'}
        </span>
      </div>
      <button
        type="button"
        className="camera-toggle"
        data-testid="camera-toggle-button"
        onClick={() => setCameraMode((m) => (m === 'chase' ? 'topdown' : 'chase'))}
      >
        Camera: {cameraMode === 'chase' ? 'Chase' : 'Top-down'}
      </button>
      <button type="button" className="restart-button" data-testid="restart-button" onClick={handleRestart}>
        Restart
      </button>
      {countdown.phase !== null && (
        <div className="countdown-overlay" data-testid="countdown-overlay">
          {formatCountdownPhase(countdown.phase)}
        </div>
      )}
      <Canvas data-testid="race-canvas" camera={{ fov: 60 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[50, 100, 50]} intensity={2} />
        <TrackScenery centerline={generated.centerline} />
        <RoadMesh3D roadMesh={generated.roadMesh} />
        <RibbonMesh3D mesh={generated.curbLeft} color="#d62828" testId="curb-left" />
        <RibbonMesh3D mesh={generated.curbRight} color="#f1faee" testId="curb-right" />
        <RibbonMesh3D mesh={generated.barrierLeft} color="#495057" roughness={0.6} testId="barrier-left" />
        <RibbonMesh3D mesh={generated.barrierRight} color="#495057" roughness={0.6} testId="barrier-right" />
        <CarRig
          carStateRef={carStateRef}
          inputRef={inputRef}
          track={generated}
          controllable={controllable}
          resetToken={resetToken}
          onTick={handleTick}
        />
        <GhostRig spawn={generated.spawn} inputLog={ghostInputLog} track={generated} />
        {cameraMode === 'chase' ? (
          <ChaseCamera carStateRef={carStateRef} track={generated} />
        ) : (
          <TopDownCamera carStateRef={carStateRef} track={generated} />
        )}
        <CountdownDriver active={countdown.phase !== null} onTick={(delta) => setCountdown((c) => tickCountdown(c, delta))} />
      </Canvas>
      <LeaderboardPanel trackId={trackId} bestLapInputLog={ghostInputLog} hasBestLap={bestLapSeconds !== null} />
    </>
  )
}

import { Stats } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMemo, useRef, useState } from 'react'
import type { TrackDocument } from '../domain/track/schema'
import { generateTrack } from '../domain/generation/generateTrack'
import { useKeyboardCarInput } from '../hooks/useKeyboardCarInput'
import { useRaceSession } from '../hooks/useRaceSession'
import { useRestartKey } from '../hooks/useRestartKey'
import { createInitialCarState, type CarInput, type CarState } from '../domain/physics/carPhysics'
import { unitsPerSecondToMph } from '../domain/physics/units'
import { elevationAt } from '../domain/physics/trackSurface'
import {
  createCountdownState,
  formatCountdownPhase,
  isControllable,
  tickCountdown,
  type CountdownState,
} from '../domain/race/countdown'
import { TrackSurfaceMeshes } from './TrackSurfaces3D'
import { GateMarkings3D } from './GateMarkings3D'
import { CarRig } from './CarRig'
import { GhostRig } from './GhostRig'
import { ChaseCamera } from './ChaseCamera'
import { TopDownCamera } from './TopDownCamera'
import { TrackScenery } from './TrackScenery'
import { SceneLighting } from './SceneLighting'
import { SceneEnvironment } from './SceneEnvironment'
import { SceneAssetsProvider } from './SceneAssets'
import { LeaderboardPanel } from './LeaderboardPanel'

interface LiveStats {
  mph: number
  elevation: number
  throttle: number
  brake: number
}

const INITIAL_STATS: LiveStats = { mph: 0, elevation: 0, throttle: 0, brake: 0 }
/** How often (in fixed ticks) the stats HUD re-renders - matches the lap-timer display's throttling so this doesn't add its own re-render churn. */
const STATS_UPDATE_EVERY_N_TICKS = 6

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
  const trackCenter = useMemo(() => {
    const { centerline } = generated
    return centerline.reduce(
      (acc, p) => ({ x: acc.x + p.x / centerline.length, z: acc.z + p.z / centerline.length }),
      { x: 0, z: 0 },
    )
  }, [generated])
  const inputRef = useKeyboardCarInput()
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase')
  const [countdown, setCountdown] = useState<CountdownState>(createCountdownState)
  const [resetToken, setResetToken] = useState(0)

  const startHeadingRad = degToRad(generated.spawn.headingDeg)
  const carStateRef = useRef<CarState>(
    createInitialCarState(generated.spawn.position.x, generated.spawn.position.z, startHeadingRad),
  )

  const {
    liveLapSeconds,
    lastLapSeconds,
    bestLapSeconds,
    ghostInputLog,
    handleTick: sessionHandleTick,
    resetAttempt,
  } = useRaceSession(doc, generated)

  const [liveStats, setLiveStats] = useState<LiveStats>(INITIAL_STATS)

  const handleTick = (state: CarState, tickIndex: number, input: CarInput) => {
    sessionHandleTick(state, tickIndex, input)
    if (tickIndex % STATS_UPDATE_EVERY_N_TICKS === 0) {
      setLiveStats({
        mph: unitsPerSecondToMph(state.speed),
        elevation: elevationAt(state, generated),
        throttle: input.throttle,
        brake: input.brake,
      })
    }
  }

  const controllable = isControllable(countdown.phase)

  const handleRestart = () => {
    carStateRef.current = createInitialCarState(generated.spawn.position.x, generated.spawn.position.z, startHeadingRad)
    setResetToken((t) => t + 1)
    resetAttempt()
    setLiveStats(INITIAL_STATS)
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
      <div className="stats-hud" data-testid="stats-hud">
        <span className="stats-speed" data-testid="speed-display">
          {Math.round(liveStats.mph)} <small>mph</small>
        </span>
        <span data-testid="elevation-display">Elevation: {liveStats.elevation.toFixed(1)}m</span>
        <div className="stats-pedal" data-testid="throttle-stat">
          <span>Accel</span>
          <div className="stats-pedal-track">
            <div
              className="stats-pedal-fill stats-pedal-fill--throttle"
              style={{ width: `${Math.round(liveStats.throttle * 100)}%` }}
            />
          </div>
        </div>
        <div className="stats-pedal" data-testid="brake-stat">
          <span>Brake</span>
          <div className="stats-pedal-track">
            <div
              className="stats-pedal-fill stats-pedal-fill--brake"
              style={{ width: `${Math.round(liveStats.brake * 100)}%` }}
            />
          </div>
        </div>
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
      <Canvas
        data-testid="race-canvas"
        camera={{ fov: 60 }}
        shadows="soft"
        // r3f already defaults toneMapping to ACESFilmic and outputColorSpace to sRGB; both are
        // set explicitly here so the scene's look doesn't silently change with a library default.
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.68 }}
      >
        {/* Dev-only frame-rate readout, used to hold the scene to its 60fps budget. */}
        {import.meta.env.DEV && <Stats />}
        <SceneAssetsProvider>
          <SceneEnvironment />
          <SceneLighting center={trackCenter} targetRef={carStateRef} />
          <TrackScenery centerline={generated.centerline} groundY={generated.groundY} />
          <TrackSurfaceMeshes surfaces={generated} />
          <GateMarkings3D
            startLineTrigger={generated.startLineTrigger}
            checkpointTriggers={generated.checkpointTriggers}
          />
        </SceneAssetsProvider>
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

import { useEffect, useState } from 'react'
import type { CarInput } from '../domain/physics/carPhysics'
import { fetchLeaderboard, submitLapTime, type LeaderboardEntry } from '../api/client'
import { getDisplayName, setDisplayName as persistDisplayName } from '../domain/session/anonymousSession'

function formatLapTicks(ticks: number): string {
  const seconds = ticks / 60
  const minutes = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2).padStart(5, '0')
  return `${minutes}:${secs}`
}

interface LeaderboardPanelProps {
  trackId: string | null
  bestLapInputLog: CarInput[]
  hasBestLap: boolean
}

export function LeaderboardPanel({ trackId, bestLapInputLog, hasBestLap }: LeaderboardPanelProps) {
  const [displayName, setDisplayNameState] = useState(() => getDisplayName())
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle')

  const refresh = () => {
    if (!trackId) return
    fetchLeaderboard(trackId).then(setEntries).catch(() => {})
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId])

  if (!trackId) {
    return (
      <div className="leaderboard-panel" data-testid="leaderboard-panel">
        <p>Share this track to unlock its leaderboard.</p>
      </div>
    )
  }

  return (
    <div className="leaderboard-panel" data-testid="leaderboard-panel">
      <div className="leaderboard-submit">
        <input
          type="text"
          data-testid="display-name-input"
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => {
            setDisplayNameState(e.target.value)
            persistDisplayName(e.target.value)
          }}
        />
        <button
          type="button"
          data-testid="submit-lap-button"
          disabled={!hasBestLap || status === 'submitting'}
          onClick={() => {
            setStatus('submitting')
            submitLapTime(trackId, displayName.trim(), bestLapInputLog)
              .then((res) => {
                setStatus(res.accepted ? 'submitted' : 'error')
                if (res.accepted) refresh()
              })
              .catch(() => setStatus('error'))
          }}
        >
          Submit best lap
        </button>
        {status === 'submitted' && <span data-testid="submit-status">Submitted!</span>}
        {status === 'error' && <span data-testid="submit-status">Submission failed.</span>}
      </div>
      <ol className="leaderboard-list" data-testid="leaderboard-list">
        {entries.map((e, i) => (
          <li key={i}>
            {e.displayName} — {formatLapTicks(e.timeTicks)}
          </li>
        ))}
      </ol>
    </div>
  )
}

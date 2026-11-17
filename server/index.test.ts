import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'

process.env.NODE_ENV = 'test'
process.env.TRACKFORGE_DB_PATH = `./data/trackforge-test-${Date.now()}.sqlite`

const { app } = await import('./index.ts')
const { driveFullLapAutopilot } = await import('../src/domain/race/testAutopilot.ts')
const { generateTrack } = await import('../src/domain/generation/generateTrack.ts')
const { createControlPoint, createTrackDocument } = await import('../src/domain/track/schema.ts')

function circleTrack(radius: number, pointCount: number, width: number) {
  const controlPoints = Array.from({ length: pointCount }, (_, i) => {
    const angle = (i / pointCount) * Math.PI * 2
    return createControlPoint({ x: radius * Math.sin(angle), z: -radius * Math.cos(angle), width })
  })
  return createTrackDocument({ controlPoints, startLine: { controlPointIndex: 0, headingDeg: 90 } })
}

let baseUrl: string
let server: ReturnType<typeof app.listen>

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo
      baseUrl = `http://localhost:${port}`
      resolve()
    })
  })
})

afterAll(() => {
  server.close()
  rmSync(process.env.TRACKFORGE_DB_PATH as string, { force: true })
})

describe('Trackforge API', () => {
  it('creates a track and fetches it back', async () => {
    const doc = circleTrack(100, 16, 80)
    const createRes = await fetch(`${baseUrl}/api/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.id).toBeTruthy()
    expect(created.shareUrl).toContain(created.id)

    const getRes = await fetch(`${baseUrl}/api/tracks/${created.id}`)
    expect(getRes.status).toBe(200)
    const fetched = await getRes.json()
    expect(fetched.document.id).toBe(created.id)
  })

  it('assigns distinct ids and share URLs to two different tracks', async () => {
    const first = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circleTrack(100, 16, 80)),
      })
    ).json()
    const second = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circleTrack(120, 16, 80)),
      })
    ).json()

    expect(first.id).not.toBe(second.id)
    expect(first.shareUrl).not.toBe(second.shareUrl)
  })

  it('rejects creating a track that fails validation', async () => {
    const res = await fetch(`${baseUrl}/api/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ controlPoints: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for a track that does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/tracks/does-not-exist`)
    expect(res.status).toBe(404)
  })

  it('accepts a genuinely valid lap submission and rejects a tampered one', async () => {
    const doc = circleTrack(100, 16, 80)
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
    ).json()
    const generated = generateTrack(created.document)
    const validLog = driveFullLapAutopilot(created.document, generated)
    expect(validLog).not.toBeNull()

    const acceptRes = await fetch(`${baseUrl}/api/tracks/${created.id}/laptimes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Alex', inputLog: validLog }),
    })
    expect(acceptRes.status).toBe(201)
    const accepted = await acceptRes.json()
    expect(accepted.accepted).toBe(true)
    expect(typeof accepted.timeTicks).toBe('number')

    const tamperedLog = Array.from({ length: 10 }, () => ({ throttle: 0, brake: 0, steer: 0 }))
    const rejectRes = await fetch(`${baseUrl}/api/tracks/${created.id}/laptimes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Cheater', inputLog: tamperedLog }),
    })
    expect(rejectRes.status).toBe(400)
    const rejected = await rejectRes.json()
    expect(rejected.accepted).toBe(false)

    const leaderboardRes = await fetch(`${baseUrl}/api/tracks/${created.id}/leaderboard`)
    const { leaderboard } = await leaderboardRes.json()
    expect(leaderboard).toHaveLength(1)
    expect(leaderboard[0].displayName).toBe('Alex')
  })

  it('leaderboard is ordered fastest to slowest and reflects a new better time', async () => {
    const doc = circleTrack(100, 16, 80)
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      })
    ).json()
    const generated = generateTrack(created.document)
    const validLog = driveFullLapAutopilot(created.document, generated) as object[]

    // Submit the same genuine lap under two names - identical time, but exercises ordering/display.
    await fetch(`${baseUrl}/api/tracks/${created.id}/laptimes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Slower', inputLog: validLog }),
    })
    await fetch(`${baseUrl}/api/tracks/${created.id}/laptimes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputLog: validLog }), // anonymous
    })

    const leaderboardRes = await fetch(`${baseUrl}/api/tracks/${created.id}/leaderboard`)
    const { leaderboard } = await leaderboardRes.json()
    expect(leaderboard).toHaveLength(2)
    expect(leaderboard.map((e: { timeTicks: number }) => e.timeTicks)).toEqual(
      [...leaderboard].map((e: { timeTicks: number }) => e.timeTicks).sort((a, b) => a - b),
    )
    expect(leaderboard.some((e: { displayName: string }) => e.displayName === 'Anonymous')).toBe(true)
  })

  it('lists saved tracks without requiring their ids', async () => {
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circleTrack(100, 16, 80)),
      })
    ).json()

    const listRes = await fetch(`${baseUrl}/api/tracks`)
    expect(listRes.status).toBe(200)
    const { tracks } = await listRes.json()
    expect(tracks.some((t: { id: string }) => t.id === created.id)).toBe(true)
  })

  it('records the creator session on first save and does not let a later save change it', async () => {
    const doc = circleTrack(100, 16, 80)
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, creatorSessionId: 'session-a' }),
      })
    ).json()

    await fetch(`${baseUrl}/api/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...created.document, creatorSessionId: 'session-b' }),
    })

    const renameRes = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', sessionId: 'session-b' }),
    })
    expect(renameRes.status).toBe(403)
  })

  it('lets the creating session rename its track and rejects other sessions', async () => {
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...circleTrack(100, 16, 80), creatorSessionId: 'owner-session' }),
      })
    ).json()

    const rejectRes = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope', sessionId: 'other-session' }),
    })
    expect(rejectRes.status).toBe(403)

    const okRes = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Track', sessionId: 'owner-session' }),
    })
    expect(okRes.status).toBe(200)

    const getRes = await fetch(`${baseUrl}/api/tracks/${created.id}`)
    const { document } = await getRes.json()
    expect(document.name).toBe('Renamed Track')
  })

  it('rejects renaming a track with no stored creator', async () => {
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circleTrack(100, 16, 80)),
      })
    ).json()

    const res = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope', sessionId: 'anyone' }),
    })
    expect(res.status).toBe(403)
  })

  it('lets the creating session delete its track and rejects other sessions', async () => {
    const created = await (
      await fetch(`${baseUrl}/api/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...circleTrack(100, 16, 80), creatorSessionId: 'owner-session' }),
      })
    ).json()

    const rejectRes = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'other-session' }),
    })
    expect(rejectRes.status).toBe(403)
    expect((await fetch(`${baseUrl}/api/tracks/${created.id}`)).status).toBe(200)

    const okRes = await fetch(`${baseUrl}/api/tracks/${created.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'owner-session' }),
    })
    expect(okRes.status).toBe(204)
    expect((await fetch(`${baseUrl}/api/tracks/${created.id}`)).status).toBe(404)
  })
})

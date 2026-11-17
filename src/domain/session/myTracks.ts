const MY_TRACKS_KEY = 'trackforge:my-track-ids'

function readIds(): string[] {
  return JSON.parse(localStorage.getItem(MY_TRACKS_KEY) ?? '[]')
}

export function recordCreatedTrack(id: string): void {
  const ids = readIds()
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem(MY_TRACKS_KEY, JSON.stringify(ids))
  }
}

export function isMyTrack(id: string): boolean {
  return readIds().includes(id)
}

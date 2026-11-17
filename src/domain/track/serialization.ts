import { TRACK_SCHEMA_VERSION, type TrackDocument } from './schema'

export class UnsupportedSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Cannot load track: unsupported schema version "${String(version)}".`)
  }
}

export function serializeTrack(doc: TrackDocument): string {
  return JSON.stringify(doc, null, 2)
}

export function deserializeTrack(json: string): TrackDocument {
  const parsed = JSON.parse(json) as Partial<TrackDocument>
  if (parsed.schemaVersion !== TRACK_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(parsed.schemaVersion)
  }
  // Schema version 1 only, so far - no migration needed yet. Future versions
  // would branch here on parsed.schemaVersion before returning.
  return parsed as TrackDocument
}

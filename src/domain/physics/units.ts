/** World units are treated as meters for display purposes (speed in mph, elevation in meters). */
const METERS_PER_SECOND_TO_MPH = 2.23694

export function unitsPerSecondToMph(unitsPerSecond: number): number {
  return Math.abs(unitsPerSecond) * METERS_PER_SECOND_TO_MPH
}

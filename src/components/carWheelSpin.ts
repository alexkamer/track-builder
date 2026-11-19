/**
 * Rolling-wheel spin, shared by the live car and the ghost so they cannot drift apart.
 *
 * The spin angle advances by the arc the wheel rolls through: distance travelled divided by
 * wheel radius. The radius comes from the car's own handle rather than a module constant,
 * because car sources ship different wheel sizes and using the wrong one makes the wheels
 * visibly spin too fast or too slow for the road speed - the classic skating artefact.
 */
export function advanceWheelSpin(
  currentSpinRad: number,
  speed: number,
  wheelRadius: number,
  delta: number,
): number {
  // A zero or negative radius would divide by zero; hold the current angle instead of
  // producing NaN and freezing every wheel for the rest of the session.
  if (!(wheelRadius > 0)) return currentSpinRad
  return currentSpinRad + (speed / wheelRadius) * delta
}

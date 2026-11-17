# Spec Delta

## MODIFIED Requirements

### Requirement: Barrier collision response
The system SHALL detect collisions between the car and generated barrier geometry and apply a bounce/slide response that keeps the car from passing through the barrier, resolves the car away from the barrier within a bounded number of ticks, and reduces speed by an amount dependent on impact angle rather than a fixed fraction regardless of angle.

#### Scenario: Car collides with a barrier
- **WHEN** the car's position would cross barrier geometry
- **THEN** the car's velocity and position are adjusted so it does not pass through the barrier, and its speed is reduced according to the collision response

#### Scenario: Shallow-angle graze against a barrier
- **WHEN** the car's heading is nearly parallel to a barrier when it makes contact (a shallow-angle graze) while the player continues to steer/throttle toward the wall
- **THEN** the car retains most of its speed, is redirected away from the wall rather than along it, and does not remain in repeated low-speed contact with the barrier for a prolonged period

#### Scenario: Near head-on collision with a barrier
- **WHEN** the car's heading is close to perpendicular to a barrier when it makes contact
- **THEN** the car loses significantly more speed than a shallow-angle graze would, consistent with a harder impact

#### Scenario: Repeated grazing contact does not stall the car
- **WHEN** the car makes several grazing barrier contacts in quick succession while still holding throttle
- **THEN** the car's speed after each contact does not decay toward a near-stall crawl, because a minimum escape speed is enforced following a collision

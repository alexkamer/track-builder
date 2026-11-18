# Spec Delta

## MODIFIED Requirements

### Requirement: Minimum corner radius validation
The system SHALL validate that every point along the track's curve has a turning radius no smaller than a minimum derived from the car's actual achievable turn radius at full steering lock plus a safety margin, and SHALL report a clear error identifying the violation, including the location of the offending corner, if it does not.

#### Scenario: Track meets minimum radius
- **WHEN** every point along the curve has a turning radius at or above the minimum
- **THEN** minimum corner radius validation passes

#### Scenario: Track violates minimum radius
- **WHEN** any point along the curve has a turning radius below the minimum
- **THEN** validation fails with an error indicating a corner is too tight and identifying which control point the violation is nearest to

#### Scenario: Minimum radius reflects car physics
- **WHEN** the car's physics parameters (maximum speed and turn rate) determine its tightest achievable turn radius at full steering lock
- **THEN** the minimum corner radius validation threshold is at or above that achievable radius, by a margin large enough that a track validated at the threshold is drivable through its tightest corner without constant barrier contact

#### Scenario: Multiple corners violate the minimum radius
- **WHEN** more than one point along the curve has a turning radius below the minimum
- **THEN** validation fails identifying the first violating corner encountered, without requiring the user to inspect the entire curve to find it

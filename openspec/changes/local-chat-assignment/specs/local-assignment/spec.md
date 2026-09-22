## ADDED Requirements

### Requirement: Deterministic bulk assignment
The system SHALL process explicit assignment of all unassigned active stops without a model call or quota consumption.

#### Scenario: Assign to day one
- **WHEN** a user requests all unassigned stops on day one
- **THEN** a confirmation draft SHALL list the stored targets and destination date
- **AND** confirmation SHALL append them after existing destination stops, preserving stored metadata
- **AND** undo SHALL restore the previous trip

### Requirement: Validate scope and dates
The system SHALL clarify ambiguous scope, conflicting dates, missing dates and dates outside the trip without modifying the trip.

#### Scenario: Today differs from day one
- **WHEN** both today and day one are requested and identify different dates
- **THEN** the system SHALL ask for one destination instead of creating a draft

#### Scenario: Stale confirmation
- **WHEN** any snapshotted target is assigned, excluded or removed, or the destination is outside the updated period
- **THEN** the system SHALL reject the complete draft without partial mutation

## ADDED Requirements

### Requirement: Local editing and queries
The system SHALL execute supported explicit commands using stored trip and ledger data before invoking AI, without consuming model quota.

#### Scenario: Edit a named stop
- **WHEN** a unique stored stop and a valid date, duration, time, memo or order are specified
- **THEN** the app SHALL preview the change and require confirmation
- **AND** preserve unrelated stored fields

#### Scenario: Ambiguous or unsupported command
- **WHEN** targets, dates or scope are unclear
- **THEN** the app SHALL clarify rather than mutate or send the edit to AI

### Requirement: Safe confirmation and undo
The system SHALL reject stale or cross-trip drafts and restore the previous state only when the latest applied state still matches.

#### Scenario: Concurrent edit
- **WHEN** the trip or affected ledger changes after preview
- **THEN** confirmation SHALL make no changes and ask for a new request

### Requirement: Grounded reports
The system SHALL report only saved values and distinguish missing information from zero.

#### Scenario: Total duration or costs
- **WHEN** some values are missing
- **THEN** the app SHALL show the known sum and missing count, without claiming a complete total

## MODIFIED Requirements

### Requirement: Playful default suggestions
The system SHALL show playful travel discovery prompts by default at the bottom of the chat.

#### Scenario: Open chat
- **WHEN** no contextual follow-up prompts are present
- **THEN** random destination selection SHALL appear first, followed by food, cafe, photography and relaxed travel prompts

#### Scenario: Chat within a trip
- **WHEN** the trip has a saved region
- **THEN** themed prompts SHALL include that region
- **AND** necessary contextual follow-up choices SHALL remain available

#### Scenario: Follow up on a random destination
- **WHEN** a random destination is selected
- **THEN** suggestions SHALL offer a reroll and food, cafe, photography and relaxed travel for that destination

#### Scenario: Display saved legacy suggestions
- **WHEN** saved messages contain known generic exploration examples
- **THEN** the displayed suggestions SHALL replace those examples with themed travel prompts without deleting history
- **AND** date assignment and place removal clarification choices SHALL remain unchanged

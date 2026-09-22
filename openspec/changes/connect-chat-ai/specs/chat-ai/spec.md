## ADDED Requirements

### Requirement: Real AI routing
Production and development applications SHALL use authenticated ai-chat for questions requiring AI, while local commands and test fixtures retain their existing paths.

#### Scenario: Themed recommendation
- **WHEN** a user asks for a food or cafe course
- **THEN** the app SHALL send the question and bounded conversation context to ai-chat
- **AND** proposed places SHALL pass existing search verification and confirmation before saving

### Requirement: Validated model output
The server and client SHALL validate structured output and discard model supplied coordinates, addresses, arbitrary links and mutation actions.

#### Scenario: Business information
- **WHEN** the model provides business information
- **THEN** a reference response SHALL include an unverified note and controlled map search links

### Requirement: Authenticated bounded calls
The server SHALL reject unauthenticated or oversized requests and return clear model failure codes.

#### Scenario: Quota exhausted
- **WHEN** the model provider returns a quota error
- **THEN** the app SHALL show a quota message without replacing the answer with a fixture

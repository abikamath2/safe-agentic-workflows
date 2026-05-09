# Safety-First Agentic Workflow Demo Guide

This demo showcases how to safely operationalize LLM-generated actions in real-time enterprise systems.

## Architectural Layers

1.  **Controller**: Receives "Source Events" via Webhook (Simulated via the Feed Buttons).
2.  **Brain (Generation)**: Gemini (GPT-4o in the Java version) analyzes the event and proposes tool calls.
3.  **Governance (Validation)**:
    -   **Gate 1 (Contextual Grounding)**: SLM-based verifier model ensures zero hallucinations.
    -   **Gate 2 (Semantic Risk)**: Severity scoring ensures action scale matches incident impact.
    -   **Gate 3 (Policy Engine)**: Deterministic code checks against authoritative data.
4.  **Tool (Execution)**: Final methods that only run if all governance gates pass.

## Demo Scenarios

### Scenario 1: The "Safe" Intervention
-   **Input**: "Shipment #SHP-992 delayed at Singapore Port due to weather. Wait: 5 hours."
-   **AI Action**: `notify_stakeholders`.
-   **Result**: **PASSED**. Correctly identified as low-impact.

### Scenario 2: The "Semantic Hallucination" (Blocked)
-   **Input**: "Minor network disruption... Operations delayed by approximately 2 hours."
-   **AI Action**: `reroute_shipment` via Air Freight.
-   **Result**: **BLOCKED BY GATE 2**. Operation Impact (0.2) too low for High-Risk tool (Reroute).

### Scenario 3: The "Policy Violation" (Blocked)
-   **Input**: "GlobalLogistics bankruptcy... Switch carrier."
-   **AI Action**: `switch_carrier` to an unapproved vendor.
-   **Result**: **BLOCKED BY GATE 3**. Violated deterministic carrier whitelist.

## Technical Implementation (Java)

The code for the Java implementation is located in the `java-reference/` directory.
Key components:
- `SafetyAdvisor.java`: Uses Spring AI's Advisor API to intercept tool requests.
- `ExecutionGovernanceLayer.java`: Orchestrates the validation pipeline.
- `AuditService.java`: Provides observability and trace correlation.
- `LogisticsTools.java`: Demonstrates tool layer abstraction.

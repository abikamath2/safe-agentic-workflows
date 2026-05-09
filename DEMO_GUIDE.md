# Safety-First Agentic Workflow Demo Guide

This demo showcases how to safely operationalize LLM-generated actions in real-time enterprise systems.

## Architectural Layers

1.  **Controller**: Receives "Source Events" via Webhook (Simulated via the Feed Buttons).
2.  **Brain (Generation)**: Gemini (GPT-4o in the Java version) analyzes the event and proposes tool calls.
3.  **Guardrails (Validation)**:
    -   **Gate 1 (Contextual Grounding)**: Uses a verifier model to ensure zero hallucinations.
    -   **Gate 2 (Risk Assessment)**: Heuristic check ensures action scale matches event severity.
    -   **Gate 3 (Policy Enforcement)**: Deterministic code checks against authoritative data.
4.  **Tool (Execution)**: Final methods that only run if all gates pass.

## Demo Scenarios

### Scenario 1: The "Safe" Intervention
-   **Input**: "Shipment #SHP-992 delayed at Singapore Port due to weather. Wait: 5 hours."
-   **AI Action**: `notify_stakeholders`.
-   **Result**: **PASSED**. No high-risk action taken for a minor delay.

### Scenario 2: The "Hallucination" (Blocked)
-   **Input**: "Minor network disruption... Operations delayed by approximately 2 hours."
-   **AI Action**: `reroute_shipment` via Air Freight.
-   **Result**: **BLOCKED BY GATE 2**. The AI incorrectly escalated a minor delay to a critical rerouting incident.

### Scenario 3: The "Unapproved Vendor" (Blocked)
-   **Input**: "GlobalLogistics bankruptcy... Switch carrier."
-   **AI Action**: `switch_carrier` to an unapproved vendor.
-   **Result**: **BLOCKED BY GATE 3**. The action was grounded and severe, but violated deterministic enterprise policy (Carrier white-list).

## Technical Implementation (Java)

The code for the Java implementation is located in the `java-reference/` directory.
Key components:
- `SafetyAdvisor.java`: Uses Spring AI's Advisor API to intercept tool calls.
- `GuardrailService.java`: Orchestrates the validation pipeline.
- `LogisticsTools.java`: Demonstrates `@McpTool` style definitions.

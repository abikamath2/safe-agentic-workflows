import { runGate1Verification } from "./geminiService";

export interface GuardrailResult {
  passed: boolean;
  gate: string;
  details: string;
  severity?: number;
}

export class GuardrailPipeline {
  static async run(sourceEvent: string, action: any): Promise<GuardrailResult[]> {
    const results: GuardrailResult[] = [];

    // --- GATE 1: CONTEXTUAL GROUNDING ---
    const gate1 = await runGate1Verification(sourceEvent, action);
    results.push({
      gate: "GATE 1 - CONTEXTUAL GROUNDING",
      passed: gate1.isGrounded,
      details: gate1.isGrounded 
        ? "Action is correctly grounded in event context." 
        : `Unsupported claims detected: ${gate1.unsupportedClaims.join(", ")}`
    });

    // --- GATE 2: SEVERITY & UNCERTAINTY ---
    // Simple heuristic for demo: check for high-risk tools vs event keywords
    const isHighRisk = ["reroute_shipment", "trigger_emergency_procurement"].includes(action.toolName);
    const mentionsMinor = sourceEvent.toLowerCase().includes("minor") || sourceEvent.toLowerCase().includes("2 hour");
    
    let gate2Passed = true;
    let gate2Details = "Severity matches action scope.";
    
    if (isHighRisk && mentionsMinor) {
      gate2Passed = false;
      gate2Details = "Action severity is disproportionate to 'Minor' event status.";
    }

    if (action.confidence < 0.7) {
      gate2Passed = false;
      gate2Details += " | Low LLM confidence score detected.";
    }

    results.push({
      gate: "GATE 2 - SEVERITY & UNCERTAINTY",
      passed: gate2Passed,
      details: gate2Details,
      severity: isHighRisk ? 0.9 : 0.2
    });

    // --- GATE 3: DETERMINISTIC POLICY ---
    // Simulate lookup in policy database
    const approvedCarriers = ["CARRIER_A", "CARRIER_B", "DEFAULT_SEA"];
    let gate3Passed = true;
    let gate3Details = "Complies with enterprise logistics policy.";

    if (action.toolName === "switch_carrier" && !approvedCarriers.includes(action.arguments.newCarrierId)) {
      gate3Passed = false;
      gate3Details = `Policy Violation: ${action.arguments.newCarrierId} is not an unapproved carrier.`;
    }

    results.push({
      gate: "GATE 3 - DETERMINISTIC POLICY",
      passed: gate3Passed,
      details: gate3Details
    });

    return results;
  }
}

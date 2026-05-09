import { runGate1Verification, getSeverityAnalysis } from "./geminiService";
import { GuardrailDecision, ExecutionDecision } from "../types";

export class ExecutionGovernanceLayer {
  static async evaluate(sourceEvent: string, action: any): Promise<GuardrailDecision[]> {
    const decisions: GuardrailDecision[] = [];

    // --- GATE 1: CONTEXTUAL GROUNDING (SLM) ---
    const gate1 = await runGate1Verification(sourceEvent, action);
    const g1Passed = gate1.decision === "VALID";
    decisions.push({
      gate: "GATE 1 - CONTEXTUAL GROUNDING",
      passed: g1Passed,
      decision: g1Passed ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK,
      details: g1Passed 
        ? "Action is correctly grounded in event context." 
        : `Unsupported claims detected: ${gate1.unsupportedClaims.join(", ")}`,
      unsupportedClaims: gate1.unsupportedClaims
    });

    // --- GATE 2: SEVERITY & RISK CORRELATION ---
    const analysis = await getSeverityAnalysis(sourceEvent);
    const isHighRiskTool = ["reroute_shipment", "trigger_emergency_procurement"].includes(action.toolName);
    
    let gate2Decision = ExecutionDecision.APPROVE;
    let gate2Details = `Severity Correlation: Impact Score ${analysis.impactScore.toFixed(2)} (${analysis.classification}).`;

    if (isHighRiskTool && analysis.impactScore < 0.6) {
      gate2Decision = ExecutionDecision.BLOCK;
      gate2Details = "Action severity is disproportionate to assessed impact score.";
    } else if (action.confidence < 0.75) {
      gate2Decision = ExecutionDecision.ESCALATE;
      gate2Details += " | Low LLM confidence detected. Human review required.";
    }

    decisions.push({
      gate: "GATE 2 - SEVERITY & RISK",
      passed: gate2Decision !== ExecutionDecision.BLOCK,
      decision: gate2Decision,
      details: gate2Details,
      severity: analysis.impactScore
    });

    // --- GATE 3: DETERMINISTIC POLICY ENFORCEMENT ---
    const approvedCarriers = ["CARRIER_A", "CARRIER_B", "DEFAULT_SEA"];
    let gate3Decision = ExecutionDecision.APPROVE;
    let gate3Details = "Complies with enterprise logistics policy.";

    if (action.toolName === "switch_carrier" && !approvedCarriers.includes(action.arguments.newCarrierId)) {
      gate3Decision = ExecutionDecision.BLOCK;
      gate3Details = `Policy Violation: Carrier '${action.arguments.newCarrierId}' is not in approved list.`;
    }

    decisions.push({
      gate: "GATE 3 - DETERMINISTIC POLICY",
      passed: gate3Decision !== ExecutionDecision.BLOCK,
      decision: gate3Decision,
      details: gate3Details
    });

    return decisions;
  }
}

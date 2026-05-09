import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

/**
 * SIMULATED ENTERPRISE AI CONTROL PLANE
 * 
 * In a real production environment, this is a Java/Spring Boot microservice.
 * Here it is implemented in Node to maintain preview functionality while 
 * demonstrating the architectural separation of concerns.
 */

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const MODAL_ID = "gemini-1.5-flash";

export enum ExecutionDecision {
  APPROVE = 'APPROVE',
  BLOCK = 'BLOCK',
  ESCALATE = 'ESCALATE'
}

// -- MODULAR GOVERNANCE AGENTS --

class GroundingVerifier {
  static async verify(eventContent: string, action: any, traceId: string) {
    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    const response = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Zero-Knowledge Grounding Check. TRACE: ${traceId} SOURCE: "${eventContent}" PROPOSAL: "${action.toolName}" Output JSON: { "isGrounded": boolean, "reason": string }` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    try {
      const result = JSON.parse(response.response.text());
      return {
          gate: "CONTEXTUAL_GROUNDING",
          decision: result.isGrounded ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK,
          details: result.isGrounded ? "Intent grounded in event context." : `Grounding Violation: ${result.reason}`
      };
    } catch (e) {
      return { gate: "CONTEXTUAL_GROUNDING", decision: ExecutionDecision.BLOCK, details: "Verification Parse Error" };
    }
  }
}

class SeverityAnalyzer {
  static async analyze(eventContent: string, action: any, traceId: string) {
    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    const response = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Operational Impact Analysis (0.0 - 1.0). EVENT: "${eventContent}" Output JSON: { "impactScore": number, "classification": string }` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      const result = JSON.parse(response.response.text());
      let decision = ExecutionDecision.APPROVE;
      const isHighRiskTool = ["reroute_shipment"].includes(action.toolName);
      
      if (isHighRiskTool && result.impactScore < 0.6) {
          decision = ExecutionDecision.BLOCK;
      } else if (action.confidence < 0.75) {
          decision = ExecutionDecision.ESCALATE;
      }

      return {
          gate: "SEVERITY_ANALYSIS",
          decision: decision,
          details: `Impact Score: ${result.impactScore.toFixed(2)} (${result.classification}). Risk correlation established.`,
          severity: result.impactScore
      };
    } catch (e) {
      return { gate: "SEVERITY_ANALYSIS", decision: ExecutionDecision.ESCALATE, details: "Risk Analysis Error: Escalating for Safety" };
    }
  }
}

class PolicyEngine {
  static check(action: any) {
    const approvedCarriers = ["CARRIER_A", "CARRIER_B"];
    if (action.toolName === "switch_carrier" && !approvedCarriers.includes(action.arguments?.newCarrierId)) {
        return {
            gate: "POLICY_ENFORCEMENT",
            decision: ExecutionDecision.BLOCK,
            details: `Violation: Unauthorized Vendor [${action.arguments?.newCarrierId}]`
        };
    }
    return { gate: "POLICY_ENFORCEMENT", decision: ExecutionDecision.APPROVE, details: "Enterprise Policy Compliant." };
  }
}

// -- MAIN ORCHESTRATOR --

export class ControlPlane {
  static async processEvent(eventContent: string) {
    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    
    // 1. INTENT GENERATION
    const response = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Logistics Orchestrator. Event: "${eventContent}". Propose Tool Directives. Output JSON: { "actions": [{ "toolName": string, "arguments": any, "rationale": string, "confidence": number }] }` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const brain = JSON.parse(response.response.text());
    const processedActions = [];

    for (const proposed of (brain.actions || [])) {
      const traceId = uuidv4();
      const action: any = {
        id: traceId,
        toolName: proposed.toolName,
        arguments: proposed.arguments,
        rationale: proposed.rationale,
        confidence: proposed.confidence || 0.8,
        status: 'PROPOSED',
        guardrailDecisions: []
      };

      // 2. GOVERNANCE LAYER (INTERCEPTION)
      const decisions = [
        await GroundingVerifier.verify(eventContent, action, traceId),
        await SeverityAnalyzer.analyze(eventContent, action, traceId),
        PolicyEngine.check(action)
      ];

      action.guardrailDecisions = decisions;
      const hasBlock = decisions.some(d => d.decision === ExecutionDecision.BLOCK);
      const hasEscalate = decisions.some(d => d.decision === ExecutionDecision.ESCALATE);

      if (hasBlock) action.status = 'DENIED';
      else if (hasEscalate) action.status = 'AWAITING_APPROVAL';
      else action.status = 'APPROVED';

      processedActions.push(action);
    }

    return processedActions;
  }
}

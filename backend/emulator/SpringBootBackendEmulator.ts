import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

/**
 * SIMULATED SPRING BOOT BACKEND
 * 
 * Architecture:
 * - This emulator represents the "Backend AI Control Plane" tier.
 * - In production, this logic is implemented in Java Spring Boot (see /java-reference).
 * - Here it provides the REST/WebSocket responses for the frontend observability layer.
 */

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const MODAL_ID = "gemini-1.5-flash";

export enum ExecutionDecision {
  APPROVE = 'APPROVE',
  BLOCK = 'BLOCK',
  ESCALATE = 'ESCALATE'
}

export class SpringBootBackendEmulator {
  private static events: any[] = [];
  private static actions: any[] = [];
  private static broadcast: (type: string, data: any) => void = () => {};

  static setBroadcastHandler(handler: (type: string, data: any) => void) {
    this.broadcast = handler;
  }

  static getData() {
    return { events: this.events, actions: this.actions };
  }
  
  /**
   * Represents: OrchestrationService.processEvent()
   */
  static async handleEvent(content: string, source: string) {
    const event = { 
        id: uuidv4(), 
        timestamp: new Date().toISOString(), 
        source: source || "Inbound Telemetry", 
        content, 
        status: 'PENDING' 
    };
    this.events.push(event);
    this.broadcast("event:new", event);

    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    
    try {
        // 1. GENERATE INTENT (Intelligence Tier)
        const response = await genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Act as Logistics AI Control Plane. Event: "${content}". Propose actions. Output JSON: { "actions": [{ "toolName": string, "arguments": any, "rationale": string, "confidence": number }] }` }] }],
          generationConfig: { responseMimeType: "application/json" }
        });
        
        const brain = JSON.parse(response.response.text());

        for (const proposed of (brain.actions || [])) {
          const traceId = uuidv4();
          
          // 2. GOVERNANCE INTERCEPTION
          const decisions = await this.evaluateGovernance(content, proposed, traceId);
          
          const hasBlock = decisions.some(d => d.decision === ExecutionDecision.BLOCK);
          const hasEscalate = decisions.some(d => d.decision === ExecutionDecision.ESCALATE);

          const action = {
            id: traceId,
            eventId: event.id,
            ...proposed,
            guardrailDecisions: decisions,
            status: hasBlock ? 'DENIED' : (hasEscalate ? 'AWAITING_APPROVAL' : 'APPROVED'),
            finalDecision: hasBlock ? ExecutionDecision.BLOCK : (hasEscalate ? ExecutionDecision.ESCALATE : ExecutionDecision.APPROVE)
          };

          this.actions.push(action);
          this.broadcast("action:update", action);

          // 3. WORKFLOW STATE MACHINE (Intelligence Tier owns transitions)
          if (action.status === 'APPROVED') {
            this.scheduleExecution(action.id);
          }
        }
    } catch (e) {
        console.error("Upstream Workflow Error:", e);
    }

    return event;
  }

  static async handleDecision(actionId: string, decision: 'APPROVE' | 'DENIED') {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) return null;

    // INTELLIGENCE TIER DECIDES
    action.status = decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
    action.finalDecision = decision === 'APPROVE' ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK;
    
    this.broadcast("action:update", action);
    
    if (action.status === 'APPROVED') {
        this.scheduleExecution(action.id);
    }

    return action;
  }

  private static scheduleExecution(actionId: string) {
    // Backend owns the delay/execution logic
    setTimeout(() => {
        const action = this.actions.find(a => a.id === actionId);
        if (action && action.status === 'APPROVED') {
            action.status = 'EXECUTED';
            this.broadcast("action:update", action);
        }
    }, 2000);
  }

  /**
   * Represents: ExecutionGovernanceLayer.java
   */
  private static async evaluateGovernance(eventContent: string, action: any, traceId: string) {
    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    const results = [];

    // GATE 1: GROUNDING (AI verification)
    const g1Response = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Verify if "${action.toolName}" is grounded in "${eventContent}". Output JSON: { "ok": boolean, "reason": string }` }] }],
        generationConfig: { responseMimeType: "application/json" }
    });
    const g1 = JSON.parse(g1Response.response.text());
    results.push({
        gate: "GROUNDING",
        decision: g1.ok ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK,
        details: g1.reason
    });

    // GATE 2: RISK (Deterministic Policy)
    const approvedCarriers = ["CARRIER_A", "CARRIER_B"];
    if (action.toolName === "switch_carrier" && !approvedCarriers.includes(action.arguments?.newCarrierId)) {
        results.push({
            gate: "POLICY",
            decision: ExecutionDecision.BLOCK,
            details: `Unauthorized Carrier: ${action.arguments?.newCarrierId}`
        });
    } else {
        results.push({ gate: "POLICY", decision: ExecutionDecision.APPROVE, details: "Verified Policy Compliance" });
    }

    return results;
  }
}

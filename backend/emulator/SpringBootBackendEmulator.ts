import { v4 as uuidv4 } from "uuid";

/**
 * TIER 3: MOCK BACKEND (Spring Boot Emulator)
 * 
 * ROLE:
 * - Deterministic simulator for the Java Intelligence Tier.
 * - Returns hardcoded "Mock" responses for UI walkthroughs.
 * - NO AI reasoning, prompts, or dynamic orchestration.
 * - STRICTLY MOCK - used for demo support only.
 */

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
   * Represents inbound event processing in the Java Control Plane
   */
  static async handleEvent(content: string, source: string) {
    const event = { 
        id: uuidv4(), 
        timestamp: new Date().toISOString(), 
        source: source || "Mock Inbound", 
        content, 
        status: 'PENDING' 
    };
    this.events.push(event);
    this.broadcast("event:new", event);

    // Simulate Backend Thinking Latency
    setTimeout(async () => {
        const mockProposals = this.getMockProposalsForContent(content, event.id);
        
        for (const action of mockProposals) {
            this.actions.push(action);
            this.broadcast("action:update", action);

            // Simulation of Backend Workflow (Automatic execution if state machine allows)
            if (action.status === 'APPROVED') {
                this.scheduleExecution(action.id);
            }
        }
    }, 1000);

    return event;
  }

  /**
   * MOCK SCENARIO GENERATOR
   * Instead of AI, return pre-defined enterprise scenarios
   */
  private static getMockProposalsForContent(content: string, eventId: string) {
    const normalized = content.toLowerCase();
    
    // Scenario 1: Natural Disaster / Redirect (High Risk)
    if (normalized.includes("weather") || normalized.includes("delays") || normalized.includes("reroute")) {
        return [{
            id: uuidv4(),
            eventId,
            toolName: "reroute_shipment",
            arguments: { shipmentId: "SHIP-992", targetHub: "HUB-ATL-4" },
            rationale: "Automated routing logic detected corridor blockage due to weather notification.",
            confidence: 0.94,
            status: "APPROVED", // Auto-approved by simulated policy
            guardrailDecisions: [
                { gate: "GROUNDING", decision: ExecutionDecision.APPROVE, details: "Verified weather telemetry matches coordinates." },
                { gate: "POLICY", decision: ExecutionDecision.APPROVE, details: "Scenario fits 'Weather Contingency' authorized playbook." }
            ]
        }];
    }

    // Scenario 2: Unauthorized Carrier (Governance Block)
    if (normalized.includes("carrier") || normalized.includes("switch")) {
        return [{
            id: uuidv4(),
            eventId,
            toolName: "switch_carrier",
            arguments: { carrierId: "VENDOR_UNKNOWN_99" },
            rationale: "Proposed optimization for cost reduction.",
            confidence: 0.81,
            status: "DENIED",
            finalDecision: ExecutionDecision.BLOCK,
            guardrailDecisions: [
                { gate: "POLICY", decision: ExecutionDecision.BLOCK, details: "Violation: VENDOR_UNKNOWN_99 is not in the Tier-1 Approved Vendor List." }
            ]
        }];
    }

    // Default: Stakeholder Notification (Low Risk)
    return [{
        id: uuidv4(),
        eventId,
        toolName: "notify_stakeholders",
        arguments: { priority: "MEDIUM", message: "Standard operational update processed." },
        rationale: "Maintaining transparency across supply chain partners.",
        confidence: 0.99,
        status: "APPROVED",
        guardrailDecisions: [
            { gate: "GROUNDING", decision: ExecutionDecision.APPROVE, details: "Logistics data verified." },
            { gate: "POLICY", decision: ExecutionDecision.APPROVE, details: "Standard notification protocol followed." }
        ]
    }];
  }

  static async handleDecision(actionId: string, decision: 'APPROVE' | 'DENIED') {
    const action = this.actions.find(a => a.id === actionId);
    if (!action) return null;

    // Simulate backend processing of human authorization
    action.status = decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
    action.finalDecision = decision === 'APPROVE' ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK;
    
    this.broadcast("action:update", action);
    
    if (action.status === 'APPROVED') {
        this.scheduleExecution(action.id);
    }

    return action;
  }

  private static scheduleExecution(actionId: string) {
    // Simulated Backend Execution Cycle (2.0s latency)
    setTimeout(() => {
        const action = this.actions.find(a => a.id === actionId);
        if (action && action.status === 'APPROVED') {
            action.status = 'EXECUTED';
            this.broadcast("action:update", action);
        }
    }, 2000);
  }
}

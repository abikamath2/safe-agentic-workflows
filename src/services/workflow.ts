import { getBrainResponse } from "./geminiService";
import { ExecutionGovernanceLayer } from "./guardrails";
import { LogisticsEvent, Action, ExecutionDecision } from "../types";
import { v4 as uuidv4 } from "uuid";

export const processEventWorkflow = async (event: LogisticsEvent, onUpdate: (action: Action) => void) => {
  try {
    // 1. Brain Layer: Generation
    const brainOutput = await getBrainResponse(event.content);
    
    for (const proposed of brainOutput.proposedActions) {
      const action: Action = {
        id: uuidv4(),
        eventId: event.id,
        toolName: proposed.toolName,
        arguments: proposed.arguments,
        rationale: proposed.rationale,
        confidence: proposed.confidence,
        guardrailDecisions: [],
        status: 'PROPOSED',
        finalDecision: ExecutionDecision.APPROVE
      };

      onUpdate(action);

      // 2. Execution Governance Layer
      const decisions = await ExecutionGovernanceLayer.evaluate(event.content, action);
      action.guardrailDecisions = decisions;
      
      const hasBlock = decisions.some(d => d.decision === ExecutionDecision.BLOCK);
      const hasEscalate = decisions.some(d => d.decision === ExecutionDecision.ESCALATE);

      if (hasBlock) {
        action.status = 'DENIED';
        action.finalDecision = ExecutionDecision.BLOCK;
      } else if (hasEscalate) {
        action.status = 'AWAITING_APPROVAL';
        action.finalDecision = ExecutionDecision.ESCALATE;
      } else {
        action.status = 'APPROVED';
        action.finalDecision = ExecutionDecision.APPROVE;
      }
      
      onUpdate(action);

      // 3. Tool Layer: Execution (Mock)
      if (action.status === 'APPROVED') {
        await new Promise(r => setTimeout(r, 1000));
        action.status = 'EXECUTED';
        onUpdate(action);
      }
    }
  } catch (error) {
    console.error("Workflow Error:", error);
  }
};

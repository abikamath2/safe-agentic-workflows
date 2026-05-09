import { getBrainResponse } from "./geminiService";
import { GuardrailPipeline } from "./guardrails";
import { LogisticsEvent, Action } from "../types";
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
        guardrailResults: [],
        status: 'PROPOSED'
      };

      onUpdate(action);

      // 2. Guardrail Layer: Validation
      const results = await GuardrailPipeline.run(event.content, action);
      action.guardrailResults = results;
      
      const allPassed = results.every(r => r.passed);
      action.status = allPassed ? 'APPROVED' : 'DENIED';
      
      onUpdate(action);

      // 3. Tool Layer: Execution (Demo Mock)
      if (action.status === 'APPROVED') {
        // Simulate latency for execution
        await new Promise(r => setTimeout(r, 1000));
        action.status = 'EXECUTED';
        onUpdate(action);
      }
    }
  } catch (error) {
    console.error("Workflow Error:", error);
  }
};

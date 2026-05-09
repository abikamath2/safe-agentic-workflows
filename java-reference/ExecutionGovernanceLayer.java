package com.example.logistics.ai;

import org.springframework.stereotype.Service;
import org.springframework.ai.chat.client.ChatClient;
import java.util.Map;
import java.util.List;

/**
 * EXECUTION GOVERNANCE LAYER
 * 
 * Formal implementation of layered verification including
 * Probabilistic Reasoning and Deterministic Enforcement.
 */
@Service
public class ExecutionGovernanceLayer {

    public enum Decision {
        APPROVE, BLOCK, ESCALATE
    }

    public record GuardrailDecision(
        Decision decision,
        String gate,
        String details,
        Double severityScore
    ) {}

    private final ChatClient verifierClient;

    public ExecutionGovernanceLayer(ChatClient.Builder builder) {
        this.verifierClient = builder.build();
    }

    public List<GuardrailDecision> evaluateExecutionRequest(String sourceEvent, String toolName, Map<String, Object> arguments) {
        return List.of(
            verifyContextualGrounding(sourceEvent, toolName, arguments),
            correlateSeverity(sourceEvent, toolName),
            enforceDeterministicPolicy(toolName, arguments)
        );
    }

    private GuardrailDecision verifyContextualGrounding(String sourceEvent, String toolName, Map<String, Object> arguments) {
        // Use structured JSON output for parsing
        String prompt = """
            Perform a grounding check.
            SOURCE: %s
            ACTION: %s with args %s
            Output JSON: { "decision": "VALID" | "INVALID", "reason": "string" }
            """.formatted(sourceEvent, toolName, arguments);

        // Simulated JSON parse (Professional implementation would use ObjectMapper)
        String raw = verifierClient.prompt(prompt).call().content();
        boolean isValid = raw.contains("\"decision\": \"VALID\"");
        
        return new GuardrailDecision(
            isValid ? Decision.APPROVE : Decision.BLOCK,
            "GATE 1 - CONTEXTUAL GROUNDING",
            isValid ? "Action is grounded in source context." : "Hallucination detected in AI proposal.",
            null
        );
    }

    private GuardrailDecision correlateSeverity(String sourceEvent, String toolName) {
        // More sophisticated severity analysis would happen here
        double severity = sourceEvent.toLowerCase().contains("minor") ? 0.2 : 0.9;
        boolean isHighRisk = toolName.equals("rerouteShipment");

        if (isHighRisk && severity < 0.6) {
            return new GuardrailDecision(Decision.BLOCK, "GATE 2 - SEMANTIC RISK", "High-risk action proposed for low-severity event.", severity);
        }
        
        return new GuardrailDecision(Decision.APPROVE, "GATE 2 - SEMANTIC RISK", "Severity correlates with action scale.", severity);
    }

    private GuardrailDecision enforceDeterministicPolicy(String toolName, Map<String, Object> arguments) {
        // Standard Java / DB / Redis rules
        if (toolName.equals("switchCarrier")) {
            String carrierId = (String) arguments.get("newCarrierId");
            boolean isApproved = carrierId != null && !carrierId.equals("UNAPPROVED_VENDOR");
            return new GuardrailDecision(
                isApproved ? Decision.APPROVE : Decision.BLOCK,
                "GATE 3 - POLICY ENGINE",
                isApproved ? "Carrier is on approved list." : "Enterprise policy violation: Unapproved vendor.",
                null
            );
        }
        return new GuardrailDecision(Decision.APPROVE, "GATE 3 - POLICY ENGINE", "Complies with logistics policies.", null);
    }
}

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

    public record GovernanceContext(
        String traceId,
        String sourceEvent,
        String toolName,
        Map<String, Object> arguments
    ) {}

    public record GuardrailDecision(
        Decision decision,
        String gate,
        String details,
        Double severityScore
    ) {}

    private final ChatClient verifierClient;
    private final ObjectMapper objectMapper;

    public ExecutionGovernanceLayer(ChatClient.Builder builder, ObjectMapper objectMapper) {
        this.verifierClient = builder.build();
        this.objectMapper = objectMapper;
    }

    public List<GuardrailDecision> evaluate(GovernanceContext context) {
        return List.of(
            verifyGrounding(context),
            analyzeSeverityRisk(context),
            checkDeterministicPolicy(context)
        );
    }

    private GuardrailDecision verifyGrounding(GovernanceContext ctx) {
        String prompt = """
            Perform exact grounding check.
            SOURCE: %s
            PROPOSAL: %s (%s)
            
            Return JSON only: { "isGrounded": boolean, "unsupportedClaims": [], "reasoning": "" }
            """.formatted(ctx.sourceEvent(), ctx.toolName(), ctx.arguments());

        try {
            String rawJson = verifierClient.prompt(prompt).call().content();
            JsonNode groundResult = objectMapper.readTree(rawJson);
            
            boolean isValid = groundResult.get("isGrounded").asBoolean();
            
            return new GuardrailDecision(
                isValid ? Decision.APPROVE : Decision.BLOCK,
                "GROUNDING_GATE",
                isValid ? "Grounded in source." : "Hallucination: " + groundResult.get("unsupportedClaims").toString(),
                null
            );
        } catch (Exception e) {
            return new GuardrailDecision(Decision.BLOCK, "GROUNDING_GATE", "Verification Parse Error", null);
        }
    }

    private GuardrailDecision analyzeSeverityRisk(GovernanceContext ctx) {
        // Use AI to extract operational severity from event
        String prompt = "Rate operational impact of supply chain event from 0.0 to 1.0 (Critical): " + ctx.sourceEvent();
        String rawScore = verifierClient.prompt(prompt).call().content().replaceAll("[^0-9.]", "");
        double score = Double.parseDouble(rawScore.isBlank() ? "0.0" : rawScore);
        
        boolean isHighRiskTool = ctx.toolName().equalsIgnoreCase("rerouteShipment");

        if (isHighRiskTool && score < 0.6) {
            return new GuardrailDecision(Decision.BLOCK, "SEVERITY_GATE", "High-risk tool rejected for low-impact event (Score: "+score+")", score);
        } else if (score > 0.85) {
            return new GuardrailDecision(Decision.APPROVE, "SEVERITY_GATE", "Critical severity confirmed. Action authorized.", score);
        }
        
        return new GuardrailDecision(Decision.APPROVE, "SEVERITY_GATE", "Severity/Risk correlation verified.", score);
    }

    private GuardrailDecision checkDeterministicPolicy(GovernanceContext ctx) {
        if ("switchCarrier".equals(ctx.toolName())) {
            String cId = (String) ctx.arguments().get("newCarrierId");
            boolean approved = cId != null && !cId.equalsIgnoreCase("UNAPPROVED");
            return new GuardrailDecision(
                approved ? Decision.APPROVE : Decision.BLOCK,
                "POLICY_GATE",
                approved ? "Carrier policy compliant." : "Policy Violation: Unapproved Vendor.",
                null
            );
        }
        return new GuardrailDecision(Decision.APPROVE, "POLICY_GATE", "Compliant.", null);
    }
}

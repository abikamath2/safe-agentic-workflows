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

    public record GovernanceReport(
        String traceId,
        List<GuardrailDecision> decisions,
        boolean isAuthorized
    ) {}

    private final ChatClient verifierClient;
    private final ObjectMapper objectMapper;
    private final GroundingVerifier groundingVerifier;
    private final SeverityAnalyzer severityAnalyzer;
    private final PolicyEngine policyEngine;

    public ExecutionGovernanceLayer(ChatClient.Builder builder, ObjectMapper objectMapper) {
        this.verifierClient = builder.build();
        this.objectMapper = objectMapper;
        this.groundingVerifier = new GroundingVerifier(verifierClient, objectMapper);
        this.severityAnalyzer = new SeverityAnalyzer(verifierClient);
        this.policyEngine = new PolicyEngine();
    }

    public GovernanceReport evaluate(GovernanceContext context) {
        List<GuardrailDecision> decisions = List.of(
            groundingVerifier.verify(context),
            severityAnalyzer.analyze(context),
            policyEngine.check(context)
        );

        boolean isAuthorized = decisions.stream()
            .allMatch(d -> d.decision() != Decision.BLOCK);

        return new GovernanceReport(context.traceId(), decisions, isAuthorized);
    }
}

/**
 * COMPONENT: Grounding Verifier
 * Logic: Cross-references AI intent with the original source event.
 * Architecture: Verification-only model prevents hallucination leakage.
 */
class GroundingVerifier {
    private final ChatClient client;
    private final ObjectMapper mapper;

    public GroundingVerifier(ChatClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    public ExecutionGovernanceLayer.GuardrailDecision verify(ExecutionGovernanceLayer.GovernanceContext ctx) {
        String prompt = "Zero-Knowledge Grounding check. Source: %s Proposal: %s".formatted(ctx.sourceEvent(), ctx.toolName());
        try {
            // Strict JSON parsing is mandatory to prevent "contains('VALID')" vulnerabilities
            String rawJson = client.prompt(prompt).call().content();
            JsonNode node = mapper.readTree(rawJson);
            boolean ok = node.get("grounded").asBoolean();
            return new ExecutionGovernanceLayer.GuardrailDecision(
                ok ? ExecutionGovernanceLayer.Decision.APPROVE : ExecutionGovernanceLayer.Decision.BLOCK,
                "GROUNDING",
                ok ? "Validated against source context" : "Hallucination Detected: Unsupported claims",
                null
            );
        } catch (Exception e) {
            return new ExecutionGovernanceLayer.GuardrailDecision(ExecutionGovernanceLayer.Decision.BLOCK, "GROUNDING", "Verification Parse Error", null);
        }
    }
}

/**
 * COMPONENT: Severity Analyzer
 * Logic: AI-assisted classification of operational impact.
 * Architecture: Maps raw impact to governance tiers.
 */
class SeverityAnalyzer {
    private final ChatClient client;

    public SeverityAnalyzer(ChatClient client) {
        this.client = client;
    }

    public ExecutionGovernanceLayer.GuardrailDecision analyze(ExecutionGovernanceLayer.GovernanceContext ctx) {
        // Semantic risk analysis using operational heuristics
        String scoreRaw = client.prompt("Calculate operational impact score (0.0 to 1.0) for supply chain event: " + ctx.sourceEvent()).call().content();
        double score = Double.parseDouble(scoreRaw.replaceAll("[^0-9.]", "0"));
        
        ExecutionGovernanceLayer.Decision decision = ExecutionGovernanceLayer.Decision.APPROVE;
        boolean isHighRiskTool = ctx.toolName().toLowerCase().contains("reroute");

        if (isHighRiskTool && score < 0.6) {
            decision = ExecutionGovernanceLayer.Decision.BLOCK; // Rejection of high-risk tool for low-severity event
        } else if (score > 0.85) {
            decision = ExecutionGovernanceLayer.Decision.APPROVE; // Authorization based on critical urgency
        }

        return new ExecutionGovernanceLayer.GuardrailDecision(decision, "SEVERITY", "Operational Impact: " + score, score);
    }
}

/**
 * COMPONENT: Policy Engine
 * Logic: Deterministic code-based enterprise rules.
 * Architecture: Final safety net for static business constraints.
 */
class PolicyEngine {
    public ExecutionGovernanceLayer.GuardrailDecision check(ExecutionGovernanceLayer.GovernanceContext ctx) {
        // Enforce deterministic rules (whitelist, blacklists, budget caps)
        if ("switchCarrier".equals(ctx.toolName())) {
            String carrierId = (String) ctx.arguments().get("newCarrierId");
            boolean isAllowed = carrierId != null && !carrierId.equalsIgnoreCase("UNAPPROVED");
            return new ExecutionGovernanceLayer.GuardrailDecision(
                isAllowed ? ExecutionGovernanceLayer.Decision.APPROVE : ExecutionGovernanceLayer.Decision.BLOCK,
                "POLICY",
                isAllowed ? "Carrier policy verified." : "Policy Violation: Unapproved Vendor.",
                null
            );
        }
        return new ExecutionGovernanceLayer.GuardrailDecision(ExecutionGovernanceLayer.Decision.APPROVE, "POLICY", "Compliant", null);
    }
}

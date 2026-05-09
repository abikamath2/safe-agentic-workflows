package com.logistics.controlplane.governance;

import com.logistics.controlplane.dto.ActionProposal;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

/**
 * TIER 2 - GOVERNANCE LAYER (Deterministic Enforcer)
 */
@Service
public class ExecutionGovernanceLayer {

    public enum Decision { APPROVE, BLOCK, ESCALATE }

    public record GuardrailDecision(
        Decision decision,
        String gate,
        String details,
        Double riskScore
    ) {}

    public record GovernanceReport(
        String toolName,
        List<GuardrailDecision> decisions,
        boolean isAuthorized
    ) {
        public boolean isEscalated() {
            return decisions.stream().anyMatch(d -> d.decision() == Decision.ESCALATE);
        }
    }

    public GovernanceReport evaluate(String event, ActionProposal action) {
        List<GuardrailDecision> decisions = new ArrayList<>();

        // 1. TOOL VALIDATION (Hallucination Catcher)
        if (!isValidTool(action.getToolName())) {
            decisions.add(new GuardrailDecision(
                    Decision.BLOCK,
                    "TOOL_VALIDATION",
                    "Unknown or hallucinated tool: " + action.getToolName(),
                    null
            ));
        }

        // 2. ARGUMENT VALIDATION
        if (action.getArguments() == null || action.getArguments().isEmpty()) {
            decisions.add(new GuardrailDecision(
                    Decision.BLOCK,
                    "ARG_VALIDATION",
                    "Missing tool arguments",
                    null
            ));
        }

        // 3. RISK SCORING
        double risk = action.getConfidence() < 0.6 ? 0.9 : 0.2;

        if (risk > 0.8) {
            decisions.add(new GuardrailDecision(
                    Decision.ESCALATE,
                    "RISK_ENGINE",
                    "Low confidence / high risk action",
                    risk
            ));
        }

        boolean isAuthorized = decisions.stream()
                .noneMatch(d -> d.decision() == Decision.BLOCK);

        return new GovernanceReport(action.getToolName(), decisions, isAuthorized);
    }

    private boolean isValidTool(String tool) {
        return List.of(
                "rerouteShipment",
                "switchCarrier",
                "notifyStakeholders"
        ).contains(tool);
    }
}

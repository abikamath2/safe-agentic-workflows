package com.example.logistics.ai;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.client.advisor.api.CallAroundAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAroundAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.AdvisorContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.example.logistics.ai.ExecutionGovernanceLayer.Decision;

/**
 * PRODUCTION GUARDRAIL ADVISOR
 * 
 * Intercepts AI tool calls before they are executed.
 * This satisfies the requirement of separating Generation from Execution.
 */
@Component
public class SafetyAdvisor implements CallAroundAdvisor {

    private static final Logger log = LoggerFactory.getLogger(SafetyAdvisor.class);
    private final ExecutionGovernanceLayer governanceLayer;
    private final AuditService auditService;

    public SafetyAdvisor(ExecutionGovernanceLayer governanceLayer, AuditService auditService) {
        this.governanceLayer = governanceLayer;
        this.auditService = auditService;
    }

    @Override
    public ChatResponse aroundCall(AdvisorContext context, CallAroundAdvisorChain chain) {
        // --- 1. PRE-GENERATION ---
        // Add tracing metadata to the context
        String correlationId = UUID.randomUUID().toString();
        context.getAdviseContext().put("X-Logistics-Trace-ID", correlationId);

        // --- 2. GENERATION PHASE ---
        ChatResponse response = chain.next(context);

        // --- 3. POST-GENERATION / PRE-EXECUTION INTERCEPTION ---
        var toolCalls = response.getResult().getOutput().getToolCalls();
        if (toolCalls == null || toolCalls.isEmpty()) {
            return response;
        }

        for (var toolCall : toolCalls) {
            String sourceEvent = (String) context.getAdviseContext().get("SOURCE_EVENT");
            
            var govCtx = new ExecutionGovernanceLayer.GovernanceContext(
                correlationId, sourceEvent, toolCall.name(), toolCall.arguments()
            );

            // ANALYZE: Evaluate the request through the governance layer
            var decisions = governanceLayer.evaluate(govCtx);
            Decision aggregateDecision = aggregate(decisions);
            
            // AUDIT: Link traceId for cross-service replayability
            auditService.record(correlationId, toolCall.name(), toolCall.arguments(), aggregateDecision.name(), decisions.toString());

            if (aggregateDecision == Decision.BLOCK) {
                log.error("GOVERNANCE BLOCK | Trace: {} | Gate: {}", correlationId, toolCall.name());
                
                // Return structured governance rejection metadata
                return ChatResponse.builder()
                    .from(response)
                    .metadata("X-Governance-Decision", "BLOCK")
                    .metadata("X-Governance-Trace", correlationId)
                    .metadata("X-Governance-Reason", decisions.stream()
                        .filter(d -> d.decision() == Decision.BLOCK)
                        .findFirst().map(d -> d.details()).orElse("Policy Block"))
                    .build();
            }

            if (aggregateDecision == Decision.ESCALATE) {
                log.warn("GOVERNANCE ESCALATION | Trace: {}", correlationId);
                return ChatResponse.builder()
                    .from(response)
                    .metadata("X-Governance-Decision", "ESCALATE")
                    .metadata("X-Governance-Trace", correlationId)
                    .build();
            }
        }

        return response;
    }

    private Decision aggregate(List<ExecutionGovernanceLayer.GuardrailDecision> decisions) {
        if (decisions.stream().anyMatch(d -> d.decision() == Decision.BLOCK)) return Decision.BLOCK;
        if (decisions.stream().anyMatch(d -> d.decision() == Decision.ESCALATE)) return Decision.ESCALATE;
        return Decision.APPROVE;
    }

    @Override
    public String getName() {
        return "LogisticsSafetyAdvisor";
    }

    @Override
    public int getOrder() {
        return 0;
    }
}

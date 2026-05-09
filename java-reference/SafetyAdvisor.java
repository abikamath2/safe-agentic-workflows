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
            
            // ANALYZE: Evaluate the request through the governance layer
            var decisions = governanceLayer.evaluateExecutionRequest(sourceEvent, toolCall.name(), toolCall.arguments());

            Decision aggregateDecision = aggregate(decisions);
            
            // AUDIT: Every proposal must be recorded regardless of outcome
            auditService.record(
                toolCall.name(), 
                toolCall.arguments(), 
                aggregateDecision.name(), 
                decisions.toString()
            );

            if (aggregateDecision == Decision.BLOCK) {
                log.error("GOVERNANCE BLOCK | Trace: {} | Tool: {}", correlationId, toolCall.name());
                
                // ARCHITECTURAL SHIFT: Instead of crashing, we return a structural explanation.
                // This ensures the AI's "inner monologue" stays consistent with world rules.
                // In a real framework, we'd replace the tool result with a 'PERMISSION_DENIED' status.
                return ChatResponse.builder()
                    .from(response)
                    .metadata("X-Logistics-Decision", "BLOCK")
                    .metadata("X-Logistics-Reason", "Safety Policy Violation")
                    .build();
            }

            if (aggregateDecision == Decision.ESCALATE) {
                log.warn("GOVERNANCE ESCALATION | Trace: {} | Tool: {}", correlationId, toolCall.name());
                
                // Trigger external Human-In-The-Loop flow
                return ChatResponse.builder()
                    .from(response)
                    .metadata("X-Logistics-Decision", "ESCALATE")
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

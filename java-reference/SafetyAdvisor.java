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

/**
 * PRODUCTION GUARDRAIL ADVISOR
 * 
 * Intercepts AI tool calls before they are executed.
 * This satisfies the requirement of separating Generation from Execution.
 */
@Component
public class SafetyAdvisor implements CallAroundAdvisor {

    private final GuardrailService guardrailService;

    public SafetyAdvisor(GuardrailService guardrailService) {
        this.guardrailService = guardrailService;
    }

    @Override
    public ChatResponse aroundCall(AdvisorContext context, CallAroundAdvisorChain chain) {
        // 1. Let the LLM generate the response/tool calls
        ChatResponse response = chain.next(context);

        // 2. Identify Tool Calls
        var toolCalls = response.getResult().getOutput().getToolCalls();
        if (toolCalls == null || toolCalls.isEmpty()) {
            return response;
        }

        // 3. SECURE INTERCEPTION: Pass tool calls through the guardrail pipeline
        for (var toolCall : toolCalls) {
            String toolName = toolCall.name();
            Map<String, Object> arguments = toolCall.arguments();
            
            // Extract the original user message from context (Grounding Source)
            String sourceEvent = (String) context.getAdviseContext().get("SOURCE_EVENT");

            boolean isSafe = guardrailService.validateAction(sourceEvent, toolName, arguments);

            if (!isSafe) {
                // BLOCK EXECUTION: Throw an exception to stop tool execution
                // In a production system, you might revert the chat state or ask for clarification
                throw new SecurityException("Safety Guardrail Blocked Action: " + toolName);
            }
        }

        return response;
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

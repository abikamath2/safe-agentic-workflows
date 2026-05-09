package com.example.logistics.ai;

import org.springframework.stereotype.Service;
import org.springframework.ai.chat.client.ChatClient;
import java.util.Map;

@Service
public class GuardrailService {

    private final ChatClient verifierClient; // Using a smaller model/SLM for verification

    public GuardrailService(ChatClient.Builder builder) {
        this.verifierClient = builder.build();
    }

    public boolean validateAction(String sourceEvent, String toolName, Map<String, Object> arguments) {
        // GATE 1: CONTEXTUAL GROUNDING (SLM)
        boolean isGrounded = verifyContextualGrounding(sourceEvent, toolName, arguments);
        if (!isGrounded) return false;

        // GATE 2: SEVERITY CHECK (Deterministic / Semantic)
        boolean isSeverityAppropriate = checkSeverity(sourceEvent, toolName);
        if (!isSeverityAppropriate) return false;

        // GATE 3: DETERMINISTIC POLICY ENFORCEMENT
        return checkEnterprisePolicy(toolName, arguments);
    }

    private boolean verifyContextualGrounding(String sourceEvent, String toolName, Map<String, Object> arguments) {
        String verificationPrompt = """
            Verify if the proposed action is grounded in the source event.
            SOURCE: %s
            ACTION: %s with args %s
            Respond with VALID or INVALID.
            """.formatted(sourceEvent, toolName, arguments);

        String result = verifierClient.prompt(verificationPrompt).call().content();
        return result.contains("VALID");
    }

    private boolean checkSeverity(String sourceEvent, String toolName) {
        // High-risk tools require High-severity events
        boolean isHighRisk = toolName.equals("rerouteShipment") || toolName.equals("triggerEmergencyProcurement");
        boolean isLowSeverityEvent = sourceEvent.toLowerCase().contains("minor");

        return !(isHighRisk && isLowSeverityEvent);
    }

    private boolean checkEnterprisePolicy(String toolName, Map<String, Object> arguments) {
        // Use standard Java logic / DB checks here
        if (toolName.equals("switchCarrier")) {
            String carrierId = (String) arguments.get("newCarrierId");
            return isApprovedCarrier(carrierId);
        }
        return true;
    }

    private boolean isApprovedCarrier(String carrierId) {
        // Mock DB check
        return !carrierId.equals("UNAPPROVED_VENDOR");
    }
}

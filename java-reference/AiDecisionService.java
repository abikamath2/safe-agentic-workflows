package com.logistics.controlplane.ai;

import com.logistics.controlplane.dto.ActionProposal;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * AI INTELLIGENCE TIER
 * 
 * Owns prompt engineering, model selection, and intent extraction.
 * No UI logic allowed here.
 */
@Service
public class AiDecisionService {

    private final ChatClient chatClient;

    public AiDecisionService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    /**
     * TIER 3 - INTELLIGENCE GENERATION
     * 
     * Uses Generative AI to extract intent and propose tool directives.
     */
    public List<ActionProposal> generateDirectives(String eventContent) {
        String prompt = """
        You are a Logistics AI Agent.
        Process the following event:
        %s

        Propose 1-3 actions using available tools (rerouteShipment, switchCarrier, notifyStakeholders).
        Some proposals may be high-risk or incorrect; the governance layer will perform the safety check.

        Output ONLY valid JSON:
        {
          "actions": [
            {
              "toolName": string,
              "arguments": object,
              "rationale": string,
              "confidence": number
            }
          ]
        }
        """.formatted(eventContent);

        String raw = chatClient.prompt(prompt)
                .call()
                .content();

        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(raw);
            List<ActionProposal> result = new ArrayList<>();

            for (JsonNode a : node.get("actions")) {
                ActionProposal ap = new ActionProposal();
                ap.setToolName(a.get("toolName").asText());
                ap.setArguments(mapper.convertValue(a.get("arguments"), Map.class));
                ap.setRationale(a.get("rationale").asText());
                ap.setConfidence(a.get("confidence").asDouble());
                result.add(ap);
            }
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Hallucination or format error detected in Intelligence Tier response", e);
        }
    }
}

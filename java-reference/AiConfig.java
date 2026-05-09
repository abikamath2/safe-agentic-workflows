package com.logistics.controlplane.config;

import org.springframework.ai.openai.OpenAiChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * BACKEND INFRASTRUCTURE CONFIGURATION
 * 
 * Configures the connection to the LLM Intelligence Tier (OpenAI/Gemini).
 */
@Configuration
public class AiConfig {

    @Value("${spring.ai.openai.api-key}")
    private String apiKey;

    @Bean
    public OpenAiChatClient chatClient() {
        return OpenAiChatClient.builder()
                .apiKey(apiKey)
                .build();
    }
}

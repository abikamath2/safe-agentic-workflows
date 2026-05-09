package com.logistics.controlplane.service;

import com.logistics.controlplane.ai.AiDecisionService;
import com.logistics.controlplane.governance.ExecutionGovernanceLayer;
import com.logistics.controlplane.dto.LogisticsEvent;
import com.logistics.controlplane.dto.ActionProposal;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
public class OrchestrationService {

    private final AiDecisionService aiService;
    private final ExecutionGovernanceLayer governanceLayer;
    private final AuditService auditService;

    public OrchestrationService(AiDecisionService aiService, 
                                ExecutionGovernanceLayer governanceLayer,
                                AuditService auditService) {
        this.aiService = aiService;
        this.governanceLayer = governanceLayer;
        this.auditService = auditService;
    }

    public List<ActionProposal> processEvent(LogisticsEvent event) {
        String correlationId = UUID.randomUUID().toString();
        
        // 1. GENERATE INTENT (AI Orchestrator)
        List<ActionProposal> proposals = aiService.generateDirectives(event.getContent());

        for (ActionProposal action : proposals) {
            // 2. GOVERN_EXECUTION (Interception)
            var report = governanceLayer.evaluate(
                new GovernanceContext(correlationId, event.getContent(), action.getToolName(), action.getArguments())
            );

            action.setGovernanceReport(report);
            
            // 3. AUDIT_TRAIL (Compliance)
            auditService.record(correlationId, action, report);
            
            if (report.isAuthorized()) {
                // Auto-execute if valid, or move to execution queue
                executeTool(action);
            }
        }
        
        return proposals;
    }

    private void executeTool(ActionProposal action) {
        // Logic for triggering MCP Tool Layer
    }

    public void handleHumanInTheLoop(String actionId, boolean approve) {
        // Human authorization logic
    }
}

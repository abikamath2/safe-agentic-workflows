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

    private final AiDecisionService ai;
    private final ExecutionGovernanceLayer governance;

    public OrchestrationService(AiDecisionService ai,
                                ExecutionGovernanceLayer governance) {
        this.ai = ai;
        this.governance = governance;
    }

    /**
     * MASTER ORCHESTRATION WORKFLOW
     * 
     * AI generates -> Governance validates -> Orchestrator executes or blocks.
     */
    public List<ActionProposal> processEvent(String event) {
        List<ActionProposal> proposals = ai.generateDirectives(event);

        for (ActionProposal p : proposals) {
            GovernanceReport report = governance.evaluate(event, p);
            p.setGovernanceReport(report);

            if (!report.isAuthorized()) {
                p.setStatus("BLOCKED");
            } else {
                // If it's ESCALATE, we wait for human authorization
                if (report.isEscalated()) {
                    p.setStatus("AWAITING_APPROVAL");
                } else {
                    p.setStatus("APPROVED");
                }
            }
        }
        return proposals;
    }
}

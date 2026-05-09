package com.logistics.controlplane.controller;

import com.logistics.controlplane.service.OrchestrationService;
import com.logistics.controlplane.dto.LogisticsEvent;
import com.logistics.controlplane.dto.ActionProposal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/control-plane")
public class ControlPlaneController {

    private final OrchestrationService orchestrationService;

    public ControlPlaneController(OrchestrationService orchestrationService) {
        this.orchestrationService = orchestrationService;
    }

    @PostMapping("/events")
    public List<ActionProposal> ingestEvent(@RequestBody LogisticsEvent event) {
        // Intelligence Tier handles the full workflow
        return orchestrationService.processEvent(event);
    }

    @PostMapping("/actions/{id}/authorize")
    public void authorizeAction(@PathVariable String id, @RequestParam boolean approve) {
        orchestrationService.handleHumanInTheLoop(id, approve);
    }
}

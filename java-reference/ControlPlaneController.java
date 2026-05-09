package com.logistics.controlplane.controller;

import com.logistics.controlplane.service.OrchestrationService;
import com.logistics.controlplane.dto.LogisticsEvent;
import com.logistics.controlplane.dto.ActionProposal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ControlPlaneController {

    private final OrchestrationService orchestration;

    public ControlPlaneController(OrchestrationService orchestration) {
        this.orchestration = orchestration;
    }

    /**
     * INBOUND EVENT GATEWAY
     */
    @PostMapping("/events")
    public List<ActionProposal> handle(@RequestBody String event) {
        return orchestration.processEvent(event);
    }
}

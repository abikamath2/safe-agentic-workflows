package com.example.logistics.ai;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * TOOL EXECUTION LAYER (MCP Compatible)
 * 
 * These methods are ONLY called if the SafetyAdvisor allows the flow.
 * They represent deterministic enterprise system operations.
 */
@Component
public class LogisticsTools {
    private static final Logger log = LoggerFactory.getLogger(LogisticsTools.class);

    @Tool(description = "Reroute a shipment to a new destination hub")
    public String rerouteShipment(String shipmentId, String destinationHubId) {
        log.info("EXECUTING: Rerouting {} to {}", shipmentId, destinationHubId);
        return "Shipment " + shipmentId + " rerouted to " + destinationHubId + " successfully.";
    }

    @Tool(description = "Switch carrier for an existing shipment")
    public String switchCarrier(String shipmentId, String newCarrierId) {
        log.info("EXECUTING: Switching {} to carrier {}", shipmentId, newCarrierId);
        return "Carrier switched to " + newCarrierId + " for shipment " + shipmentId;
    }

    @Tool(description = "Notify stakeholders about supply chain events")
    public String notifyStakeholders(String message, String priority) {
        log.info("EXECUTING: Notification sent - {} [Priority: {}]", message, priority);
        return "Notification broadcasted.";
    }
}

package com.example.logistics.ai;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * TOOL LAYER
 * 
 * Only executes after SafetyAdvisor approval.
 */
@Service
public class LogisticsTools {

    private static final Logger log = LoggerFactory.getLogger(LogisticsTools.class);

    @Tool(description = "Reroute a shipment to a new destination or mode")
    public String rerouteShipment(String shipmentId, String newRoute, String mode, String reason) {
        log.info("EXECUTING: Rerouting {} to {} via {} due to {}", shipmentId, newRoute, mode, reason);
        // Real logic would update Postgres/ERP here
        return "SUCCESS: Shipment " + shipmentId + " rerouted.";
    }

    @Tool(description = "Switch current shipment carrier to a new approved vendor")
    public String switchCarrier(String shipmentId, String newCarrierId, String reason) {
        log.info("EXECUTING: Switching carrier for {} to {} - Reason: {}", shipmentId, newCarrierId, reason);
        return "SUCCESS: Carrier updated for " + shipmentId;
    }

    @Tool(description = "Trigger an emergency procurement flow for critical stock")
    public String triggerEmergencyProcurement(String sku, Integer quantity, String reason) {
        log.info("EXECUTING: Emergency procurement for {} units of {} - Reason: {}", quantity, sku, reason);
        return "SUCCESS: Procurement flow initiated.";
    }
}

package com.logistics.controlplane.dto;

import java.util.Map;

public class ActionProposal {
    private String id;
    private String toolName;
    private Map<String, Object> arguments;
    private String rationale;
    private double confidence;
    private GovernanceReport governanceReport;
    private String status;

    // Getters and Setters omitted for brevity
}

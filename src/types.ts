export interface LogisticsEvent {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

export enum ExecutionDecision {
  APPROVE = 'APPROVE',
  BLOCK = 'BLOCK',
  ESCALATE = 'ESCALATE'
}

export interface GuardrailDecision {
  passed: boolean;
  gate: string;
  details: string;
  decision: ExecutionDecision;
  severity?: number;
  unsupportedClaims?: string[];
}

export interface Action {
  id: string;
  eventId: string;
  toolName: string;
  arguments: any;
  rationale: string;
  confidence: number;
  guardrailDecisions: GuardrailDecision[];
  status: 'PROPOSED' | 'APPROVED' | 'DENIED' | 'EXECUTED' | 'AWAITING_APPROVAL';
  finalDecision: ExecutionDecision;
}

export interface WorkflowState {
  currentEvent: LogisticsEvent | null;
  proposedActions: Action[];
  isProcessing: boolean;
}

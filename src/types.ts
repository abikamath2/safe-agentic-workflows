export interface LogisticsEvent {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

export interface GuardrailResult {
  passed: boolean;
  gate: string;
  details: string;
  severity?: number;
}

export interface Action {
  id: string;
  eventId: string;
  toolName: string;
  arguments: any;
  rationale: string;
  confidence: number;
  guardrailResults: GuardrailResult[];
  status: 'PROPOSED' | 'APPROVED' | 'DENIED' | 'EXECUTED';
}

export interface WorkflowState {
  currentEvent: LogisticsEvent | null;
  proposedActions: Action[];
  isProcessing: boolean;
}

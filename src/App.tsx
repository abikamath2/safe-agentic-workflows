import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Package, 
  AlertCircle, 
  ChevronRight,
  Terminal,
  Cpu,
  Database,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LogisticsEvent, Action, GuardrailDecision, ExecutionDecision } from './types';
import { processEventWorkflow } from './services/workflow';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const socket = io();

export default function App() {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [activeTab, setActiveTab] = useState('monitor');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initial data fetch
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        setEvents(data.events);
        setActions(data.actions);
      });

    // Real-time updates
    socket.on('event:new', (event: LogisticsEvent) => {
      setEvents(prev => [event, ...prev]);
      handleNewEvent(event);
    });

    return () => {
      socket.off('event:new');
    };
  }, []);

  const handleNewEvent = useCallback(async (event: LogisticsEvent) => {
    setIsProcessing(true);
    await processEventWorkflow(event, (updatedAction) => {
      setActions(prev => {
        const index = prev.findIndex(a => a.id === updatedAction.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updatedAction;
          return next;
        }
        return [updatedAction, ...prev];
      });
    });
    setIsProcessing(false);
  }, []);

  // Mock a webhook call for the demo
  const triggerDemoEvent = (scenario: 'safe' | 'hallucination' | 'policy') => {
    let content = "";
    if (scenario === 'safe') {
      content = "Shipment #SHP-992 (Priority) delayed at Singapore Port due to weather. Estimated wait: 5 hours. Advise status update.";
    } else if (scenario === 'hallucination') {
      content = "Minor network disruption reported at Singapore port terminals. Operations delayed by approximately 2 hours.";
    } else if (scenario === 'policy') {
      content = "Carrier 'GlobalLogistics' has filed for bankruptcy. All shipments in transit need immediate carrier switch.";
    }

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, source: "Manual Demo Trigger" })
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#e1e1e3] font-sans selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-[#1f1f23] bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center border border-primary/30">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight uppercase">Safety-First Agentic Workflow</h1>
              <p className="text-[10px] text-[#8e9299] uppercase tracking-widest font-mono">Logistics Enterprise AI Core</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-[11px] font-mono uppercase text-[#8e9299]">
            <div className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isProcessing ? "bg-amber-500" : "bg-emerald-500")} />
              <span>Status: {isProcessing ? 'Processing Workflow' : 'System Ready'}</span>
            </div>
            <Separator orientation="vertical" className="h-4 bg-[#1f1f23]" />
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>Events: {events.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        
        {/* Left Column: Event Stream & Controls */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="bg-[#111114] border-[#1f1f23] shadow-none">
            <CardHeader className="pb-3 border-b border-[#1f1f23]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#8e9299]" />
                  Event Feed
                </CardTitle>
                <div className="flex gap-1">
                   <Button variant="outline" size="icon" className="h-7 w-7 border-[#1f1f23]" onClick={() => triggerDemoEvent('safe')} title="Safe Event">S</Button>
                   <Button variant="outline" size="icon" className="h-7 w-7 border-[#1f1f23]" onClick={() => triggerDemoEvent('hallucination')} title="Hallucination Trigger">H</Button>
                   <Button variant="outline" size="icon" className="h-7 w-7 border-[#1f1f23]" onClick={() => triggerDemoEvent('policy')} title="Policy Trigger">P</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-4 space-y-4">
                  <AnimatePresence initial={false}>
                    {events.map((event) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group relative p-3 rounded-lg border border-[#1f1f23] hover:border-[#2f2f35] transition-colors bg-[#151518]"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono text-[#5a5d63] uppercase">{new Date(event.timestamp).toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[9px] uppercase border-[#2f2f35]">
                            {event.source}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-[#c1c3c7]">
                          {event.content}
                        </p>
                      </motion.div>
                    ))}
                    {events.length === 0 && (
                      <div className="text-center py-12 text-[#5a5d63] text-xs font-mono">
                        WAITING FOR INCOMING WEBHOOKS...
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Workflow Visualization */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-[#111114] border border-[#1f1f23] h-10 p-1">
              <TabsTrigger value="monitor" className="text-[10px] uppercase tracking-widest px-6 data-[state=active]:bg-[#1f1f23]">
                Workflow Execution
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-[10px] uppercase tracking-widest px-6 data-[state=active]:bg-[#1f1f23]">
                Audit Logs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="monitor" className="mt-6">
              <div className="space-y-6">
                <AnimatePresence>
                  {actions.map((action) => (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    >
                      <ActionCard action={action} />
                    </motion.div>
                  ))}
                  {actions.length === 0 && (
                    <Card className="bg-[#111114] border-dashed border-[#1f1f23] py-24 flex flex-col items-center justify-center text-[#5a5d63]">
                      <Cpu className="w-8 h-8 mb-4 opacity-50" />
                      <p className="text-xs uppercase tracking-widest font-mono">Idle: Awaiting AI Logic Chain</p>
                    </Card>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>

            <TabsContent value="audit">
              {/* Audit logs would go here - simplified for demo */}
              <Card className="bg-[#111114] border-[#1f1f23] font-mono">
                <CardContent className="p-4 text-[10px] space-y-1">
                  {actions.map(a => (
                    <div key={a.id} className="text-[#8e9299]">
                      [{new Date().toISOString()}] ACTION_{a.status}: {a.toolName} ({a.id}) - CONFIDENCE: {a.confidence}
                    </div>
                  ))}
                  {actions.length === 0 && <div className="text-[#5a5d63]">No audit records found.</div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function ActionCard({ action }: { action: Action }) {
  const isPending = action.guardrailDecisions.length === 0;

  return (
    <div className="relative">
      <Card className="bg-[#111114] border-[#1f1f23] shadow-lg overflow-hidden">
        {/* Progress bar for visualization */}
        {isPending && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary w-full animate-progress-indefinite" />
        )}
        
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded border",
                action.status === 'EXECUTED' ? "bg-emerald-500/10 border-emerald-500/20" : 
                action.status === 'DENIED' ? "bg-rose-500/10 border-rose-500/20" :
                action.status === 'AWAITING_APPROVAL' ? "bg-amber-500/10 border-amber-500/20" :
                "bg-blue-500/10 border-blue-500/20"
              )}>
                <Package className={cn(
                  "w-4 h-4",
                  action.status === 'EXECUTED' ? "text-emerald-500" : 
                  action.status === 'DENIED' ? "text-rose-500" :
                  action.status === 'AWAITING_APPROVAL' ? "text-amber-500" :
                  "text-blue-500"
                )} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
                  <span className="text-[#8e9299]">Decision:</span> {action.toolName}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                   <Badge variant="secondary" className="text-[9px] h-4 bg-[#1f1f23] border-none text-[#c1c3c7]">PROBABILISTIC REASONING</Badge>
                   <span className="text-[10px] font-mono text-[#5a5d63]">Conf: {(action.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <StatusBadge status={action.status} />
            </div>
          </div>
          
          <p className="text-xs text-[#8e9299] italic pl-11">
            "{action.rationale}"
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <div className="pl-11 pr-4">
            <div className="p-3 bg-[#0a0a0b] rounded-md border border-[#1f1f23] font-mono text-[11px] text-emerald-400">
              <span className="text-[#5a5d63] mr-2">Arguments:</span>
              {JSON.stringify(action.arguments, null, 2)}
            </div>
          </div>

          <Separator className="bg-[#1f1f23]" />

          <div className="pl-11 space-y-3 pb-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#8e9299] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" />
                Execution Governance Layer
              </div>
              <span className="text-[9px] opacity-50">DETERMINISTIC ENFORCEMENT</span>
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <GateIndicator 
                label="GROUNDING (SLM)" 
                result={action.guardrailDecisions[0]} 
                icon={Database}
              />
              <GateIndicator 
                label="SEMANTIC RISK" 
                result={action.guardrailDecisions[1]} 
                icon={Activity}
              />
              <GateIndicator 
                label="POLICY ENGINE" 
                result={action.guardrailDecisions[2]} 
                icon={ShieldCheck}
              />
            </div>

            {action.status === 'AWAITING_APPROVAL' && (
              <Alert className="bg-amber-500/10 border-amber-500/20 mt-4">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-xs font-bold text-amber-500 uppercase">Human-in-the-loop Required</AlertTitle>
                <AlertDescription className="text-[11px] text-amber-500/80">
                  Uncertainty detection triggered. Manual review required before execution can proceed in production environment.
                </AlertDescription>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700">APPROVE ACTION</Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] border-rose-500/50 text-rose-500">REJECT</Button>
                </div>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GateIndicator({ label, result, icon: Icon }: { label: string, result?: GuardrailDecision, icon: any }) {
  if (!result) {
    return (
      <div className="p-3 rounded border border-[#1f1f23] bg-[#0d0d0f] opacity-50 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[9px] font-bold text-[#5a5d63]">
          <Icon className="w-3 h-3" />
          {label}
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <Clock className="w-3 h-3 animate-spin text-[#8e9299]" />
          <span className="text-[9px] font-mono uppercase">Evaluating...</span>
        </div>
      </div>
    );
  }

  const isEscalated = result.decision === ExecutionDecision.ESCALATE;
  const isBlocked = result.decision === ExecutionDecision.BLOCK;

  return (
    <div className={cn(
      "p-3 rounded border flex flex-col gap-2 relative group overflow-hidden",
      isBlocked ? "bg-rose-500/5 border-rose-500/20" : 
      isEscalated ? "bg-amber-500/5 border-amber-500/20" :
      "bg-emerald-500/5 border-emerald-500/20"
    )}>
      <div className={cn(
        "flex items-center gap-2 text-[9px] font-bold",
        isBlocked ? "text-rose-500" : isEscalated ? "text-amber-500" : "text-emerald-500"
      )}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      
      <p className="text-[10px] leading-tight text-[#8e9299] mt-1 line-clamp-2 italic">
        {result.details}
      </p>

      <div className="flex items-center gap-1.5 mt-auto">
        {isBlocked ? (
           <XCircle className="w-3 h-3 text-rose-500" />
        ) : isEscalated ? (
           <AlertCircle className="w-3 h-3 text-amber-500" />
        ) : (
           <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        )}
        <span className={cn(
          "text-[9px] font-bold uppercase",
          isBlocked ? "text-rose-500" : isEscalated ? "text-amber-500" : "text-emerald-500"
        )}>
          {result.decision}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PROPOSED: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold', label: 'ANALYZING' },
    APPROVED: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold', label: 'VALIDATED' },
    AWAITING_APPROVAL: { color: 'bg-amber-500/20 text-amber-500 border-amber-500/30 font-bold', label: 'ESCALATED' },
    DENIED: { color: 'bg-rose-500/20 text-rose-500 border-rose-500/30 font-bold', label: 'BLOCKED' },
    EXECUTED: { color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]', label: 'EXECUTED' },
  };

  const { color, label } = config[status as keyof typeof config] || config.PROPOSED;

  return (
    <Badge className={cn("px-2 py-0 h-6 text-[10px] tracking-widest border font-mono uppercase", color)}>
      {label}
    </Badge>
  );
}

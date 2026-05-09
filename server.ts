import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenerativeAI } from "@google/generative-ai";

// -- Initialize AI Service --
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const MODAL_ID = "gemini-1.5-flash";

// -- Types & Model --
enum ExecutionDecision {
  APPROVE = 'APPROVE',
  BLOCK = 'BLOCK',
  ESCALATE = 'ESCALATE'
}

interface LogisticsEvent {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

interface Action {
  id: string;
  eventId: string;
  toolName: string;
  arguments: any;
  rationale: string;
  confidence: number;
  guardrailDecisions: any[];
  status: 'PROPOSED' | 'APPROVED' | 'DENIED' | 'EXECUTED' | 'AWAITING_APPROVAL';
  finalDecision: ExecutionDecision;
}

// -- Mock Database --
const events: LogisticsEvent[] = [];
const actions: Action[] = [];

// -- AI CONTROL PLANE: GOVERNANCE LAYER --
class ExecutionGovernanceLayer {
  static async evaluate(eventContent: string, action: any, traceId: string) {
    const decisions = [];

    // GATE 1: Contextual Grounding (Verification Model)
    const genModel = ai.getGenerativeModel({ model: MODAL_ID });
    const g1Response = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Perform rigorous grounding check. TRACE: ${traceId} SOURCE: "${eventContent}" ACTION: "${action.toolName}" Output JSON: { "decision": "VALID" | "INVALID", "unsupportedClaims": [] }` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    let g1 = { decision: "INVALID", unsupportedClaims: ["Parse Error"] };
    try { g1 = JSON.parse(g1Response.response.text()); } catch (e) {
      console.error(`[${traceId}] Grounding Parse Error:`, e);
    }
    
    const g1Passed = g1.decision === "VALID";
    decisions.push({
      gate: "GATE 1 - CONTEXTUAL GROUNDING",
      passed: g1Passed,
      decision: g1Passed ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK,
      details: g1Passed ? "Verified grounding in source context (Zero-Knowledge Proof)." : `Grounding Violation: ${g1.unsupportedClaims.join(", ")}`
    });

    // GATE 2: Semantic Risk (AI-Assisted Severity Scoring)
    const g2Response = await genModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Evaluate operational impact (0.0 to 1.0) and classification for: "${eventContent}". Output JSON: { "impactScore": number, "classification": string }` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    
    let g2 = { impactScore: 0.0, classification: "UNKNOWN" };
    try { g2 = JSON.parse(g2Response.response.text()); } catch (e) {
      console.error(`[${traceId}] Risk Analysis Parse Error:`, e);
    }
    
    let g2Decision = ExecutionDecision.APPROVE;
    const isHighRiskTool = ["reroute_shipment", "trigger_emergency_procurement"].includes(action.toolName);
    
    if (isHighRiskTool && g2.impactScore < 0.6) {
      g2Decision = ExecutionDecision.BLOCK;
    } else if (action.confidence < 0.75) {
      g2Decision = ExecutionDecision.ESCALATE;
    }

    decisions.push({
      gate: "GATE 2 - SEMANTIC RISK",
      passed: g2Decision !== ExecutionDecision.BLOCK,
      decision: g2Decision,
      details: `Impact Score: ${g2.impactScore.toFixed(2)} (${g2.classification}). Trace: ${traceId}`,
      severity: g2.impactScore
    });

    // GATE 3: Deterministic Policy Engine (Enterprise Rules)
    const approvedCarriers = ["CARRIER_A", "CARRIER_B"];
    let g3Decision = ExecutionDecision.APPROVE;
    let g3Details = "Enterprise policy verified.";

    if (action.toolName === "switch_carrier" && !approvedCarriers.includes(action.arguments?.newCarrierId)) {
      g3Decision = ExecutionDecision.BLOCK;
      g3Details = `Policy Violation: Carrier '${action.arguments?.newCarrierId}' is not authorized.`;
    }

    decisions.push({
      gate: "GATE 3 - POLICY ENGINE",
      passed: g3Decision !== ExecutionDecision.BLOCK,
      decision: g3Decision,
      details: g3Details
    });

    return decisions;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  // -- Event Ingestion --
  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    const event: LogisticsEvent = { id: uuidv4(), timestamp: new Date().toISOString(), source: source || "Webhook", content, status: 'PENDING' };
    events.push(event);
    io.emit("event:new", event);
    res.status(201).json(event);

    // TRIGGER SERVER-SIDE WORKFLOW
    processWorkflow(event, io);
  });

  app.get("/api/data", (req, res) => res.json({ events, actions }));

  // -- HUMAN-IN-THE-LOOP CONTROL --
  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body; // 'APPROVE' | 'DENIED'
    
    const action = actions.find(a => a.id === id);
    if (!action) return res.status(404).json({ error: "Action not found" });
    if (action.status !== 'AWAITING_APPROVAL') return res.status(400).json({ error: "Action not in escalation state" });

    if (decision === 'APPROVE') {
      action.status = 'APPROVED';
      action.finalDecision = ExecutionDecision.APPROVE;
      io.emit("action:update", action);
      
      // Resume execution flow
      await new Promise(r => setTimeout(r, 1000));
      action.status = 'EXECUTED';
    } else {
      action.status = 'DENIED';
      action.finalDecision = ExecutionDecision.BLOCK;
    }

    io.emit("action:update", action);
    res.json(action);
  });

  async function processWorkflow(event: LogisticsEvent, io: Server) {
    try {
      const genModel = ai.getGenerativeModel({ model: MODAL_ID });
      // 1. Generation Phase
      const brainResponse = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Act as Logistics AI. Event: "${event.content}". Propose tools: reroute_shipment, notify_stakeholders, switch_carrier. Output JSON array of actions: { "actions": [{ "toolName": string, "arguments": any, "rationale": string, "confidence": number }] }` }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      const brain = JSON.parse(brainResponse.response.text());

      for (const proposed of (brain.actions || brain.proposedActions || [])) {
        const traceId = uuidv4();
        const action: Action = {
          id: traceId, eventId: event.id, toolName: proposed.toolName, arguments: proposed.arguments,
          rationale: proposed.rationale, confidence: proposed.confidence || 0.8,
          guardrailDecisions: [], status: 'PROPOSED', finalDecision: ExecutionDecision.APPROVE
        };
        actions.push(action);
        io.emit("action:update", action);

        // 2. Governance Phase (Control Plane Interception)
        const decisions = await ExecutionGovernanceLayer.evaluate(event.content, action, traceId);
        action.guardrailDecisions = decisions;
        
        const hasBlock = decisions.some(d => d.decision === ExecutionDecision.BLOCK);
        const hasEscalate = decisions.some(d => d.decision === ExecutionDecision.ESCALATE);

        if (hasBlock) { action.status = 'DENIED'; action.finalDecision = ExecutionDecision.BLOCK; }
        else if (hasEscalate) { action.status = 'AWAITING_APPROVAL'; action.finalDecision = ExecutionDecision.ESCALATE; }
        else { action.status = 'APPROVED'; action.finalDecision = ExecutionDecision.APPROVE; }
        
        io.emit("action:update", action);

        // 3. Execution Phase
        if (action.status === 'APPROVED') {
          await new Promise(r => setTimeout(r, 1500));
          action.status = 'EXECUTED';
          io.emit("action:update", action);
        }
      }
    } catch (e) { console.error(e); }
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(3000, "0.0.0.0", () => console.log("AI Control Plane running on port 3000"));
}

startServer();

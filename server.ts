import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";
import { ControlPlane, ExecutionDecision } from "./control-plane";

/**
 * PRESENTATION LAYER PROXY (NODE/EXPRESS)
 * 
 * Role: 
 * 1. Serves the React Frontend.
 * 2. Proxies client events to the Backend AI Control Plane (Simulated by control-plane.ts).
 * 3. Manages UI-side state and WebSocket broadcasting.
 * 
 * STRICT CONSTRAINT: This file contains NO AI logic, NO prompts, and NO governance rules.
 */

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

const events: LogisticsEvent[] = [];
const actions: Action[] = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  // -- Event Ingestion (Proxy to Control Plane) --
  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    const event: LogisticsEvent = { id: uuidv4(), timestamp: new Date().toISOString(), source: source || "Inbound Telemetry", content, status: 'PENDING' };
    events.push(event);
    io.emit("event:new", event);
    res.status(201).json(event);

    // DELEGATE TO CONTROL PLANE
    processWorkflow(event, io);
  });

  app.get("/api/data", (req, res) => res.json({ events, actions }));

  // -- Human-in-the-loop Proxy --
  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;
    
    const action = actions.find(a => a.id === id);
    if (!action) return res.status(404).json({ error: "Action not found" });

    // In a real system, this sends an authorization token back to the Java Control Plane
    if (decision === 'APPROVE') {
      action.status = 'APPROVED';
      action.finalDecision = ExecutionDecision.APPROVE;
      io.emit("action:update", action);
      
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
      // Direct call to simulated Backend Control Plane
      const backendActions = await ControlPlane.processEvent(event.content);

      for (const bAction of backendActions) {
        const action: Action = {
          ...bAction,
          eventId: event.id,
          finalDecision: bAction.status === 'DENIED' ? ExecutionDecision.BLOCK : 
                        bAction.status === 'AWAITING_APPROVAL' ? ExecutionDecision.ESCALATE : 
                        ExecutionDecision.APPROVE
        };
        actions.push(action);
        io.emit("action:update", action);

        // Simulation of Execution phase if approved
        if (action.status === 'APPROVED') {
          await new Promise(r => setTimeout(r, 1500));
          action.status = 'EXECUTED';
          io.emit("action:update", action);
        }
      }
    } catch (e) {
      console.error("Control Plane Pipeline Error:", e);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Logistics Dashboard Entry Point: http://localhost:3000");
    console.log("Backend Control Plane Status: INTERCEPTING");
  });
}

startServer();

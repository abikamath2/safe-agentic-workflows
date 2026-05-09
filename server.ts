import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";
import { SpringBootBackendEmulator, ExecutionDecision } from "./backend/emulator/SpringBootBackendEmulator";

/**
 * TIER 2: INFRASTRUCTURE LAYER (Node/Express Proxy)
 * 
 * ROLE:
 * - Serves static assets (Tier 1 UI).
 * - Manages WebSocket connections for real-time telemetry.
 * - Proxies event ingestion to the Intelligence Tier (Spring Boot / Emulator).
 * - STRICTLY AGNOSTIC to business rules and AI logic.
 */

interface LogisticsEvent {
  id: string;
  timestamp: string;
  source: string;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

const events: LogisticsEvent[] = [];
const actions: any[] = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  // -- API LAYER (Proxy to Backend Control Plane) --

  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    const event: LogisticsEvent = { 
        id: uuidv4(), 
        timestamp: new Date().toISOString(), 
        source: source || "Inbound Telemetry", 
        content, 
        status: 'PENDING' 
    };
    
    events.push(event);
    io.emit("event:new", event);
    res.status(201).json(event);

    // Delegate and stream results back to UI
    try {
        const proposals = await SpringBootBackendEmulator.handleEvent(event.content);
        for (const p of proposals) {
            const enrichedAction = { ...p, eventId: event.id };
            actions.push(enrichedAction);
            io.emit("action:update", enrichedAction);
            
            // Execute mock transition if approved
            if (enrichedAction.status === 'APPROVED') {
                setTimeout(() => {
                    enrichedAction.status = 'EXECUTED';
                    io.emit("action:update", enrichedAction);
                }, 2000);
            }
        }
    } catch (e) {
        console.error("Backend Proxy Error:", e);
    }
  });

  app.get("/api/data", (req, res) => res.json({ events, actions }));

  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;
    const action = actions.find(a => a.id === id);
    if (!action) return res.status(404).json({ error: "Not found" });

    if (decision === 'APPROVE') {
      action.status = 'APPROVED';
      action.finalDecision = ExecutionDecision.APPROVE;
      io.emit("action:update", action);
      setTimeout(() => {
        action.status = 'EXECUTED';
        io.emit("action:update", action);
      }, 1000);
    } else {
      action.status = 'DENIED';
      action.finalDecision = ExecutionDecision.BLOCK;
      io.emit("action:update", action);
    }
    res.json(action);
  });

  // -- ASSET PIPELINE (Infrastructure) --

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Infrastructure Proxy: http://localhost:3000");
    console.log("Status: READY - Forwarding to Intelligence Tier");
  });
}

startServer();


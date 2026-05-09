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

  // -- DATA TIER (Proxy to Intelligence Layer) --

  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    
    // 1. Log Inbound Telemetry
    const event: LogisticsEvent = { 
        id: uuidv4(), 
        timestamp: new Date().toISOString(), 
        source: source || "Inbound Telemetry", 
        content, 
        status: 'PENDING' 
    };
    events.push(event);
    io.emit("event:new", event);

    // 2. FORWARD TO INTELLIGENCE TIER (Spring Boot Control Plane)
    // In production, this would be: await fetch("http://backend-service:8080/api/v1/events", ...)
    try {
        const proposals = await SpringBootBackendEmulator.handleEvent(event.content);
        
        // 3. BROADCAST TELEMETRY TO UI
        for (const p of proposals) {
            const action = { ...p, eventId: event.id };
            actions.push(action);
            io.emit("action:update", action);
            
            // Handle auto-execution simulation
            if (action.status === 'APPROVED') {
                setTimeout(() => {
                    action.status = 'EXECUTED';
                    io.emit("action:update", action);
                }, 1500);
            }
        }
        res.status(201).json(event);
    } catch (e) {
        console.error("Upstream Control Plane Error:", e);
        res.status(502).json({ error: "Intelligence Tier Unavailable" });
    }
  });

  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;
    
    // Proxy authorization to upstream
    const action = actions.find(a => a.id === id);
    if (!action) return res.status(404).json({ error: "Action target not found" });

    // Inform Intelligence Tier of human decision
    action.status = decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
    action.finalDecision = decision === 'APPROVE' ? ExecutionDecision.APPROVE : ExecutionDecision.BLOCK;
    
    io.emit("action:update", action);
    
    if (action.status === 'APPROVED') {
        setTimeout(() => {
            action.status = 'EXECUTED';
            io.emit("action:update", action);
        }, 1000);
    }
    
    res.json({ status: "Authorization Transmitted" });
  });

  app.get("/api/data", (req, res) => res.json({ events, actions }));

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


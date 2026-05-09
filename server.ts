import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  // -- INFRASTRUCTURE SETUP --
  // Set up the bridge between the Simulation and the UI
  SpringBootBackendEmulator.setBroadcastHandler((type, data) => {
    io.emit(type, data);
  });

  // -- PRESENTATION API (Stateless Proxies) --

  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    
    // FORWARD TO INTELLIGENCE TIER (Asynchronous Entry)
    try {
        const event = await SpringBootBackendEmulator.handleEvent(content, source);
        res.status(201).json(event);
    } catch (e) {
        res.status(502).json({ error: "Intelligence Tier Timeout" });
    }
  });

  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;
    
    // PROXY HUMAN AUTHORIZATION TO BACKEND
    try {
        const updatedAction = await SpringBootBackendEmulator.handleDecision(id, decision);
        if (!updatedAction) return res.status(404).json({ error: "Action Sync Error" });
        res.json({ status: "Authorization Transmitted", action: updatedAction });
    } catch (e) {
        res.status(500).json({ error: "Upstream Decision Failure" });
    }
  });

  app.get("/api/data", (req, res) => {
    // FETCH AUTHENTIC STATE FROM BACKEND
    res.json(SpringBootBackendEmulator.getData());
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


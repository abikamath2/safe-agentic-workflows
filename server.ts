import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

/**
 * TIER 2 - INFRASTRUCTURE PROXY (Node/Express)
 * 
 * ROLE:
 * - Aggregates telemetry for the React UI.
 * - Proxies REST calls to the Java Intelligence Tier (Spring Boot).
 * - Real-time relay via WebSocket.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json());

  // -- PROXY TO INTELLIGENCE TIER --
  // In this strict architecture, all business logic and AI reside in Java.
  // Node only acts as a transport layer for the Presentation Tier.

  app.post("/api/events", async (req, res) => {
    const { content } = req.body;
    
    // Simulate forwarding to the Spring Boot Control Plane
    // In production: fetch("http://backend-service:8080/api/events", { method: 'POST', body: JSON.stringify({ event: content }) });
    
    console.log(`[Proxy] Forwarding event to Intelligence Tier: ${content}`);
    
    // Node remains stateless and agnostic to the workflow
    res.status(201).json({ status: "EVENT_FORWARDED" });
  });

  app.post("/api/actions/:id/decide", async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;
    
    // Relay Human Authorization to Upstream
    console.log(`[Proxy] Relaying ${decision} authorization for action ${id}`);
    res.json({ status: "AUTHORIZATION_TRANSMITTED" });
  });

  app.get("/api/data", (req, res) => {
    // Statistically fetched from the authoritative backend
    res.json({ events: [], actions: [] });
  });

  // -- INFRASTRUCTURE --

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(3000, "0.0.0.0", () => {
    console.log("Infrastructure Gateway: http://localhost:3000");
    console.log("Monitoring Control Plane: http://java-control-plane:8080");
  });
}

startServer();


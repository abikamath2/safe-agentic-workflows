import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { v4 as uuidv4 } from "uuid";

// -- Mock Database / Context Store --
const events: any[] = [];
const actions: any[] = [];

// -- Types --
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
  type: string;
  payload: any;
  rationale: string;
  guardrailResults: {
    gate1: any;
    gate2: any;
    gate3: any;
  };
  status: 'PROPOSED' | 'APPROVED' | 'DENIED' | 'EXECUTED';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // -- API Routes --
  
  // Real-time Event Webhook
  app.post("/api/events", async (req, res) => {
    const { content, source } = req.body;
    const event: LogisticsEvent = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: source || "External Webhook",
      content,
      status: 'PENDING'
    };
    
    events.push(event);
    io.emit("event:new", event);
    
    res.status(201).json(event);

    // Trigger Workflow (Logic will be handled by the "Brain")
    // In a real system, this would be an async task or message queue consumer
  });

  app.get("/api/data", (req, res) => {
    res.json({ events, actions });
  });

  // -- Vite middleware --
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

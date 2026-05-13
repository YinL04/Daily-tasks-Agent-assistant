import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import agentRoutes from "./routes/agent.routes.js";
import memoryRoutes from "./routes/memory.routes.js";
import filesRoutes from "./routes/files.routes.js";
import skillsRoutes from "./routes/skills.routes.js";
import historyRoutes from "./routes/history.routes.js";
import { ensureStorage } from "./storage/db.js";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../../.env") });
dotenv.config();
await ensureStorage();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    modelConfigured: Boolean(process.env.LLM_API_KEY),
    model: process.env.LLM_MODEL_ID || "not set",
    baseUrl: process.env.LLM_BASE_URL || "not set"
  });
});
app.use("/api/agent", agentRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/skills", skillsRoutes);
app.use("/api/runs", historyRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = error instanceof Error && error.name === "ValidationError" ? 400 : 500;
  res.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Personal Agent Planner API listening on http://127.0.0.1:${port}`);
});

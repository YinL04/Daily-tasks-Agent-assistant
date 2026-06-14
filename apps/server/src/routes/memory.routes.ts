import { Router } from "express";
import { z } from "zod";
import { MemoryManager } from "../memory/memoryManager.js";

const router = Router();
const manager = new MemoryManager();

const memorySchema = z.object({
  type: z.enum(["preference", "habit", "constraint", "profile", "project", "other"]).default("other"),
  key: z.string().min(1),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.8),
  source: z.enum(["user_explicit", "agent_inferred"]).default("user_explicit"),
  status: z.enum(["pending", "active", "archived"]).default("active"),
  layer: z.enum(["working", "long"]).default("long"),
  hitCount: z.number().int().min(0).default(0),
  lastHitAt: z.string().datetime().optional()
});

router.get("/", async (_req, res) => {
  res.json(await manager.list());
});

router.get("/stats", async (_req, res) => {
  res.json(await manager.stats());
});

router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await manager.create(memorySchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/confirm", async (req, res, next) => {
  try {
    const updated = await manager.confirm(req.params.id);
    if (!updated) return res.status(404).json({ error: "Memory not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/archive", async (req, res, next) => {
  try {
    const updated = await manager.archive(req.params.id);
    if (!updated) return res.status(404).json({ error: "Memory not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await manager.update(req.params.id, memorySchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Memory not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await manager.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Memory not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { GoalStore } from "../storage/goalStore.js";

const router = Router();
const store = new GoalStore();

const goalSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  horizon: z.enum(["monthly", "quarterly", "yearly"]).default("quarterly"),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  tags: z.array(z.string()).default([]),
  reviewCycle: z.enum(["weekly", "monthly"]).default("weekly"),
  nextReviewAt: z.string().datetime()
});

router.get("/", async (_req, res, next) => {
  try {
    res.json(await store.list());
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await store.create(goalSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await store.update(req.params.id, goalSchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Goal not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Goal not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

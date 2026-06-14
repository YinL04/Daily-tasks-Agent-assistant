import { Router } from "express";
import { z } from "zod";
import { ReviewStore } from "../storage/reviewStore.js";

const router = Router();
const store = new ReviewStore();

const reviewSchema = z.object({
  goalId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().default(""),
  wins: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([])
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
    res.status(201).json(await store.create(reviewSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await store.update(req.params.id, reviewSchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Review not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Review not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { TemplateStore } from "../storage/templateStore.js";

const router = Router();
const store = new TemplateStore();

const templateSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["study", "travel", "project", "health", "review", "custom"]).default("custom"),
  prompt: z.string().min(1),
  defaultOptions: z
    .object({
      generateFiles: z.boolean().optional(),
      generateCalendar: z.boolean().optional(),
      useMemory: z.boolean().optional()
    })
    .default({ generateFiles: true, generateCalendar: true, useMemory: true })
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
    res.status(201).json(await store.create(templateSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await store.update(req.params.id, templateSchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Template not found or built-in template is read-only" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Template not found or built-in template is read-only" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

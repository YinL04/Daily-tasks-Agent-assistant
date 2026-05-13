import { Router } from "express";
import { z } from "zod";
import { CalendarStore } from "../storage/calendarStore.js";

const router = Router();
const store = new CalendarStore();

const calendarEventBaseSchema = z.object({
  taskId: z.string().optional(),
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  description: z.string().default("")
});

const calendarEventSchema = calendarEventBaseSchema.refine((value) => {
  return new Date(value.end).getTime() > new Date(value.start).getTime();
}, {
  message: "End time must be after start time",
  path: ["end"]
});

const calendarEventPatchSchema = calendarEventBaseSchema.partial().refine((value) => {
  if (!value.start || !value.end) return true;
  return new Date(value.end).getTime() > new Date(value.start).getTime();
}, {
  message: "End time must be after start time",
  path: ["end"]
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
    const body = calendarEventSchema.parse(req.body);
    res.status(201).json(await store.create({
      id: "",
      taskId: body.taskId || "manual",
      title: body.title,
      start: body.start,
      end: body.end,
      priority: body.priority,
      description: body.description,
      source: "manual"
    }));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updated = await store.update(req.params.id, calendarEventPatchSchema.parse(req.body));
    if (!updated) return res.status(404).json({ error: "Calendar event not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Calendar event not found" });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { ConversationStore } from "../storage/conversationStore.js";

const router = Router();
const store = new ConversationStore();

const titleSchema = z.object({
  title: z.string().trim().min(1).max(80).optional()
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
    const body = titleSchema.parse(req.body);
    res.status(201).json(await store.create(body.title || "新对话"));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const conversation = await store.get(req.params.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const body = titleSchema.required().parse(req.body);
    const conversation = await store.updateTitle(req.params.id, body.title);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Conversation not found" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;

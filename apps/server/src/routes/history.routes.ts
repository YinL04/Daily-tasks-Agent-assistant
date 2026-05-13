import { Router } from "express";
import { RunHistoryStore } from "../storage/runHistoryStore.js";

const router = Router();
const store = new RunHistoryStore();

router.get("/", async (_req, res) => {
  const history = await store.list();
  res.json(history.map((item) => ({
    runId: item.runId,
    input: item.input,
    finalAnswer: item.finalAnswer,
    createdAt: item.createdAt,
    taskCount: item.tasks.length,
    eventCount: item.calendarEvents.length,
    fileCount: item.files.length
  })));
});

router.get("/:runId", async (req, res) => {
  const item = await store.get(req.params.runId);
  if (!item) return res.status(404).json({ error: "Run history not found" });
  res.json(item);
});

export default router;

import { Router, type Response } from "express";
import { z } from "zod";
import { agent } from "../agent/agent.js";
import type { AgentRunEvent } from "../agent/types.js";
import { testLLMConnection } from "../llm/index.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();
const runSchema = z.object({
  input: z.string().trim().min(1, "请输入要规划的事务或目标。").max(5000, "输入不能超过 5000 字。"),
  options: z.object({
    generateFiles: z.boolean().optional(),
    generateCalendar: z.boolean().optional(),
    useMemory: z.boolean().optional()
  }).optional(),
  conversationId: z.string().uuid().optional(),
  stream: z.boolean().optional()
});

function writeEvent(res: Response, event: AgentRunEvent) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

router.post("/run", rateLimit(10), async (req, res, next) => {
  try {
    const body = runSchema.parse(req.body);
    const wantsStream = body.stream || req.accepts(["text/event-stream", "json"]) === "text/event-stream";

    if (!wantsStream) {
      return res.json(await agent.run(body.input, body.options, body.conversationId));
    }

    const controller = new AbortController();
    let finished = false;
    req.on("aborted", () => {
      if (!finished) controller.abort();
    });
    res.on("close", () => {
      if (!finished) controller.abort();
    });
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: step\ndata: ${JSON.stringify({ type: "step", step: { id: "0", name: "Agent queued", status: "running", inputSummary: "等待执行", startedAt: new Date().toISOString() } })}\n\n`);

    try {
      await agent.run(body.input, body.options, body.conversationId, {
        signal: controller.signal,
        onEvent: (event) => writeEvent(res, event)
      });
    } catch (error) {
      writeEvent(res, {
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      finished = true;
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

router.get("/run", (_req, res) => {
  res.status(405).json({ error: "请使用 POST /api/agent/run 运行 Agent。" });
});

router.get("/llm-status", async (_req, res, next) => {
  try {
    const status = await testLLMConnection();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

export default router;

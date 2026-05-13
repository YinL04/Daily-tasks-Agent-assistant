import { Router } from "express";
import { z } from "zod";
import { agent } from "../agent/agent.js";
import { testLLMConnection } from "../llm/index.js";

const router = Router();
const runSchema = z.object({
  input: z.string(),
  options: z.object({
    generateFiles: z.boolean().optional(),
    generateCalendar: z.boolean().optional(),
    useMemory: z.boolean().optional()
  }).optional()
});

router.post("/run", async (req, res, next) => {
  try {
    const body = runSchema.parse(req.body);
    res.json(await agent.run(body.input, body.options));
  } catch (error) {
    next(error);
  }
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

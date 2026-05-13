import { randomUUID } from "node:crypto";
import type { AgentContext } from "./types.js";
import { MemoryManager } from "../memory/memoryManager.js";

export async function buildContext(input: string, memoryManager: MemoryManager, useMemory = true): Promise<AgentContext> {
  return {
    runId: randomUUID(),
    input,
    now: new Date().toISOString(),
    memories: useMemory ? await memoryManager.retrieveRelevant(input) : []
  };
}

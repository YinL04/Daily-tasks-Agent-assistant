import type { AgentContext, PlannedTask } from "../agent/types.js";

export function fallbackTasks(_context: AgentContext): PlannedTask[] {
  throw new Error("LLM 任务拆解失败，且本地 fallback 已禁用。请检查 LLM 连接配置。");
}

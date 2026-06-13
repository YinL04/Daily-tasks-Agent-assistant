import type { AgentRunEvent, AgentStepLog, Skill } from "./types.js";

export class AgentHarness {
  private steps: AgentStepLog[] = [];

  constructor(
    private maxSteps = 8,
    private options: { onEvent?: (event: AgentRunEvent) => void; signal?: AbortSignal } = {}
  ) {}

  get logs() {
    return this.steps;
  }

  async runStep<I, O>(
    name: string,
    skill: Skill<I, O>,
    input: I,
    inputSummary: string,
    usedLLM?: boolean,
    react?: { thought: string; action: string }
  ): Promise<O> {
    this.throwIfAborted();
    if (this.steps.length >= this.maxSteps) {
      throw new Error(`Agent exceeded max steps: ${this.maxSteps}`);
    }
    const log: AgentStepLog = {
      id: `${this.steps.length + 1}`,
      name,
      skillName: skill.name,
      status: "running",
      thought: react?.thought,
      action: react?.action ?? skill.name,
      inputSummary,
      startedAt: new Date().toISOString(),
      usedLLM
    };
    this.steps.push(log);
    this.options.onEvent?.({ type: "step", step: { ...log } });
    try {
      this.throwIfAborted();
      const output = await skill.execute(input);
      this.throwIfAborted();
      log.status = "success";
      log.outputSummary = Array.isArray(output) ? `输出 ${output.length} 条结果` : "输出结构化结果";
      log.observation = log.outputSummary;
      log.endedAt = new Date().toISOString();
      this.options.onEvent?.({ type: "observation", step: { ...log } });
      return output;
    } catch (error) {
      log.status = "error";
      log.error = error instanceof Error ? error.message : String(error);
      log.observation = `执行失败：${log.error}`;
      log.endedAt = new Date().toISOString();
      this.options.onEvent?.({ type: "observation", step: { ...log } });
      throw error;
    }
  }

  private throwIfAborted() {
    if (this.options.signal?.aborted) {
      const error = new Error("用户中断了 Agent 运行。");
      error.name = "AbortError";
      throw error;
    }
  }
}

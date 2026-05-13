import type { AgentStepLog, Skill } from "./types.js";

export class AgentHarness {
  private steps: AgentStepLog[] = [];

  constructor(private maxSteps = 8) {}

  get logs() {
    return this.steps;
  }

  async runStep<I, O>(name: string, skill: Skill<I, O>, input: I, inputSummary: string, usedLLM?: boolean): Promise<O> {
    if (this.steps.length >= this.maxSteps) {
      throw new Error(`Agent exceeded max steps: ${this.maxSteps}`);
    }
    const log: AgentStepLog = {
      id: `${this.steps.length + 1}`,
      name,
      skillName: skill.name,
      status: "running",
      inputSummary,
      startedAt: new Date().toISOString(),
      usedLLM
    };
    this.steps.push(log);
    try {
      const output = await skill.execute(input);
      log.status = "success";
      log.outputSummary = Array.isArray(output) ? `输出 ${output.length} 条结果` : "输出结构化结果";
      return output;
    } catch (error) {
      log.status = "error";
      log.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      log.endedAt = new Date().toISOString();
    }
  }
}

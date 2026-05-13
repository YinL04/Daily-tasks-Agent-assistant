import type { AgentOptions, HarnessRunResult, LLMStatus } from "./types.js";
import { AgentHarness } from "./harness.js";
import { buildContext } from "./context.js";
import { createPlan } from "./planner.js";
import { MemoryManager } from "../memory/memoryManager.js";
import { RunHistoryStore } from "../storage/runHistoryStore.js";
import { requireNonEmptyInput } from "../utils/validation.js";
import { createLLMProvider, testLLMConnection } from "../llm/index.js";
import {
  calendarPlannerSkill,
  fileWriterSkill,
  prioritySorterSkill,
  recommendationSkill,
  taskDecomposerSkill,
  urlCollectorSkill
} from "../skills/index.js";

export class AgentExecutor {
  constructor(
    private memoryManager = new MemoryManager(),
    private historyStore = new RunHistoryStore()
  ) {}

  async run(input: string, options: AgentOptions = {}): Promise<HarnessRunResult> {
    requireNonEmptyInput(input);
    const context = await buildContext(input.trim(), this.memoryManager, options.useMemory !== false);
    const plan = createPlan(context, options);
    const harness = new AgentHarness(8);

    // Test LLM connection upfront
    const llmConn = await testLLMConnection();
    const llmAvailable = llmConn.ok;
    const llmStatus: LLMStatus = {
      connected: llmConn.ok,
      model: llmConn.model,
      provider: llmConn.provider,
      latencyMs: llmConn.latencyMs,
      error: llmConn.error
    };

    // Step 1: Task Decomposition (LLM-dependent)
    let tasks = await harness.runStep("任务拆解", taskDecomposerSkill, context, taskDecomposerSkill.definition.input, llmAvailable);
    tasks = await harness.runStep("优先级排序", prioritySorterSkill, tasks, `${tasks.length} 个任务`, false);

    const calendarEvents = options.generateCalendar === false
      ? []
      : await harness.runStep("日历生成", calendarPlannerSkill, tasks, calendarPlannerSkill.definition.input, false);

    const urls = await harness.runStep("网址整理", urlCollectorSkill, context, urlCollectorSkill.definition.input, llmAvailable);

    // Step 5: Recommendations (LLM-dependent)
    const recommendations = await harness.runStep("建议生成", recommendationSkill, { tasks, events: calendarEvents }, recommendationSkill.definition.input, llmAvailable);

    // Generate finalAnswer via LLM instead of hardcoded
    const finalAnswer = await this.generateFinalAnswer(input, tasks, calendarEvents, recommendations, llmAvailable);

    const files = options.generateFiles === false
      ? []
      : await harness.runStep("文件生成", fileWriterSkill, {
        runId: context.runId,
        goal: plan.goal,
        finalAnswer,
        tasks,
        calendarEvents,
        urls,
        recommendations
      }, fileWriterSkill.definition.input, false);

    await this.memoryManager.maybeInferMemories(input);

    const result: HarnessRunResult = {
      runId: context.runId,
      steps: harness.logs,
      finalAnswer,
      tasks,
      calendarEvents,
      urls,
      files,
      memoriesUsed: context.memories,
      recommendations,
      llmStatus
    };

    await this.historyStore.add(input, result);
    return result;
  }

  private async generateFinalAnswer(
    input: string,
    tasks: Array<{ title: string; priority: string }>,
    events: Array<{ title: string; start: string }>,
    recommendations: string[],
    llmAvailable: boolean
  ): Promise<string> {
    if (!llmAvailable) {
      return `[本地模式] LLM 未连接，无法生成智能分析。已拆解 ${tasks.length} 个任务、${events.length} 个日历事件。请配置 LLM_API_KEY 以启用 AI 分析。`;
    }

    const provider = createLLMProvider();
    try {
      const summary = await provider.generateText(
        `你是一个个人事务规划 Agent。用户向你描述了一件具体的事，你已经帮他拆解了任务。现在请用 2-3 句话总结你的分析结论。

用户原话：
${input}

你拆解出的任务：
${tasks.map((t, i) => `${i + 1}. [${t.priority}] ${t.title}`).join("\n")}

生成的建议：
${recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

要求：
- 用中文
- 用自己的话总结用户要做的事（不要复述原话）
- 指出最关键的一两个执行要点
- 如果有风险或注意事项，简要提及
- 语气自然，像一个靠谱的助手在跟用户确认计划`,
        { temperature: 0.5, maxTokens: 400 }
      );
      if (summary.trim()) return summary.trim();
    } catch (error) {
      console.warn("LLM finalAnswer generation failed:", error instanceof Error ? error.message : error);
    }

    return `[LLM 响应异常] 已拆解 ${tasks.length} 个任务、${events.length} 个日历事件。`;
  }
}
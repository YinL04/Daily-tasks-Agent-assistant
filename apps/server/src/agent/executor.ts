import type {
  AgentContext,
  AgentOptions,
  CalendarEvent,
  GeneratedFile,
  HarnessRunResult,
  LLMStatus,
  PlannedTask,
  Skill,
  UrlReference
} from "./types.js";
import { AgentHarness } from "./harness.js";
import { buildContext } from "./context.js";
import { createPlan } from "./planner.js";
import { MemoryManager } from "../memory/memoryManager.js";
import { RunHistoryStore } from "../storage/runHistoryStore.js";
import { CalendarStore } from "../storage/calendarStore.js";
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

type ReactAction =
  | "task_decomposer"
  | "priority_sorter"
  | "calendar_planner"
  | "url_collector"
  | "recommendation"
  | "final_answer"
  | "file_writer"
  | "finish";

interface ReactDecision {
  thought: string;
  action: ReactAction;
  reason?: string;
  finalAnswer?: string;
}

interface AgentState {
  tasks: PlannedTask[];
  calendarEvents: CalendarEvent[];
  urls: UrlReference[];
  recommendations: string[];
  finalAnswer: string;
  files: GeneratedFile[];
}

interface ToolRuntime<I, O> {
  action: Exclude<ReactAction, "finish">;
  skill: Skill<I, O>;
  usedLLM: boolean;
  inputSummary: (state: AgentState) => string;
  input: (state: AgentState) => I;
  apply: (state: AgentState, output: O) => void;
  available: (state: AgentState) => boolean;
}

const autonomousStepLimit = 10;

function summarizeList<T>(items: T[], mapper: (item: T, index: number) => unknown) {
  return items.slice(0, 8).map(mapper);
}

function stateSnapshot(state: AgentState) {
  return {
    taskCount: state.tasks.length,
    tasks: summarizeList(state.tasks, (task) => ({
      title: task.title,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      dueDate: task.dueDate,
      dependencies: task.dependencies
    })),
    calendarEventCount: state.calendarEvents.length,
    urlCount: state.urls.length,
    recommendationCount: state.recommendations.length,
    hasFinalAnswer: Boolean(state.finalAnswer),
    fileCount: state.files.length
  };
}

function decisionFallback(action: ReactAction, reason: string): ReactDecision {
  return { thought: reason, action };
}

function normalizeDecision(value: unknown, allowedActions: ReactAction[]): ReactDecision | null {
  const candidate = value as Partial<ReactDecision>;
  if (!candidate || typeof candidate !== "object") return null;
  if (!candidate.action || !allowedActions.includes(candidate.action)) return null;
  return {
    thought: typeof candidate.thought === "string" && candidate.thought.trim()
      ? candidate.thought.trim()
      : "根据当前观察选择下一步工具。",
    action: candidate.action,
    reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
    finalAnswer: typeof candidate.finalAnswer === "string" ? candidate.finalAnswer : undefined
  };
}

export class AgentExecutor {
  constructor(
    private memoryManager = new MemoryManager(),
    private historyStore = new RunHistoryStore(),
    private calendarStore = new CalendarStore()
  ) {}

  async run(input: string, options: AgentOptions = {}): Promise<HarnessRunResult> {
    requireNonEmptyInput(input);
    const context = await buildContext(input.trim(), this.memoryManager, options.useMemory !== false);
    const plan = createPlan(context, options);
    const harness = new AgentHarness(autonomousStepLimit);

    const llmConn = await testLLMConnection();
    const llmAvailable = llmConn.ok;
    const llmStatus: LLMStatus = {
      connected: llmConn.ok,
      model: llmConn.model,
      provider: llmConn.provider,
      latencyMs: llmConn.latencyMs,
      error: llmConn.error
    };

    const state: AgentState = {
      tasks: [],
      calendarEvents: [],
      urls: [],
      recommendations: [],
      finalAnswer: "",
      files: []
    };

    if (!llmAvailable) {
      state.finalAnswer = `[本地模式] LLM 未连接，无法运行由模型自主选择工具的 ReAct 循环。请配置 LLM_API_KEY、LLM_MODEL_ID 和 LLM_BASE_URL 后重试。`;
    } else {
      await this.runAutonomousReactLoop(context, plan.goal, options, state, harness);
    }

    await this.memoryManager.maybeInferMemories(input);
    await this.calendarStore.addMany(state.calendarEvents, context.runId);

    const result: HarnessRunResult = {
      runId: context.runId,
      agentPattern: "react",
      steps: harness.logs,
      finalAnswer: state.finalAnswer,
      tasks: state.tasks,
      calendarEvents: state.calendarEvents,
      urls: state.urls,
      files: state.files,
      memoriesUsed: context.memories,
      recommendations: state.recommendations,
      llmStatus
    };

    await this.historyStore.add(input, result);
    return result;
  }

  private async runAutonomousReactLoop(
    context: AgentContext,
    goal: string,
    options: AgentOptions,
    state: AgentState,
    harness: AgentHarness
  ) {
    const tools = this.createToolRuntimes(context, goal, options);
    const executed = new Set<string>();
    let lastObservation = "尚未执行任何工具。";

    for (let turn = 1; turn <= autonomousStepLimit; turn += 1) {
      const availableTools = tools.filter((tool) => tool.available(state) && !executed.has(tool.action));
      const allowedActions: ReactAction[] = [
        ...availableTools.map((tool) => tool.action),
        ...(state.finalAnswer ? ["finish" as const] : [])
      ];

      if (allowedActions.length === 0) break;

      const decision = await this.decideNextAction(context, options, state, availableTools, lastObservation, allowedActions);
      if (decision.action === "finish") {
        if (decision.finalAnswer?.trim()) state.finalAnswer = decision.finalAnswer.trim();
        break;
      }

      const tool = availableTools.find((item) => item.action === decision.action);
      if (!tool) {
        lastObservation = `模型选择了当前不可用的工具：${decision.action}`;
        continue;
      }

      const output = await harness.runStep(
        `ReAct: ${tool.skill.name}`,
        tool.skill,
        tool.input(state),
        tool.inputSummary(state),
        tool.usedLLM,
        {
          thought: decision.thought,
          action: decision.action
        }
      );
      tool.apply(state, output);
      executed.add(tool.action);
      lastObservation = harness.logs[harness.logs.length - 1]?.observation ?? "工具已执行。";

      if (state.finalAnswer && (options.generateFiles === false || state.files.length > 0)) break;
    }

    if (!state.finalAnswer) {
      state.finalAnswer = await this.generateFinalAnswer(
        context.input,
        state.tasks,
        state.calendarEvents,
        state.recommendations,
        true
      );
    }
  }

  private createToolRuntimes(context: AgentContext, goal: string, options: AgentOptions): ToolRuntime<unknown, unknown>[] {
    const finalAnswerSkill: Skill<{
      input: string;
      tasks: PlannedTask[];
      events: CalendarEvent[];
      recommendations: string[];
      llmAvailable: boolean;
    }, string> = {
      name: "final_answer",
      description: "根据已经观察到的任务、日历和建议生成最终回答。",
      execute: (payload) => this.generateFinalAnswer(
        payload.input,
        payload.tasks,
        payload.events,
        payload.recommendations,
        payload.llmAvailable
      )
    };

    return [
      {
        action: "task_decomposer",
        skill: taskDecomposerSkill,
        usedLLM: true,
        inputSummary: () => taskDecomposerSkill.definition.input,
        input: () => context,
        apply: (state, output) => { state.tasks = output as PlannedTask[]; },
        available: (state) => state.tasks.length === 0
      },
      {
        action: "priority_sorter",
        skill: prioritySorterSkill,
        usedLLM: false,
        inputSummary: (state) => `${state.tasks.length} 个任务`,
        input: (state) => state.tasks,
        apply: (state, output) => { state.tasks = output as PlannedTask[]; },
        available: (state) => state.tasks.length > 0
      },
      {
        action: "calendar_planner",
        skill: calendarPlannerSkill,
        usedLLM: false,
        inputSummary: (state) => `${state.tasks.length} 个已排序任务`,
        input: (state) => state.tasks,
        apply: (state, output) => { state.calendarEvents = output as CalendarEvent[]; },
        available: (state) => options.generateCalendar !== false && state.tasks.length > 0 && state.calendarEvents.length === 0
      },
      {
        action: "url_collector",
        skill: urlCollectorSkill,
        usedLLM: true,
        inputSummary: () => urlCollectorSkill.definition.input,
        input: () => context,
        apply: (state, output) => { state.urls = output as UrlReference[]; },
        available: (state) => state.urls.length === 0
      },
      {
        action: "recommendation",
        skill: recommendationSkill,
        usedLLM: true,
        inputSummary: (state) => `目标、${state.tasks.length} 个任务、${state.calendarEvents.length} 个日历事件`,
        input: (state) => ({ goal: context.input, tasks: state.tasks, events: state.calendarEvents }),
        apply: (state, output) => { state.recommendations = output as string[]; },
        available: (state) => state.tasks.length > 0 && state.recommendations.length === 0
      },
      {
        action: "final_answer",
        skill: finalAnswerSkill,
        usedLLM: true,
        inputSummary: (state) => `用户原始输入、${state.tasks.length} 个任务、${state.calendarEvents.length} 个日历事件、${state.recommendations.length} 条建议`,
        input: (state) => ({
          input: context.input,
          tasks: state.tasks,
          events: state.calendarEvents,
          recommendations: state.recommendations,
          llmAvailable: true
        }),
        apply: (state, output) => { state.finalAnswer = String(output); },
        available: (state) => state.tasks.length > 0 && state.recommendations.length > 0 && !state.finalAnswer
      },
      {
        action: "file_writer",
        skill: fileWriterSkill,
        usedLLM: false,
        inputSummary: () => fileWriterSkill.definition.input,
        input: (state) => ({
          runId: context.runId,
          goal,
          finalAnswer: state.finalAnswer,
          tasks: state.tasks,
          calendarEvents: state.calendarEvents,
          urls: state.urls,
          recommendations: state.recommendations
        }),
        apply: (state, output) => { state.files = output as GeneratedFile[]; },
        available: (state) => options.generateFiles !== false && Boolean(state.finalAnswer) && state.files.length === 0
      }
    ];
  }

  private async decideNextAction(
    context: AgentContext,
    options: AgentOptions,
    state: AgentState,
    availableTools: Array<ToolRuntime<unknown, unknown>>,
    lastObservation: string,
    allowedActions: ReactAction[]
  ): Promise<ReactDecision> {
    const fallback = this.nextDeterministicDecision(state, options, allowedActions);
    const provider = createLLMProvider();

    try {
      const decision = await provider.generateJSON<ReactDecision>(
        `你是一个经典 ReAct 个人事务规划 Agent。你必须在每一轮先根据 Observation 和当前状态思考，然后自主选择一个可用工具作为下一步 Action。

规则：
- 只能选择 allowedActions 中的一个 action。
- 除非 finalAnswer 已经存在，否则不要选择 finish。
- 不要重复调用已经完成的工具。
- 优先完成可交付链路：拆任务 -> 排序 -> 需要时生成日历 -> 整理 URL -> 生成建议 -> 最终回答 -> 需要时写文件。
- 如果某个工具对当前用户目标没有价值，可以跳过它并选择更合适的工具。
- 只返回 JSON，不要输出 Markdown。

当前用户输入：
${context.input}

当前时间：${context.now}

相关记忆：
${context.memories.length > 0 ? JSON.stringify(context.memories, null, 2) : "无"}

当前状态：
${JSON.stringify(stateSnapshot(state), null, 2)}

上一轮 Observation：
${lastObservation}

可用工具：
${availableTools.map((tool) => `- ${tool.action}: ${tool.skill.description}`).join("\n")}

allowedActions:
${allowedActions.join(", ")}`,
        `{
  "thought": "说明你根据当前观察为什么选择下一步",
  "action": ${JSON.stringify(allowedActions)},
  "reason": "可选，简短说明",
  "finalAnswer": "只有 action=finish 时可选"
}`,
        { temperature: 0.2, maxTokens: 500 }
      );
      return normalizeDecision(decision, allowedActions) ?? fallback;
    } catch (error) {
      console.warn("ReAct decision failed:", error instanceof Error ? error.message : error);
      return fallback;
    }
  }

  private nextDeterministicDecision(
    state: AgentState,
    options: AgentOptions,
    allowedActions: ReactAction[]
  ): ReactDecision {
    const preferred: Array<[ReactAction, string]> = [
      ["task_decomposer", "需要先把用户输入拆成结构化任务，后续工具才能基于任务继续观察。"],
      ["priority_sorter", "已经观察到任务列表，下一步要按依赖、截止日期和优先级整理执行顺序。"],
      ["calendar_planner", "已经有可执行任务，下一步可以把任务安排成日历时间块。"],
      ["url_collector", "需要整理用户输入中的链接，并补充与目标相关的参考入口。"],
      ["recommendation", "已经有任务和日历上下文，下一步生成具体执行建议。"],
      ["final_answer", "主要观察已经完成，下一步把结果整理成用户可读的最终回答。"],
      ["file_writer", "最终回答已经生成，下一步把结构化结果写成可下载文件。"],
      ["finish", "最终回答和必要产物已经完成，可以结束 ReAct 循环。"]
    ];

    for (const [action, thought] of preferred) {
      if (action === "calendar_planner" && options.generateCalendar === false) continue;
      if (action === "file_writer" && options.generateFiles === false) continue;
      if (allowedActions.includes(action)) return decisionFallback(action, thought);
    }
    if (state.finalAnswer && allowedActions.includes("finish")) {
      return decisionFallback("finish", "结果已经足够完整，可以结束。");
    }
    return decisionFallback(allowedActions[0], "根据当前可用工具选择下一步。");
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
        `你是一个个人事务规划 Agent。用户向你描述了一件具体的事，你已经通过 ReAct 工具调用观察到了任务、日历和建议。现在请用 2-3 句话总结你的分析结论。

用户原话：
${input}

任务：
${tasks.map((task, index) => `${index + 1}. [${task.priority}] ${task.title}`).join("\n")}

日历事件数量：${events.length}

建议：
${recommendations.map((item, index) => `${index + 1}. ${item}`).join("\n")}

要求：
- 用中文
- 用自己的话总结用户要做的事，不要复述原话
- 指出最关键的一两个执行要点
- 如果有风险或注意事项，简要提醒
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

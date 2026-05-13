import type { CalendarEvent, PlannedTask, Skill } from "../agent/types.js";
import { createLLMProvider } from "../llm/index.js";
import { loadMarkdownSkill } from "./markdownSkill.js";

export const recommendationSkill: Skill<{ tasks: PlannedTask[]; events: CalendarEvent[] }, string[]> = {
  name: "recommendation",
  description: "根据任务和日历安排生成简短、可执行的下一步建议。",
  async execute(input) {
    const provider = createLLMProvider();
    const definition = loadMarkdownSkill("recommendation.skill.md");

    const recommendations = await provider.generateJSON<string[]>(
      `你是一个个人事务执行顾问。请根据以下任务和日历安排，给出针对性的执行建议。

核心要求：
- 建议必须针对当前这批具体任务，不要输出"把大任务拆小"这类万能建议
- 如果任务涉及具体场景（旅行、学习、会议、项目），建议要包含该场景的专业知识
- 指出当前任务之间的依赖关系和执行顺序的逻辑
- 如果某个任务有风险（时间紧、依赖外部、信息不足），要具体指出是哪个任务、什么风险
- 建议要可直接行动，包含具体做法而非抽象原则

${definition.prompt}

任务列表：
${JSON.stringify(input.tasks.map(t => ({ title: t.title, priority: t.priority, estimatedMinutes: t.estimatedMinutes, dueDate: t.dueDate, dependencies: t.dependencies, tags: t.tags })), null, 2)}

日历事件：
${JSON.stringify(input.events.map(e => ({ title: e.title, start: e.start, end: e.end })), null, 2)}

请生成 4-6 条针对上述具体任务的执行建议。`,
      `["针对具体任务的建议1", "针对具体任务的建议2", "针对具体任务的建议3"]`,
      { temperature: 0.4, maxTokens: 1000 }
    );
    const wrapped = recommendations as unknown as { recommendations?: unknown };
    const items = Array.isArray(recommendations)
      ? recommendations
      : Array.isArray(wrapped.recommendations)
        ? wrapped.recommendations
        : [];
    const valid = items.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6);
    if (valid.length === 0) {
      throw new Error("LLM 返回了空建议列表");
    }
    return valid;
  }
};

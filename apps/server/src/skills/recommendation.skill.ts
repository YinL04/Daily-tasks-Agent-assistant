import type { CalendarEvent, PlannedTask, Skill } from "../agent/types.js";
import { createLLMProvider } from "../llm/index.js";
import { loadMarkdownSkill } from "./markdownSkill.js";

interface RecommendationInput {
  goal: string;
  tasks: PlannedTask[];
  events: CalendarEvent[];
}

export const recommendationSkill: Skill<RecommendationInput, string[]> = {
  name: "recommendation",
  description: "根据用户目标、任务和日历安排生成具体、可执行的下一步建议。",
  async execute(input) {
    const provider = createLLMProvider();
    const definition = loadMarkdownSkill("recommendation.skill.md");

    const recommendations = await provider.generateJSON<string[]>(
      `你是一个个人事务执行顾问。请根据用户原始目标、任务和日历安排，给出有针对性的执行建议。

核心要求：
- 建议必须针对当前这批具体任务，不要输出“把大任务拆小”这类万能建议。
- 如果任务涉及旅行、选城市、选景点、路线安排，可以主动推荐候选城市、区域、景点类型或经典景点，但要把它们写成“可优先调研/可候选”的建议，而不是未经核验的事实承诺。
- 旅行建议必须避免幻觉：不要编造实时价格、营业时间、闭园信息、签证政策、交通班次、排队时长或具体网址；涉及这些不稳定信息时，明确提醒用户在官方渠道或地图/订票平台二次核验。
- 如果用户没有给出预算、出发地、天数、同行人或偏好，可以给 2-4 个方向不同的候选方案，并说明各自适合的偏好。
- 如果任务涉及学习、会议、项目等场景，建议要包含该场景的专业做法。
- 指出任务之间的依赖关系和执行顺序逻辑。
- 如果某个任务有风险，要具体指出是哪一个任务、什么风险，以及如何降低风险。
- 建议要可直接行动，包含具体做法而非抽象原则。

${definition.prompt}

用户原始目标：
${input.goal}

任务列表：
${JSON.stringify(
  input.tasks.map((t) => ({
    title: t.title,
    priority: t.priority,
    estimatedMinutes: t.estimatedMinutes,
    dueDate: t.dueDate,
    dependencies: t.dependencies,
    tags: t.tags
  })),
  null,
  2
)}

日历事件：
${JSON.stringify(
  input.events.map((e) => ({ title: e.title, start: e.start, end: e.end })),
  null,
  2
)}

请生成 4-6 条针对上述具体任务的执行建议。`,
      `["针对具体任务的建议", "针对具体任务的建议", "针对具体任务的建议"]`,
      { temperature: 0.4, maxTokens: 1000 }
    );
    const wrapped = recommendations as unknown as { recommendations?: unknown };
    const items = Array.isArray(recommendations)
      ? recommendations
      : Array.isArray(wrapped.recommendations)
        ? wrapped.recommendations
        : [];
    const valid = items
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 6);
    if (valid.length === 0) {
      throw new Error("LLM 返回了空建议列表");
    }
    return valid;
  }
};

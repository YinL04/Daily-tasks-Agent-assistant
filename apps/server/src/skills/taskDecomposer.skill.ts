import { randomUUID } from "node:crypto";
import type { AgentContext, PlannedTask, Priority, Skill } from "../agent/types.js";
import { createLLMProvider } from "../llm/index.js";
import { loadMarkdownSkill } from "./markdownSkill.js";

type LLMTask = Partial<Omit<PlannedTask, "id" | "status">>;

const priorities: Priority[] = ["high", "medium", "low"];

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];
}

function cleanPriority(value: unknown): Priority {
  return priorities.includes(value as Priority) ? (value as Priority) : "medium";
}

function cleanMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 60;
  return Math.max(15, Math.min(480, Math.round(minutes)));
}

function normalizeTasks(value: unknown): PlannedTask[] {
  const wrapped = value as { tasks?: unknown };
  const rawTasks = Array.isArray(value) ? value : Array.isArray(wrapped?.tasks) ? wrapped.tasks : [];
  return rawTasks
    .slice(0, 10)
    .map((task, index) => {
      const item = task as LLMTask;
      return {
        id: randomUUID(),
        title: cleanString(item.title, `任务 ${index + 1}`),
        description: cleanString(item.description, "根据用户目标推进此事项。"),
        priority: cleanPriority(item.priority),
        estimatedMinutes: cleanMinutes(item.estimatedMinutes),
        dueDate:
          typeof item.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : undefined,
        dependencies: cleanStringArray(item.dependencies),
        tags: cleanStringArray(item.tags),
        status: "todo" as const
      };
    })
    .filter((task) => task.title.trim());
}

export const taskDecomposerSkill: Skill<AgentContext, PlannedTask[]> = {
  name: "task_decomposer",
  description: "将用户的自然语言目标拆解成可执行任务。",
  async execute(context) {
    const provider = createLLMProvider();
    const definition = loadMarkdownSkill("task-decomposer.skill.md");

    const tasks = await provider.generateJSON<LLMTask[]>(
      `你是一个个人事务规划专家。请仔细阅读用户输入，针对用户描述的具体场景拆解任务。

核心要求：
- 任务必须完全贴合用户输入的内容，不要输出与用户无关的通用任务
- 每个任务的 title 和 description 必须具体、可执行，包含用户提到的关键细节（人名、地点、时间、数量等）
- 如果用户提到了具体的目标（如"去大阪旅行"、"学习 React"、"准备周五的汇报"），任务要围绕这个具体目标展开
- 禁止输出"澄清目标"、"制定计划"这类空泛任务，除非用户输入确实模糊到无法拆解
- estimatedMinutes 要根据任务的实际复杂度合理估算，不要统一写 60

${definition.prompt}

当前日期时间：${context.now}

相关记忆：
${context.memories.length > 0 ? JSON.stringify(context.memories, null, 2) : "无"}

用户输入：
${context.input}

请根据上述用户输入的具体内容，生成针对性的任务数组。`,
      `[
  {
    "title": "具体可执行的任务标题（包含用户输入中的关键细节）",
    "description": "详细说明怎么做、用什么工具、注意什么",
    "priority": "high | medium | low",
    "estimatedMinutes": 根据实际复杂度估算,
    "dueDate": "YYYY-MM-DD 或省略",
    "dependencies": ["依赖的任务标题"],
    "tags": ["与用户输入相关的标签"]
  }
]`,
      { temperature: 0.3, maxTokens: 2000 }
    );
    const normalized = normalizeTasks(tasks);
    if (normalized.length === 0) {
      throw new Error("LLM 返回了空任务列表");
    }
    return normalized;
  }
};

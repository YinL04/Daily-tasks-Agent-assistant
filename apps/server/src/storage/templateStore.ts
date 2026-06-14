import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ScenarioTemplate } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

const templateFile = path.join(dataDir, "scenario-templates.json");

const builtInTemplates: ScenarioTemplate[] = [
  {
    id: "template-study-plan",
    title: "学习计划",
    category: "study",
    prompt: "帮我制定一个可执行的学习计划，包含阶段目标、每日安排、复盘节点和参考资料。",
    defaultOptions: { generateFiles: true, generateCalendar: true, useMemory: true },
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z"
  },
  {
    id: "template-travel-plan",
    title: "旅行准备",
    category: "travel",
    prompt: "帮我规划一次旅行准备流程，拆成预算、交通、住宿、景点调研、行李和风险提醒。",
    defaultOptions: { generateFiles: true, generateCalendar: true, useMemory: true },
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z"
  },
  {
    id: "template-project-sprint",
    title: "项目冲刺",
    category: "project",
    prompt: "帮我把一个项目目标拆成一周冲刺计划，包含优先级、依赖、风险和每日交付。",
    defaultOptions: { generateFiles: true, generateCalendar: true, useMemory: true },
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z"
  },
  {
    id: "template-weekly-review",
    title: "周期复盘",
    category: "review",
    prompt: "帮我做一次周期复盘，整理完成事项、卡点、经验、下周期行动和需要调整的长期目标。",
    defaultOptions: { generateFiles: true, generateCalendar: false, useMemory: true },
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z"
  }
];

export class TemplateStore {
  constructor(private filePath = templateFile) {}

  async list() {
    const custom = await readJsonFile<ScenarioTemplate[]>(this.filePath, []);
    const customIds = new Set(custom.map((item) => item.id));
    return [...custom, ...builtInTemplates.filter((item) => !customIds.has(item.id))];
  }

  async create(input: Omit<ScenarioTemplate, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const item: ScenarioTemplate = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    const custom = await readJsonFile<ScenarioTemplate[]>(this.filePath, []);
    await writeJsonFile(this.filePath, [item, ...custom]);
    return item;
  }

  async update(id: string, patch: Partial<Omit<ScenarioTemplate, "id" | "createdAt">>) {
    const custom = await readJsonFile<ScenarioTemplate[]>(this.filePath, []);
    const index = custom.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    custom[index] = { ...custom[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJsonFile(this.filePath, custom);
    return custom[index];
  }

  async delete(id: string) {
    const custom = await readJsonFile<ScenarioTemplate[]>(this.filePath, []);
    const next = custom.filter((item) => item.id !== id);
    if (next.length === custom.length) return false;
    await writeJsonFile(this.filePath, next);
    return true;
  }
}

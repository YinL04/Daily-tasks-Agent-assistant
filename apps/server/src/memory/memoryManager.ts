import type { MemoryItem } from "../agent/types.js";
import { MemoryStore } from "./memoryStore.js";

const preferencePatterns = [
  { key: "preferred_work_time", regex: /(早上|上午|下午|晚上|夜间|周末|工作日).*(学习|工作|健身|复盘|处理)/ },
  { key: "planning_style", regex: /(喜欢|希望|尽量).*(详细|简洁|按优先级|按时间|番茄钟|两小时|2小时)/ }
];

export class MemoryManager {
  constructor(private store = new MemoryStore()) {}

  list() {
    return this.store.list();
  }

  create(input: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">) {
    return this.store.create(input);
  }

  update(id: string, patch: Partial<MemoryItem>) {
    return this.store.update(id, patch);
  }

  delete(id: string) {
    return this.store.delete(id);
  }

  async retrieveRelevant(input: string) {
    const all = await this.store.list();
    const text = input.toLowerCase();
    return all
      .filter((item) => text.includes(item.key.toLowerCase()) || text.includes(item.value.toLowerCase()) || item.type === "preference")
      .slice(0, 8);
  }

  async maybeInferMemories(input: string) {
    const existing = await this.store.list();
    const created: MemoryItem[] = [];
    for (const pattern of preferencePatterns) {
      const match = input.match(pattern.regex);
      const already = existing.some((item) => item.key === pattern.key && item.value === match?.[0]);
      if (match?.[0] && !already) {
        created.push(
          await this.store.create({
            type: "preference",
            key: pattern.key,
            value: match[0],
            confidence: 0.45,
            source: "agent_inferred"
          })
        );
      }
    }
    return created;
  }
}

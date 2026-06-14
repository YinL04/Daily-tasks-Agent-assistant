import type { MemoryItem } from "../agent/types.js";
import { createLLMProvider } from "../llm/index.js";
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

  async stats() {
    const all = await this.store.list();
    return {
      total: all.length,
      pending: all.filter((item) => item.status === "pending").length,
      active: all.filter((item) => item.status === "active").length,
      archived: all.filter((item) => item.status === "archived").length
    };
  }

  confirm(id: string) {
    return this.store.update(id, { status: "active", layer: "long", confidence: 0.9 });
  }

  archive(id: string) {
    return this.store.update(id, { status: "archived" });
  }

  private keywordScore(input: string, item: MemoryItem) {
    const text = input.toLowerCase();
    const key = item.key.toLowerCase();
    const value = item.value.toLowerCase();
    let score = item.type === "preference" ? 1 : 0;
    if (text.includes(key)) score += 5;
    for (const token of value.split(/\s+|,|，|。|、/).filter(Boolean)) {
      if (token.length > 1 && text.includes(token.toLowerCase())) score += 2;
    }
    if (item.layer === "working") score += 0.5;
    return score;
  }

  private async llmTopK(input: string, candidates: MemoryItem[], limit: number) {
    if (process.env.MEMORY_LLM_TOPK === "false") return undefined;
    const provider = createLLMProvider();
    if (!provider.modelInfo.configured || candidates.length === 0) return undefined;
    try {
      const picked = await provider.generateJSON<{ ids: string[] }>(
        `请从候选记忆中选出最有助于当前规划输入的最多 ${limit} 条。只返回 id，避免选择一次性或不相关记忆。

当前输入：
${input}

候选记忆：
${candidates.map((item) => `- id=${item.id}; type=${item.type}; key=${item.key}; value=${item.value}; confidence=${item.confidence}`).join("\n")}`,
        `{ "ids": ["memory-id"] }`,
        { maxTokens: 300, temperature: 0.1 }
      );
      const idSet = new Set(picked.ids);
      return candidates.filter((item) => idSet.has(item.id)).slice(0, limit);
    } catch {
      return undefined;
    }
  }

  async retrieveRelevant(input: string, limit = 8) {
    const all = await this.store.list();
    const candidates = all.filter((item) => item.status === "active");
    const llmPicked = await this.llmTopK(input, candidates, limit);
    const relevant =
      llmPicked ??
      candidates
        .map((item) => ({ item, score: this.keywordScore(input, item) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
        .slice(0, limit);
    await this.store.markHits(relevant.map((item) => item.id));
    return relevant;
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
            source: "agent_inferred",
            status: "pending",
            layer: "long",
            hitCount: 0
          })
        );
      }
    }
    return created;
  }
}

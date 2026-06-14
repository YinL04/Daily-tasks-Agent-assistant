import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, readJsonFile, writeJsonFile } from "../storage/db.js";
import type { MemoryItem } from "../agent/types.js";

const defaultMemoryFile = path.join(dataDir, "memories.json");

export class MemoryStore {
  constructor(private memoryFile = defaultMemoryFile) {}

  async list(): Promise<MemoryItem[]> {
    const items = await readJsonFile<MemoryItem[]>(this.memoryFile, []);
    return items.map((item) => ({
      ...item,
      status: item.status ?? "active",
      layer: item.layer ?? "long",
      hitCount: item.hitCount ?? 0
    }));
  }

  async create(input: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): Promise<MemoryItem> {
    const now = new Date().toISOString();
    const memories = await this.list();
    const item: MemoryItem = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    memories.unshift(item);
    await writeJsonFile(this.memoryFile, memories);
    return item;
  }

  async update(id: string, patch: Partial<Omit<MemoryItem, "id" | "createdAt">>) {
    const memories = await this.list();
    const index = memories.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    memories[index] = { ...memories[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJsonFile(this.memoryFile, memories);
    return memories[index];
  }

  async markHits(ids: string[]) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const memories = await this.list();
    let changed = false;
    const next = memories.map((item) => {
      if (!idSet.has(item.id)) return item;
      changed = true;
      return { ...item, hitCount: item.hitCount + 1, lastHitAt: now, updatedAt: now };
    });
    if (changed) await writeJsonFile(this.memoryFile, next);
  }

  async delete(id: string) {
    const memories = await this.list();
    const next = memories.filter((item) => item.id !== id);
    if (next.length === memories.length) return false;
    await writeJsonFile(this.memoryFile, next);
    return true;
  }
}

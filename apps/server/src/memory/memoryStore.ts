import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, readJsonFile, writeJsonFile } from "../storage/db.js";
import type { MemoryItem } from "../agent/types.js";

const memoryFile = path.join(dataDir, "memories.json");

export class MemoryStore {
  async list(): Promise<MemoryItem[]> {
    return readJsonFile<MemoryItem[]>(memoryFile, []);
  }

  async create(input: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): Promise<MemoryItem> {
    const now = new Date().toISOString();
    const memories = await this.list();
    const item: MemoryItem = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    memories.unshift(item);
    await writeJsonFile(memoryFile, memories);
    return item;
  }

  async update(id: string, patch: Partial<Omit<MemoryItem, "id" | "createdAt">>) {
    const memories = await this.list();
    const index = memories.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    memories[index] = { ...memories[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJsonFile(memoryFile, memories);
    return memories[index];
  }

  async delete(id: string) {
    const memories = await this.list();
    const next = memories.filter((item) => item.id !== id);
    if (next.length === memories.length) return false;
    await writeJsonFile(memoryFile, next);
    return true;
  }
}

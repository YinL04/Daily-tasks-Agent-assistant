import path from "node:path";
import { randomUUID } from "node:crypto";
import type { LongTermGoal } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

const goalsFile = path.join(dataDir, "long-term-goals.json");

export class GoalStore {
  constructor(private filePath = goalsFile) {}

  async list() {
    return readJsonFile<LongTermGoal[]>(this.filePath, []);
  }

  async create(input: Omit<LongTermGoal, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const item: LongTermGoal = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    const goals = await this.list();
    await writeJsonFile(this.filePath, [item, ...goals]);
    return item;
  }

  async update(id: string, patch: Partial<Omit<LongTermGoal, "id" | "createdAt">>) {
    const goals = await this.list();
    const index = goals.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    goals[index] = { ...goals[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJsonFile(this.filePath, goals);
    return goals[index];
  }

  async delete(id: string) {
    const goals = await this.list();
    const next = goals.filter((item) => item.id !== id);
    if (next.length === goals.length) return false;
    await writeJsonFile(this.filePath, next);
    return true;
  }
}

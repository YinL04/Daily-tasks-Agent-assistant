import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PeriodicReview } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

const reviewsFile = path.join(dataDir, "periodic-reviews.json");

export class ReviewStore {
  constructor(private filePath = reviewsFile) {}

  async list() {
    return readJsonFile<PeriodicReview[]>(this.filePath, []);
  }

  async create(input: Omit<PeriodicReview, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const item: PeriodicReview = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    const reviews = await this.list();
    await writeJsonFile(this.filePath, [item, ...reviews]);
    return item;
  }

  async update(id: string, patch: Partial<Omit<PeriodicReview, "id" | "createdAt">>) {
    const reviews = await this.list();
    const index = reviews.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    reviews[index] = { ...reviews[index], ...patch, updatedAt: new Date().toISOString() };
    await writeJsonFile(this.filePath, reviews);
    return reviews[index];
  }

  async delete(id: string) {
    const reviews = await this.list();
    const next = reviews.filter((item) => item.id !== id);
    if (next.length === reviews.length) return false;
    await writeJsonFile(this.filePath, next);
    return true;
  }
}

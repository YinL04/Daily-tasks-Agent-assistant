import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CalendarEvent } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

export interface StoredCalendarEvent extends CalendarEvent {
  source: "agent" | "manual";
  sourceRunId?: string;
  createdAt: string;
  updatedAt: string;
}

const calendarFile = path.join(dataDir, "calendar-events.json");

export class CalendarStore {
  async list(): Promise<StoredCalendarEvent[]> {
    const events = await readJsonFile<StoredCalendarEvent[]>(calendarFile, []);
    return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  async create(input: CalendarEvent & { source?: StoredCalendarEvent["source"]; sourceRunId?: string }) {
    const now = new Date().toISOString();
    const events = await this.list();
    const item: StoredCalendarEvent = {
      ...input,
      id: input.id || randomUUID(),
      taskId: input.taskId || "manual",
      source: input.source || "manual",
      createdAt: now,
      updatedAt: now
    };
    events.push(item);
    await writeJsonFile(calendarFile, events);
    return item;
  }

  async addMany(items: CalendarEvent[], sourceRunId: string) {
    if (items.length === 0) return [];
    const existing = await this.list();
    const now = new Date().toISOString();
    const next = items.map((item) => ({
      ...item,
      source: "agent" as const,
      sourceRunId,
      createdAt: now,
      updatedAt: now
    }));
    await writeJsonFile(calendarFile, [...existing, ...next]);
    return next;
  }

  async update(id: string, patch: Partial<CalendarEvent>) {
    const events = await this.list();
    const index = events.findIndex((item) => item.id === id);
    if (index === -1) return undefined;
    events[index] = { ...events[index], ...patch, id, updatedAt: new Date().toISOString() };
    await writeJsonFile(calendarFile, events);
    return events[index];
  }

  async delete(id: string) {
    const events = await this.list();
    const next = events.filter((item) => item.id !== id);
    if (next.length === events.length) return false;
    await writeJsonFile(calendarFile, next);
    return true;
  }
}

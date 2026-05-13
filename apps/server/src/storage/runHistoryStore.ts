import path from "node:path";
import type { HarnessRunResult, RunHistoryItem } from "../agent/types.js";
import { dataDir, readJsonFile, writeJsonFile } from "./db.js";

const historyFile = path.join(dataDir, "run-history.json");

export class RunHistoryStore {
  async list(): Promise<RunHistoryItem[]> {
    return readJsonFile<RunHistoryItem[]>(historyFile, []);
  }

  async add(input: string, result: HarnessRunResult): Promise<RunHistoryItem> {
    const history = await this.list();
    const item: RunHistoryItem = {
      ...result,
      input,
      createdAt: new Date().toISOString()
    };
    history.unshift(item);
    await writeJsonFile(historyFile, history.slice(0, 100));
    return item;
  }

  async get(runId: string) {
    const history = await this.list();
    return history.find((item) => item.runId === runId);
  }
}

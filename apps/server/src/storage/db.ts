import fs from "node:fs/promises";
import path from "node:path";

export const projectRoot = path.resolve(process.cwd(), "../..");
export const dataDir = path.join(projectRoot, "data");
export const generatedPlansDir = path.join(projectRoot, "generated", "plans");
export const generatedExportsDir = path.join(projectRoot, "generated", "exports");

export async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(generatedPlansDir, { recursive: true });
  await fs.mkdir(generatedExportsDir, { recursive: true });
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
